import { chmod, lstat, mkdir, open, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import {
  installWorkspaceWithSharedGuard, preflightLegacyInstallWorkspace, sharedInstallGuardPath,
  validCurrentInstallManifest, type PreservedManagedFiles,
} from './install.js';
import {
  atomicJson, atomicWrite, canonicalJson, digest, exists, FoundryError, rejectSymlinkComponents, withProcessLock,
} from './fs.js';
import { activeRun, projectConfig, readRuntimeMarker, validateCompatibleRunState } from './lifecycle.js';
import { FACTORY_CANCEL_LOCK, FACTORY_LOCK, readFactoryState } from './factory-contract.js';
import { loadRoles } from './roles.js';
import { savedTaskStatus } from '../runtime/providers.js';

type JsonRecord = Record<string, unknown>;

const migrationJournalSchema = z.object({
  schema_version: z.literal(1),
  runtime: z.literal('typescript'),
  source_root: z.string().min(1),
  source_pin: z.string().regex(/^[a-f0-9]{64}$/),
  legacy_factory_pin: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  backup: z.string().min(1),
  backup_pin: z.string().regex(/^[a-f0-9]{64}$/),
  started_at: z.string().min(1),
}).strict();

interface MigrationInspection {
  root: string;
  sourceRoot: string;
  sourcePin: string;
  legacy: boolean;
  backup: string | null;
  preserved: string[];
  archivedFactoryRegistry: boolean;
  legacyFactoryRecords: JsonRecord[];
  matchingFactoryRecord: z.infer<typeof legacyFactoryProjectSchema> | null;
  legacyFactoryRegistryBytes: Buffer | null;
}

const JOURNAL = '.foundry/migration-pending.json';
const BACKUP_PREFIX = '.foundry-migration-backup-';
const FACTORY_REGISTRY = '.foundry/state/factory/projects.json';
const FACTORY_REGISTRY_LOCK = '.foundry/state/factory/projects.lock';
const FACTORY_LEASES = '.foundry/state/factory/leases';
const SHA256 = /^[a-f0-9]{64}$/;
const FACTORY_STAGES = ['research', 'scope', 'design', 'build', 'verify', 'release'] as const;

const legacyFactoryProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).max(64),
  idea: z.string().min(1),
  path: z.string().min(1),
  products_root: z.string().min(1),
  adapter: z.string().min(1),
  model: z.string().nullable(),
  reasoning: z.string().nullable(),
  roles: z.array(z.string().min(1)),
  role_settings: z.record(z.string(), z.record(z.string(), z.string())),
  stage: z.enum(FACTORY_STAGES),
  status: z.enum(['completed', 'awaiting_approval', 'running', 'failed', 'interrupted']),
  approved_stages: z.array(z.enum(['scope', 'design'])),
  task_id: z.string().nullable(),
  session_id: z.string().nullable(),
  events: z.array(z.unknown()),
  artifacts: z.array(z.unknown()),
  stage_verification: z.record(z.string(), z.unknown()),
  history: z.array(z.unknown()),
  approved_revisions: z.record(z.string(), z.string().regex(SHA256)),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  publication: z.literal('not_authorized'),
  subscription_confirmed: z.boolean().default(false),
  lifecycle_run_id: z.string().uuid().nullable().default(null),
}).strict().superRefine((project, context) => {
  if (new Set(project.roles).size !== project.roles.length
    || new Set(project.approved_stages).size !== project.approved_stages.length
    || Object.keys(project.approved_revisions).sort().join(',') !== [...project.approved_stages].sort().join(',')) {
    context.addIssue({ code: 'custom', message: 'Legacy Factory project has ambiguous role or approval records' });
  }
  for (const [role, settings] of Object.entries(project.role_settings)) {
    if (!role || !Object.keys(settings).length || Object.keys(settings).some((key) => !['model', 'reasoning'].includes(key))) {
      context.addIssue({ code: 'custom', message: 'Legacy Factory project has malformed role settings' });
    }
  }
  if (Object.keys(project.stage_verification).some((stage) => !FACTORY_STAGES.includes(stage as typeof FACTORY_STAGES[number]))) {
    context.addIssue({ code: 'custom', message: 'Legacy Factory project has an unknown stage record' });
  }
});

