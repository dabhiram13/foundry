import { cp, lstat, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import {
  installWorkspaceWithSharedGuard, sharedInstallGuardPath, validCurrentInstallManifest,
} from './install.js';
import {
  atomicJson, canonicalJson, digest, exists, FoundryError, rejectSymlinkComponents, withProcessLock,
} from './fs.js';
import { activeRun, projectConfig, readRuntimeMarker, validateCompatibleRunState } from './lifecycle.js';
import { FACTORY_CANCEL_LOCK, FACTORY_LOCK, readFactoryState } from './factory-contract.js';
import { savedTaskStatus } from '../runtime/providers.js';

type JsonRecord = Record<string, unknown>;

const migrationJournalSchema = z.object({
  schema_version: z.literal(1),
  runtime: z.literal('typescript'),
  source_root: z.string().min(1),
  source_pin: z.string().regex(/^[a-f0-9]{64}$/),
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
}

const JOURNAL = '.foundry/migration-pending.json';
const BACKUP_PREFIX = '.foundry-migration-backup-';
const FACTORY_REGISTRY = '.foundry/state/factory/projects.json';
const SHA256 = /^[a-f0-9]{64}$/;

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
    const bytes = await readFile(file);
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
  if (!stats.isDirectory()) return;
  for (const entry of await readdir(current, { withFileTypes: true })) {
    await walkNoSymlinks(root, path.join(relative, entry.name));
  }
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
        entries.push({ path: child, mode: stats.mode & 0o777, sha256: digest(await readFile(target)) });
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
    const parsed: unknown = JSON.parse(await readFile(path.join(root, relative), 'utf8'));
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

async function inspect(rootInput: string, sourceRootInput: string, allowPending = false): Promise<MigrationInspection> {
  const root = path.resolve(rootInput);
  const sourceRoot = path.resolve(sourceRootInput);
  rejectSymlinkComponents(root);
  rejectSymlinkComponents(sourceRoot);
  await walkNoSymlinks(root, '.foundry');
  await walkNoSymlinks(root, 'docs');
  await rejectUnsupportedState(root, allowPending);
  const preserved: string[] = [];
  for (const relative of ['.foundry', 'docs']) {
    try {
      await lstat(path.join(root, relative));
      preserved.push(relative);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const registryPath = path.join(sourceRoot, FACTORY_REGISTRY);
  let archivedFactoryRegistry = false;
  try {
    const registryStat = await lstat(registryPath);
    if (registryStat.isSymbolicLink() || !registryStat.isFile()) {
      throw new FoundryError('Migration refuses an unsafe legacy Factory registry.');
    }
    archivedFactoryRegistry = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return {
    root,
    sourceRoot,
    sourcePin: await sourcePin(sourceRoot),
    legacy: true,
    backup: null,
    preserved,
    archivedFactoryRegistry,
  };
}

async function backupOwnerData(root: string, sourceRoot: string): Promise<{ path: string; archivedFactoryRegistry: boolean }> {
  const backup = path.join(path.dirname(root), `${path.basename(root)}${BACKUP_PREFIX}${Date.now()}-${randomUUID().slice(0, 8)}`);
  await mkdir(backup, { recursive: true, mode: 0o700 });
  for (const relative of ['.foundry', 'docs']) {
    try {
      await lstat(path.join(root, relative));
      await cp(path.join(root, relative), path.join(backup, relative), { recursive: true, errorOnExist: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const registrySource = path.join(sourceRoot, FACTORY_REGISTRY);
  let archivedFactoryRegistry = false;
  try {
    const registryStat = await lstat(registrySource);
    if (registryStat.isSymbolicLink() || !registryStat.isFile()) {
      throw new FoundryError('Migration refuses an unsafe legacy Factory registry.');
    }
    await cp(registrySource, path.join(backup, 'legacy-factory-projects.json'), { errorOnExist: true });
    await atomicJson(backup, 'legacy-factory-archive.json', {
      schema_version: 1,
      resumable: false,
      source: FACTORY_REGISTRY,
      sha256: digest(await readFile(registrySource)),
    });
    archivedFactoryRegistry = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return { path: backup, archivedFactoryRegistry };
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
      const inspection = await inspect(root, sourceRoot, true);
      if (inspection.sourcePin !== parsed.data.source_pin) {
        throw new FoundryError('Migration recovery requires exactly the pinned source runtime.');
      }
      const result = await installWorkspaceWithSharedGuard(
        sourceRoot,
        root,
        true,
        await exists(root, '.foundry/install-pending.json'),
        true,
      );
      await rm(path.join(root, JOURNAL), { force: true });
      return {
        ...result,
        migrated: true,
        recovered: true,
        backup: parsed.data.backup,
        archived_factory_registry: await exists(parsed.data.backup, 'legacy-factory-archive.json'),
      };
    }
    const inspection = await inspect(root, sourceRoot);
    if (mode === 'dry-run') {
      return { ...inspection, would_write: false };
    }
    const backupResult = await backupOwnerData(root, sourceRoot);
    const backup = backupResult.path;
    if (await sourcePin(sourceRoot) !== inspection.sourcePin) {
      await rm(backup, { recursive: true, force: true });
      throw new FoundryError('Migration source changed during preflight; no project changes were made.');
    }
    const backupDigest = await backupPin(backup);
    await atomicJson(root, JOURNAL, {
      schema_version: 1,
      runtime: 'typescript',
      source_root: sourceRoot,
      source_pin: inspection.sourcePin,
      backup,
      backup_pin: backupDigest,
      started_at: new Date().toISOString(),
    } satisfies z.infer<typeof migrationJournalSchema>);
    try {
      const result = await installWorkspaceWithSharedGuard(sourceRoot, root, true, false, true);
      await rm(path.join(root, JOURNAL), { force: true });
      return {
        ...result,
        migrated: true,
        backup,
        archived_factory_registry: backupResult.archivedFactoryRegistry,
        fresh_typed_reviews_required: true,
      };
    } catch (error) {
      throw new FoundryError(`Migration was interrupted or refused; recover explicitly with --recover. Backup: ${backup}`, { cause: error });
    }
  });
}
