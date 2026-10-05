import { chmod, lstat, mkdir, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import {
  atomicJson, atomicWrite, digest, exists, findProjectRoot, FoundryError, rejectSymlinkComponents,
  expandUserPath, within, withProcessLock,
} from './fs.js';
import { readRuntimeMarker, type RuntimeMarker } from './lifecycle.js';

type JsonRecord = Record<string, unknown>;

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);

const manifestSchema = z.object({
  schema_version: z.literal(1),
  runtime: z.literal('typescript'),
  runtime_version: z.literal('1'),
  installed_at: z.string().min(1),
  source_pin: hashSchema,
  files: z.record(z.string().min(1), hashSchema),
  modes: z.record(z.string().min(1), z.number().int().min(0).max(0o777)),
  updated_from: hashSchema.optional(),
}).strict();

const journalSchema = z.object({
  schema_version: z.literal(1),
  runtime: z.literal('typescript'),
  runtime_version: z.literal('1'),
  started_at: z.string().min(1),
  installed_at: z.string().min(1),
  source_pin: hashSchema,
  incoming: z.record(z.string().min(1), hashSchema),
  previous: z.record(z.string().min(1), hashSchema),
  update: z.boolean(),
}).strict();

type InstallManifest = z.infer<typeof manifestSchema>;
type InstallJournal = z.infer<typeof journalSchema>;

interface ManagedFile {
  source: string;
  target: string;
  mode?: number;
}