const legacyFactoryRegistrySchema = z.object({
  schema_version: z.literal(1),
  projects: z.array(legacyFactoryProjectSchema),
}).strict();

function validLegacyInstallManifest(value: JsonRecord): boolean {
  const files = value.files;
  const modes = value.modes;
  if (Object.keys(value).sort().join(',') !== 'files,installed_at,modes,source_pin,version'
    || value.version !== '0.2.0'
    || typeof value.installed_at !== 'string' || !Number.isFinite(Date.parse(value.installed_at))
    || typeof value.source_pin !== 'string' || !SHA256.test(value.source_pin)
    || !files || typeof files !== 'object' || Array.isArray(files)
    || !modes || typeof modes !== 'object' || Array.isArray(modes)) return false;
  const fileEntries = Object.entries(files);
  const modeEntries = Object.entries(modes);
  if (fileEntries.length !== modeEntries.length
    || fileEntries.some(([relative]) => !Object.hasOwn(modes, relative))
    || fileEntries.some(([relative, fileHash]) => !safeManifestPath(relative)
      || typeof fileHash !== 'string' || !SHA256.test(fileHash))
    || modeEntries.some(([relative, mode]) => !safeManifestPath(relative)
      || !Number.isInteger(mode) || Number(mode) < 0 || Number(mode) > 0o777)) {
    return false;
  }
  const compact = canonicalJson({ files, modes, version: value.version });
  let pythonJson = '';
  let quoted = false;
  let escaped = false;
  for (const character of compact) {
    if (quoted) {
      pythonJson += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') {
      quoted = true;
      pythonJson += character;
    } else {
      pythonJson += character === ',' || character === ':' ? `${character} ` : character;
    }
  }
  return digest(pythonJson) === value.source_pin;
}

function safeManifestPath(relative: string): boolean {
  return Boolean(relative) && !relative.includes('\\') && !relative.includes('\0')
    && !relative.startsWith('/') && !/^[a-zA-Z]:/.test(relative)
    && relative.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

async function sourcePin(sourceRoot: string): Promise<string> {
  const runtimeDirectory = await exists(sourceRoot, '.foundry/runtime/foundry.cjs')
    ? '.foundry/runtime' : 'dist/runtime';
  const files = [
    `${runtimeDirectory}/foundry.cjs`,
    `${runtimeDirectory}/foundry-worker.cjs`,
    '.foundry/roles.json',
  ];
  const entries: Record<string, string> = {};
  for (const relative of files) {
    const file = path.join(sourceRoot, relative);
    rejectSymlinkComponents(file);
    const stats = await lstat(file);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new FoundryError('Migration source runtime files must be regular files.');
    }
    const bytes = await readRegularFile(file, 'Migration source runtime files must be regular files.');
    entries[relative] = digest(bytes);
  }
  return digest(JSON.stringify(entries));
}

async function walkNoSymlinks(root: string, relative = ''): Promise<void> {
  const current = path.join(root, relative);
  let stats;
  try {
    stats = await lstat(current);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (stats.isSymbolicLink()) throw new FoundryError(`Migration refuses symlinked owner data: ${path.join(relative)}`);
  if (stats.isDirectory()) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      await walkNoSymlinks(root, path.join(relative, entry.name));
    }
    return;
  }
  if (!stats.isFile()) throw new FoundryError(`Migration refuses a special file in owner data: ${path.join(relative)}`);
}