async function fileDigest(root: string, relative: string): Promise<string | null> {
  try {
    return digest(await readFile(within(root, relative)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function targetPath(root: string, relative: string): string {
  return within(root, relative);
}

async function removeJournal(root: string): Promise<void> {
  const journal = targetPath(root, '.foundry/install-pending.json');
  await rm(journal, { force: true });
  try {
    const directory = await open(path.dirname(journal), 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch {
    return;
  }
}

async function managedFiles(source: string): Promise<ManagedFile[]> {
  const runtime = path.join(source, 'dist/runtime/project.cjs');
  const roles = path.join(source, '.foundry/roles.json');
  try {
    rejectSymlinkComponents(runtime);
    rejectSymlinkComponents(roles);
    await lstat(runtime);
  } catch (error) {
    if (error instanceof FoundryError) throw error;
    throw new FoundryError(`Built TypeScript runtime is missing; run npm ci && npm run build:runtime: ${runtime}`, { cause: error });
  }
  return [
    { source: runtime, target: '.foundry/runtime/project.cjs', mode: 0o700 },
    { source: roles, target: '.foundry/roles.json', mode: 0o600 },
  ];
}

async function preflight(files: ManagedFile[]): Promise<{ incoming: Record<string, string>; sourceBytes: Map<string, Buffer> }> {
  const incoming: Record<string, string> = {};
  const sourceBytes = new Map<string, Buffer>();
  for (const file of files) {
    rejectSymlinkComponents(file.source);
    const sourceStats = await lstat(file.source);
    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) throw new FoundryError(`Managed source must be a regular file: ${file.source}`);
    const bytes = await readFile(file.source);
    incoming[file.target] = digest(bytes);
    sourceBytes.set(file.target, bytes);
  }
  return { incoming, sourceBytes };
}

export async function install(sourceInput: string, targetInput: string, update = false): Promise<JsonRecord> {
  return installWorkspace(sourceInput, targetInput, update, false);
}

export function sharedInstallGuardPath(target: string): string {
  const normalized = path.resolve(target);
  return path.join(tmpdir(), `product-foundry-install-${digest(normalized).slice(0, 24)}.guard`);
}

export async function installWorkspace(
  sourceInput: string,
  targetInput: string,
  update = false,
  recoverPending = false,
): Promise<JsonRecord> {
  const sourceCandidate = path.resolve(sourceInput);
  rejectSymlinkComponents(sourceCandidate);
  const source = await findProjectRoot(sourceCandidate).catch(() => sourceCandidate);
  if (targetInput.split(/[\\/]+/).includes('..')) {
    throw new FoundryError('Install target must not contain parent traversal');
  }
  const target = path.resolve(expandUserPath(targetInput));
  if (source === target || target.startsWith(`${source}${path.sep}`) || source.startsWith(`${target}${path.sep}`)) {
    throw new FoundryError('Install into a separate product folder, outside the framework checkout.');
  }
  rejectSymlinkComponents(target);
  return withProcessLock(sharedInstallGuardPath(target), async () => {
  const hasRuntimeMarker = await exists(target, '.foundry/runtime.json');
  const hasProjectManifest = await exists(target, '.foundry/project.json');
  const hasPendingJournal = await exists(target, '.foundry/install-pending.json');
  if (hasProjectManifest && !hasRuntimeMarker && !hasPendingJournal) {
    throw new FoundryError('Target is an unmarked or legacy workspace; use the existing Python runtime until an explicit migration command is available.');
  }
  let journal: InstallJournal | null = null;
  if (hasPendingJournal) {
    const parsed = journalSchema.safeParse(JSON.parse(await readFile(targetPath(target, '.foundry/install-pending.json'), 'utf8')));
    if (!parsed.success) {
      throw new FoundryError('Interrupted installation journal is invalid; preserve it and reconcile the target manually.');
    }
    journal = parsed.data;
    if (!recoverPending) {
      throw new FoundryError('An interrupted installation blocks this target; rerun install with --recover from the same pinned source.');
    }
  } else if (recoverPending) {
    throw new FoundryError('No interrupted installation journal is present; run install without --recover.');
  }
  let existingMarker: RuntimeMarker | null = null;
  if (hasRuntimeMarker && !journal) {
    if (!update) throw new FoundryError('Target already has a TypeScript runtime; use update to reconcile managed files.');
    existingMarker = await readRuntimeMarker(target);
    if (!existingMarker) throw new FoundryError('Target has an invalid runtime marker; refusing installation.');
  } else if (hasRuntimeMarker) {
    existingMarker = await readRuntimeMarker(target);
  }
  const files = await managedFiles(source);
  const { incoming, sourceBytes } = await preflight(files);
  const sourcePin = digest(JSON.stringify({ files: incoming, runtime: 1 }));
  if (journal && journal.source_pin !== sourcePin) {
    throw new FoundryError('Recovery requires exactly the pinned source of the interrupted installation.');
  }
  const installedAt = journal?.installed_at ?? existingMarker?.installed_at ?? new Date().toISOString();
  const markerContents = `${JSON.stringify({
    schema_version: 1,
    runtime: 'typescript',
    runtime_version: '1',
    installed_at: installedAt,
    source_pin: sourcePin,
  }, null, 2)}\n`;
  incoming['.foundry/runtime.json'] = digest(markerContents);
  if (journal && Object.keys(incoming).some((relative) => journal?.incoming[relative] !== incoming[relative])) {
    throw new FoundryError('Recovery source does not reproduce every intended managed file in the journal.');
  }
  if (journal && (
    Object.keys(journal.incoming).sort().join('\n') !== Object.keys(incoming).sort().join('\n')
    || Object.keys(journal.previous).some((relative) => !(relative in incoming))
  )) {
    throw new FoundryError('Interrupted installation journal does not describe this managed file set.');
  }
    const pendingNow = await exists(target, '.foundry/install-pending.json');
    if (pendingNow !== Boolean(journal)) {
      throw new FoundryError('Installation state changed while acquiring its lock; inspect the pending journal and retry.');
    }
    if (pendingNow && !recoverPending) {
      throw new FoundryError('An interrupted installation blocks this target; rerun install with --recover from the same pinned source.');
    }
    await mkdir(target, { recursive: true, mode: 0o700 });
    rejectSymlinkComponents(target);
    const manifestPath = targetPath(target, '.foundry/install.json');
    let previous: InstallManifest | null = null;
    if (await exists(target, '.foundry/install.json')) {
      const parsed = manifestSchema.safeParse(JSON.parse(await readFile(manifestPath, 'utf8')));
      if (!parsed.success) {
        throw new FoundryError('Existing install manifest is invalid or uses an unsupported format; reconcile it manually.');
      }
      previous = parsed.data;
      if (!update && !journal) throw new FoundryError('Target is already installed; use update to reconcile managed files.');
      if (!journal) {
        const recorded = previous.files;
        for (const relative of Object.keys(incoming)) {
          const current = await fileDigest(target, relative);
          const expected = recorded[relative];
          if (current !== expected && current !== incoming[relative]) {
            throw new FoundryError(`Managed file conflict: preserve ${relative} and reconcile it before updating.`);
          }
        }
      }
    }
    if (!previous && !journal && (await exists(target, '.foundry/runtime.json') || await exists(target, '.foundry/install.json'))) {
      throw new FoundryError('Target contains runtime or install metadata without a trusted manifest; preserve it and reconcile manually.');
    }
    if (journal) {
      for (const relative of Object.keys(incoming)) {
        const current = await fileDigest(target, relative);
        const captured = journal.previous[relative];
        if (current === null) {
          if (captured !== undefined) {
            throw new FoundryError(`Recovery refuses missing previously managed file ${relative}; preserve the deletion and reconcile manually.`);
          }
          continue;
        }
        if (current !== incoming[relative] && current !== captured) {
          throw new FoundryError(`Recovery refuses modified bytes at ${relative}; preserve and reconcile it manually.`);
        }
      }
    } else if (!previous) {
      for (const relative of Object.keys(incoming)) {
        if (await exists(target, relative)) {
          throw new FoundryError(`Managed target conflict: preserve ${relative} and reconcile it before installing.`);
        }
      }
    }
    const capturedPrevious: Record<string, string> = journal?.previous ?? {};
    if (!journal) {
      for (const relative of Object.keys(incoming)) {
        const current = await fileDigest(target, relative);
        if (current !== null) capturedPrevious[relative] = current;
      }
      await atomicJson(target, '.foundry/install-pending.json', {
        schema_version: 1,
        runtime: 'typescript',
        runtime_version: '1',
        started_at: new Date().toISOString(),
        installed_at: installedAt,
        source_pin: sourcePin,
        incoming,
        previous: capturedPrevious,
        update: Boolean(previous),
      } satisfies InstallJournal);
    }
    const projectPath = targetPath(target, '.foundry/project.json');
    const projectExists = await exists(target, '.foundry/project.json');
    if (projectExists) {
      if ((await lstat(projectPath)).isSymbolicLink()) throw new FoundryError('.foundry/project.json must not be a symlink');
      JSON.parse(await readFile(projectPath, 'utf8'));
    } else {
      await atomicJson(target, '.foundry/project.json', { name: path.basename(target), checks: [] });
    }
    for (const file of files) {
      const bytes = sourceBytes.get(file.target);
      if (!bytes) throw new FoundryError(`Pinned source bytes were not captured for ${file.source}`);
      await atomicWrite(target, file.target, bytes);
      if (file.mode !== undefined) await chmod(targetPath(target, file.target), file.mode);
    }
    await atomicWrite(target, '.foundry/runtime.json', markerContents);
    const modes: Record<string, number> = {};
    for (const file of files) modes[file.target] = file.mode ?? 0o600;
    await atomicJson(target, '.foundry/install.json', {
      schema_version: 1,
      runtime: 'typescript',
      runtime_version: '1',
      installed_at: new Date().toISOString(),
      source_pin: sourcePin,
      files: incoming,
      modes,
      ...(previous ? { updated_from: previous.source_pin } : {}),
    });
    await removeJournal(target);
    return { target, source_pin: sourcePin, updated: Boolean(previous), recovered: Boolean(journal) };
  });
}