async function readRegularFile(target: string, message: string): Promise<Buffer> {
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | (fsConstants.O_NONBLOCK ?? 0);
  const handle = await open(target, flags);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw new FoundryError(message);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

interface LegacyFactoryInspection {
  bytes: Buffer | null;
  records: JsonRecord[];
  matching: z.infer<typeof legacyFactoryProjectSchema> | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function legacySlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function validateLegacyFactoryRegistry(root: string, sourceRoot: string): Promise<LegacyFactoryInspection> {
  const registryPath = path.join(sourceRoot, FACTORY_REGISTRY);
  rejectSymlinkComponents(registryPath);
  let registryStat;
  try {
    registryStat = await lstat(registryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { bytes: null, records: [], matching: null };
    throw error;
  }
  if (registryStat.isSymbolicLink() || !registryStat.isFile()) {
    throw new FoundryError('Migration refuses an unsafe legacy Factory registry.');
  }
  const bytes = await readRegularFile(registryPath, 'Migration refuses an unsafe legacy Factory registry.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch (error) {
    throw new FoundryError('Migration refuses a malformed legacy Factory registry.', { cause: error });
  }
  const result = legacyFactoryRegistrySchema.safeParse(parsed);
  if (!result.success) {
    throw new FoundryError('Migration refuses an unsupported or malformed legacy Factory registry.', { cause: result.error });
  }
  const identifiers = new Set<string>();
  for (const project of result.data.projects) {
    if (identifiers.has(project.id) || project.id !== project.id.toLowerCase()
      || project.slug !== legacySlug(project.name)
      || !path.isAbsolute(project.products_root)
      || !path.isAbsolute(project.path)
      || path.resolve(project.products_root) !== project.products_root
      || path.resolve(project.path) !== project.path
      || path.resolve(project.products_root, project.slug) !== project.path
      || path.dirname(project.path) !== project.products_root) {
      throw new FoundryError('Migration refuses an ambiguous legacy Factory project record.');
    }
    identifiers.add(project.id);
    const buildValue = project.stage_verification.build;
    if (buildValue !== undefined) {
      if (!isRecord(buildValue) || typeof buildValue.status !== 'string'
        || !['configured', 'building', 'fixing', 'needs_fix', 'checkpoint_failed'].includes(buildValue.status)
        || (buildValue.tasks !== undefined && !Array.isArray(buildValue.tasks))) {
        throw new FoundryError('Migration refuses malformed legacy Factory build state.');
      }
      for (const task of Array.isArray(buildValue.tasks) ? buildValue.tasks : []) {
        if (!isRecord(task) || typeof task.title !== 'string'
          || !['pending', 'working', 'done', 'failed'].includes(String(task.status))) {
          throw new FoundryError('Migration refuses malformed legacy Factory task state.');
        }
      }
    }
  }
  const matching = result.data.projects.filter((project) => project.path === root);
  if (matching.length > 1) throw new FoundryError('Migration refuses multiple legacy Factory records for this workspace.');
  const target = matching[0] ?? null;
  if (target) {
    if (target.status === 'running') throw new FoundryError('Migration refuses a matching running legacy Factory record.');
    if (target.status === 'interrupted' || target.task_id !== null || target.session_id !== null) {
      throw new FoundryError('Migration refuses ambiguous legacy Factory task state.');
    }
    const build = target.stage_verification.build;
    if (isRecord(build)) {
      const tasks = (Array.isArray(build.tasks) ? build.tasks : []) as JsonRecord[];
      if (['fixing', 'needs_fix', 'checkpoint_failed'].includes(String(build.status))
        || tasks.some((task) => task.status === 'working')
        || (build.status === 'building' && (!tasks.length || tasks.some((task) => task.status !== 'done')))) {
        throw new FoundryError('Migration refuses in-flight or ambiguous legacy Factory build state.');
      }
    }
  }
  const records: JsonRecord[] = result.data.projects.map((project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    path: project.path,
    status: project.status,
    stage: project.stage,
    task_id: project.task_id,
    session_id: project.session_id,
    build: project.stage_verification.build ?? null,
  }));
  return { bytes, records, matching: target };
}

async function acquireFactoryLock(lockPath: string, createMissing: boolean): Promise<(() => Promise<void>) | null> {
  rejectSymlinkComponents(lockPath);
  let metadata;
  try {
    metadata = await lstat(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (!createMissing) return null;
    await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.close();
    } catch (createError) {
      if ((createError as NodeJS.ErrnoException).code !== 'EEXIST') throw createError;
    }
    metadata = await lstat(lockPath);
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new FoundryError('Migration refuses an unsafe shared Factory lock file.');
  }
  return new Promise((resolve, reject) => {
    const child = spawn('flock', ['-n', lockPath, 'sh', '-c', 'printf "foundry-lock-acquired\\n"; cat'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let acquired = false;
    let settled = false;
    let output = '';
    let errorOutput = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (!acquired && output.includes('foundry-lock-acquired')) {
        acquired = true;
        settled = true;
        resolve(async () => {
          child.stdin.end();
          if (child.exitCode === null) await new Promise<void>((done) => child.once('close', () => done()));
        });
      }
    });
    child.stderr.on('data', (chunk: Buffer) => { errorOutput += chunk.toString(); });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(new FoundryError('Cannot safely inspect the shared Factory lock; migration requires a usable flock utility.', { cause: error }));
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      reject(new FoundryError(code === 1
        ? 'Migration refuses an active shared Factory lock.'
        : `Cannot inspect the shared Factory lock${errorOutput ? `: ${errorOutput.trim()}` : ''}.`));
    });
  });
}

async function acquireFactoryLocks(
  sourceRoot: string,
  project: z.infer<typeof legacyFactoryProjectSchema> | null,
  createMissing: boolean,
): Promise<() => Promise<void>> {
  if (!project) return async () => {};
  const lockPaths = [
    path.join(sourceRoot, FACTORY_REGISTRY_LOCK),
    path.join(sourceRoot, FACTORY_LEASES, `${project.id}.lock`),
  ];
  const releases: Array<() => Promise<void>> = [];
  try {
    for (const lockPath of lockPaths) {
      const release = await acquireFactoryLock(lockPath, createMissing);
      if (release) releases.push(release);
    }
  } catch (error) {
    for (const release of releases.reverse()) await release();
    throw error;
  }
  return async () => {
    for (const release of releases.reverse()) await release();
  };
}

async function backupPin(root: string): Promise<string> {
  const entries: Array<{ path: string; mode: number; sha256?: string }> = [];
  const visit = async (relative: string): Promise<void> => {
    for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true }))
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      const child = path.join(relative, entry.name);
      const target = path.join(root, child);
      const stats = await lstat(target);
      if (stats.isSymbolicLink()) throw new FoundryError('Migration backup contains a symlink.');
      if (stats.isDirectory()) {
        entries.push({ path: child, mode: stats.mode & 0o777 });
        await visit(child);
      } else if (stats.isFile()) {
        entries.push({
          path: child,
          mode: stats.mode & 0o777,
          sha256: digest(await readRegularFile(target, 'Migration backup contains an unsupported file type.')),
        });
      } else {
        throw new FoundryError('Migration backup contains an unsupported file type.');
      }
    }
  };
  await visit('');
  return digest(JSON.stringify(entries));
}

async function readObject(root: string, relative: string): Promise<JsonRecord | null> {
  try {
    const parsed: unknown = JSON.parse((await readRegularFile(
      path.join(root, relative),
      `Migration refuses unsafe ${relative}`,
    )).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new FoundryError(`Migration refuses malformed ${relative}`);
    }
    return parsed as JsonRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (error instanceof FoundryError) throw error;
    throw new FoundryError(`Migration refuses malformed ${relative}`, { cause: error });
  }
}

async function rejectUnsupportedState(root: string, allowPending = false): Promise<void> {
  const marker = await readRuntimeMarker(root);
  if (marker && !allowPending) throw new FoundryError('Workspace already has a TypeScript runtime marker; migration is not required.');
  const project = await readObject(root, '.foundry/project.json');
  if (!project) throw new FoundryError('Legacy project manifest is missing; migration requires an existing project.');
  if (project.schema_version !== undefined && project.schema_version !== 1) {
    throw new FoundryError('Migration refuses a future project manifest format.');
  }
  const installManifest = await readObject(root, '.foundry/install.json');
  if (installManifest) {
    if (installManifest.schema_version !== undefined) {
      if (installManifest.schema_version !== 1 || !validCurrentInstallManifest(installManifest)) {
        throw new FoundryError('Migration refuses a malformed or future install manifest.');
      }
    } else if (!validLegacyInstallManifest(installManifest)) {
      throw new FoundryError('Migration refuses a malformed legacy install manifest.');
    }
  }
  await projectConfig(root);
  const active = await activeRun(root);
  if (active[1]) throw new FoundryError('Migration refuses a workspace with an active lifecycle run.');
  const lastCompleted = await readObject(root, '.foundry/state/last-completed.json');
  if (lastCompleted) {
    const statePath = lastCompleted.state;
    if (typeof lastCompleted.run_id !== 'string' || typeof statePath !== 'string'
      || !statePath.startsWith('.foundry/state/runs/') || statePath.includes('..') || path.isAbsolute(statePath)) {
      throw new FoundryError('Migration refuses a malformed last-completed lifecycle pointer.');
    }
    const completed = validateCompatibleRunState(await readObject(root, statePath));
    if (completed.status !== 'completed' || completed.run_id !== lastCompleted.run_id) {
      throw new FoundryError('Migration refuses a mismatched last-completed lifecycle record.');
    }
  }
  const runsRoot = path.join(root, '.foundry/state/runs');
  try {
    for (const entry of await readdir(runsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const state = await readObject(root, `.foundry/state/runs/${entry.name}/state.json`);
      if (state) {
        const validated = validateCompatibleRunState(state);
        if (['verifying', 'completing'].includes(validated.status)) {
          throw new FoundryError('Migration refuses a verifying or completing lifecycle run.');
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const controller = await readFactoryState(root);
  if (controller && (controller.status === 'running' || controller.status === 'shipping'
    || controller.status === 'recovery_required' || controller.provider_task_id)) {
    throw new FoundryError('Migration refuses active Factory work or provider tasks.');
  }
  for (const relative of [
    FACTORY_LOCK,
    FACTORY_CANCEL_LOCK,
    '.foundry/state/coordinator.lock',
    '.foundry/state/providers/registry.lock',
  ]) {
    if (await exists(root, relative)) throw new FoundryError('Migration refuses active work while a runtime lock exists.');
  }
  try {
    const leases = await readdir(path.join(root, '.foundry/state/providers/leases'));
    if (leases.some((entry) => entry.endsWith('.lock'))) {
      throw new FoundryError('Migration refuses active provider leases.');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const tasksRoot = path.join(root, '.foundry/state/providers/tasks');
  try {
    for (const entry of await readdir(tasksRoot)) {
      if (!entry.endsWith('.json')) continue;
      const task = await readObject(root, `.foundry/state/providers/tasks/${entry}`);
      let status: ReturnType<typeof savedTaskStatus>;
      try {
        status = savedTaskStatus(task);
      } catch (error) {
        throw new FoundryError(`Migration refuses a malformed or future provider task record: ${entry}`, { cause: error });
      }
      if (status === 'running' || status === 'unknown') {
        throw new FoundryError('Migration refuses active or ambiguous provider work.');
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const pending = await readObject(root, JOURNAL);
  if (pending && !allowPending) throw new FoundryError('Interrupted migration requires --recover before another migration attempt.');
  const pendingInstall = await readObject(root, '.foundry/install-pending.json');
  if (pendingInstall && !allowPending) {
    throw new FoundryError('Interrupted installation must be explicitly recovered before migration.');
  }
}

async function inspect(
  rootInput: string,
  sourceRootInput: string,
  allowPending = false,
  checkInstallPlan = true,
): Promise<MigrationInspection> {
  const root = path.resolve(rootInput);
  const sourceRoot = path.resolve(sourceRootInput);
  rejectSymlinkComponents(root);
  rejectSymlinkComponents(sourceRoot);
  await walkNoSymlinks(root, '.foundry');
  await walkNoSymlinks(root, 'docs');
  await walkNoSymlinks(sourceRoot, '.foundry/state/factory');
  await rejectUnsupportedState(root, allowPending);
  const factory = await validateLegacyFactoryRegistry(root, sourceRoot);
  if (checkInstallPlan) await preflightLegacyInstallWorkspace(sourceRoot, root);
  const preserved: string[] = [];
  for (const relative of ['.foundry', 'docs']) {
    try {
      await lstat(path.join(root, relative));
      preserved.push(relative);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return {
    root,
    sourceRoot,
    sourcePin: await sourcePin(sourceRoot),
    legacy: true,
    backup: null,
    preserved,
    archivedFactoryRegistry: factory.bytes !== null,
    legacyFactoryRecords: factory.records,
    matchingFactoryRecord: factory.matching,
    legacyFactoryRegistryBytes: factory.bytes,
  };
}

async function backupOwnerData(
  root: string,
  sourceRoot: string,
  inspection: MigrationInspection,
): Promise<{ path: string; archivedFactoryRegistry: boolean }> {
  const backup = path.join(path.dirname(root), `${path.basename(root)}${BACKUP_PREFIX}${Date.now()}-${randomUUID().slice(0, 8)}`);
  try {
    await mkdir(backup, { recursive: true, mode: 0o700 });
    for (const relative of ['.foundry', 'docs']) {
      try {
        await lstat(path.join(root, relative));
        await copyOwnerTree(root, backup, relative);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    if (inspection.legacyFactoryRegistryBytes) {
      const registrySource = path.join(sourceRoot, FACTORY_REGISTRY);
      const currentBytes = await readRegularFile(registrySource, 'Migration refuses an unsafe legacy Factory registry.');
      if (digest(currentBytes) !== digest(inspection.legacyFactoryRegistryBytes)) {
        throw new FoundryError('Legacy Factory registry changed during migration preflight.');
      }
      await atomicWrite(backup, 'legacy-factory-projects.json', inspection.legacyFactoryRegistryBytes);
      await atomicJson(backup, 'legacy-factory-archive.json', {
        schema_version: 1,
        resumable: false,
        source: FACTORY_REGISTRY,
        sha256: digest(inspection.legacyFactoryRegistryBytes),
        controller_discovery: 'Only records in this framework registry are discoverable; controllers in arbitrary directories cannot be enumerated.',
      });
      await atomicJson(backup, 'legacy-factory-records.json', {
        schema_version: 1,
        resumable: false,
        projects: inspection.legacyFactoryRecords,
      });
    }
    return { path: backup, archivedFactoryRegistry: inspection.archivedFactoryRegistry };
  } catch (error) {
    await rm(backup, { recursive: true, force: true });
    throw error;
  }
}

async function copyOwnerTree(sourceRoot: string, backupRoot: string, relative: string): Promise<void> {
  const source = path.join(sourceRoot, relative);
  const metadata = await lstat(source);
  if (metadata.isSymbolicLink()) throw new FoundryError('Migration refuses symlinked owner data.');
  const target = path.join(backupRoot, relative);
  if (metadata.isDirectory()) {
    await mkdir(target, { recursive: true, mode: 0o700 });
    const entries = (await readdir(source, { withFileTypes: true }))
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) await copyOwnerTree(sourceRoot, backupRoot, path.join(relative, entry.name));
    await chmod(target, metadata.mode & 0o777);
    return;
  }
  if (!metadata.isFile()) throw new FoundryError('Migration refuses a special file in owner data.');
  const bytes = await readRegularFile(source, 'Migration refuses a special file in owner data.');
  await atomicWrite(backupRoot, relative, bytes);
  await chmod(target, metadata.mode & 0o777);
}

async function preservedRolesFromBackup(root: string, backup: string): Promise<PreservedManagedFiles> {
  const preserved = new Map<string, { bytes: Buffer; mode: number }>();
  const backupRoles = path.join(backup, '.foundry/roles.json');
  let backupStat;
  try {
    backupStat = await lstat(backupRoles);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!backupStat) return preserved;
  if (backupStat.isSymbolicLink() || !backupStat.isFile()) {
    throw new FoundryError('Migration backup contains unsafe preserved owner roles.');
  }
  await loadRoles(backup);
  const bytes = await readRegularFile(backupRoles, 'Migration backup contains an unsupported file type.');
  const ownerRoles = path.join(root, '.foundry/roles.json');
  let ownerStat;
  try {
    ownerStat = await lstat(ownerRoles);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!ownerStat?.isFile() || ownerStat.isSymbolicLink()
    || (ownerStat.mode & 0o777) !== (backupStat.mode & 0o777)
    || !Buffer.from(await readRegularFile(ownerRoles, 'Migration refuses unsafe owner roles.')).equals(bytes)) {
    throw new FoundryError('Migration recovery refuses changed owner roles bytes or mode.');
  }
  preserved.set('.foundry/roles.json', { bytes, mode: backupStat.mode & 0o777 });
  return preserved;
}

export async function migrateWorkspace(
  rootInput: string,
  sourceRootInput: string,
  mode: 'dry-run' | 'apply' | 'recover',
): Promise<JsonRecord> {
  const root = path.resolve(rootInput);
  const sourceRoot = path.resolve(sourceRootInput);
  return withProcessLock(sharedInstallGuardPath(root), async () => {
    const journal = await readObject(root, JOURNAL);
    if (mode === 'recover') {
      if (!journal) throw new FoundryError('No interrupted migration journal is present.');
      const parsed = migrationJournalSchema.safeParse(journal);
      if (!parsed.success || parsed.data.source_root !== sourceRoot
        || path.dirname(parsed.data.backup) !== path.dirname(root)
        || !path.basename(parsed.data.backup).startsWith(`${path.basename(root)}${BACKUP_PREFIX}`)) {
        throw new FoundryError('Migration recovery journal is invalid or bound to a different source.');
      }
      const backupStat = await lstat(parsed.data.backup).catch(() => null);
      if (!backupStat?.isDirectory() || backupStat.isSymbolicLink()) {
        throw new FoundryError('Migration recovery backup is missing or unsafe.');
      }
      if (await backupPin(parsed.data.backup) !== parsed.data.backup_pin) {
        throw new FoundryError('Migration recovery backup changed after it was journaled.');
      }
      const inspection = await inspect(root, sourceRoot, true, false);
      const archive = await readObject(parsed.data.backup, 'legacy-factory-archive.json');
      const expectedFactoryPin = parsed.data.legacy_factory_pin !== undefined
        ? parsed.data.legacy_factory_pin
        : (typeof archive?.sha256 === 'string' && SHA256.test(archive.sha256) ? archive.sha256 : null);
      const actualFactoryPin = inspection.legacyFactoryRegistryBytes
        ? digest(inspection.legacyFactoryRegistryBytes)
        : null;
      if (actualFactoryPin !== expectedFactoryPin) {
        throw new FoundryError('Migration recovery requires the exact legacy Factory registry archived with the backup.');
      }
      const releaseFactoryLocks = await acquireFactoryLocks(sourceRoot, inspection.matchingFactoryRecord, true);
      try {
        const lockedInspection = await inspect(root, sourceRoot, true, false);
        if (lockedInspection.sourcePin !== parsed.data.source_pin
          || (lockedInspection.legacyFactoryRegistryBytes
            ? digest(lockedInspection.legacyFactoryRegistryBytes)
            : null) !== expectedFactoryPin) {
          throw new FoundryError('Migration recovery requires exactly the pinned source runtime and Factory registry.');
        }
        const preservedRoles = await preservedRolesFromBackup(root, parsed.data.backup);
        const installPending = await exists(root, '.foundry/install-pending.json');
        const result = await installWorkspaceWithSharedGuard(
          sourceRoot,
          root,
          true,
          installPending,
          true,
          installPending ? preservedRoles : undefined,
        );
        await rm(path.join(root, JOURNAL), { force: true });
        return {
          ...result,
          migrated: true,
          recovered: true,
          backup: parsed.data.backup,
          archived_factory_registry: await exists(parsed.data.backup, 'legacy-factory-archive.json'),
        };
      } finally {
        await releaseFactoryLocks();
      }
    }
    const inspection = await inspect(root, sourceRoot);
    if (mode === 'dry-run') {
      const releaseFactoryLocks = await acquireFactoryLocks(sourceRoot, inspection.matchingFactoryRecord, false);
      try {
        return {
          root: inspection.root,
          sourceRoot: inspection.sourceRoot,
          sourcePin: inspection.sourcePin,
          legacy: inspection.legacy,
          preserved: inspection.preserved,
          archivedFactoryRegistry: inspection.archivedFactoryRegistry,
          matchingFactoryRecord: Boolean(inspection.matchingFactoryRecord),
          controllerDiscoveryLimitations: 'Controllers in arbitrary directories outside this framework registry cannot be enumerated automatically.',
          would_write: false,
        };
      } finally {
        await releaseFactoryLocks();
      }
    }
    const releaseFactoryLocks = await acquireFactoryLocks(sourceRoot, inspection.matchingFactoryRecord, true);
    try {
      const guardedInspection = await inspect(root, sourceRoot);
      const backupResult = await backupOwnerData(root, sourceRoot, guardedInspection);
      const backup = backupResult.path;
      let journalWritten = false;
      try {
        const currentFactoryPin = guardedInspection.legacyFactoryRegistryBytes
          ? digest(guardedInspection.legacyFactoryRegistryBytes)
          : null;
        const freshFactory = await validateLegacyFactoryRegistry(root, sourceRoot);
        const freshFactoryPin = freshFactory.bytes ? digest(freshFactory.bytes) : null;
        if (await sourcePin(sourceRoot) !== guardedInspection.sourcePin || freshFactoryPin !== currentFactoryPin) {
          throw new FoundryError('Migration source changed during preflight; no project changes were made.');
        }
        const backupDigest = await backupPin(backup);
        const preservedRoles = await preservedRolesFromBackup(root, backup);
        await atomicJson(root, JOURNAL, {
          schema_version: 1,
          runtime: 'typescript',
          source_root: sourceRoot,
          source_pin: guardedInspection.sourcePin,
          legacy_factory_pin: currentFactoryPin,
          backup,
          backup_pin: backupDigest,
          started_at: new Date().toISOString(),
        } satisfies z.infer<typeof migrationJournalSchema>);
        journalWritten = true;
        const result = await installWorkspaceWithSharedGuard(sourceRoot, root, true, false, true, preservedRoles);
        await rm(path.join(root, JOURNAL), { force: true });
        return {
          ...result,
          migrated: true,
          backup,
          archived_factory_registry: backupResult.archivedFactoryRegistry,
          fresh_typed_reviews_required: true,
        };
      } catch (error) {
        const recoverable = journalWritten || await exists(root, JOURNAL);
        if (!recoverable) await rm(backup, { recursive: true, force: true });
        if (recoverable) {
          throw new FoundryError(`Migration was interrupted or refused; recover explicitly with --recover. Backup: ${backup}`, { cause: error });
        }
        throw error;
      }
    } finally {
      await releaseFactoryLocks();
    }
  });
}
