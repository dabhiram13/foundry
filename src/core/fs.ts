import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, statSync } from 'node:fs';
import { access, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

export class FoundryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FoundryError';
  }
}

export function now(): string {
  return new Date().toISOString();
}

export function digest(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function pythonString(value: string): string {
  return JSON.stringify(value).replace(/[^\x00-\x7f]/gu, (character) => {
    const point = character.codePointAt(0);
    if (point === undefined) return character;
    if (point <= 0xffff) return `\\u${point.toString(16).padStart(4, '0')}`;
    const adjusted = point - 0x10000;
    const high = 0xd800 + (adjusted >> 10);
    const low = 0xdc00 + (adjusted & 0x3ff);
    return `\\u${high.toString(16)}\\u${low.toString(16)}`;
  });
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return pythonString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new FoundryError('Cannot encode a non-finite JSON number');
    return Object.is(value, -0) ? '-0.0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, child]) => `${pythonString(key)}:${canonical(child)}`).join(',')}}`;
  }
  throw new FoundryError('Value is not JSON serializable');
}

export function canonicalJson(value: unknown): string {
  return canonical(value);
}

export function digestJson(value: unknown): string {
  return digest(canonicalJson(value));
}

export function rejectSymlinkComponents(candidate: string): void {
  const absolute = path.resolve(candidate);
  const { root } = path.parse(absolute);
  let current = root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  for (const part of parts) {
    current = path.join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new FoundryError(`Symlink paths are not allowed: ${current}`);
      }
    } catch (error) {
      if (error instanceof FoundryError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function within(root: string, relative: string): string {
  if (typeof relative !== 'string' || !relative || relative.includes('\0') || relative.includes('\\')) {
    throw new FoundryError('Project paths must be nonempty portable relative paths');
  }
  if (path.isAbsolute(relative) || path.win32.isAbsolute(relative) || relative.startsWith('//')) {
    throw new FoundryError('Absolute project paths are not allowed');
  }
  const parts = relative.split('/');
  if (parts.some((part) => part === '..')) throw new FoundryError('Project path escapes the workspace');
  const base = path.resolve(root);
  rejectSymlinkComponents(base);
  const target = path.resolve(base, ...parts.filter((part) => part && part !== '.'));
  if (!isWithin(base, target)) throw new FoundryError('Project path escapes the workspace');
  rejectSymlinkComponents(target);
  return target;
}

export function projectRelative(root: string, candidate: string): string {
  const absolute = path.resolve(candidate);
  const base = path.resolve(root);
  rejectSymlinkComponents(base);
  rejectSymlinkComponents(absolute);
  if (!isWithin(base, absolute)) throw new FoundryError('Evidence path escapes the workspace');
  const relative = path.relative(base, absolute).split(path.sep).join('/');
  return relative || '.';
}

export function normalizeLocalPath(root: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new FoundryError('A project-relative path is required');
  const name = value.replaceAll('\\', '/');
  const normalized = path.posix.normalize(name);
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || normalized === '..' || normalized.startsWith('../')) {
    throw new FoundryError('Path must remain inside the project');
  }
  if (normalized.split('/').includes('.git')) throw new FoundryError('Git internals cannot be used as evidence');
  const absolute = within(root, normalized);
  return projectRelative(root, absolute);
}

function ensureAbsoluteDirectories(directory: string): void {
  const absolute = path.resolve(directory);
  rejectSymlinkComponents(absolute);
  const { root } = path.parse(absolute);
  let current = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stats = lstatSync(current);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new FoundryError(`Expected a non-symlink directory: ${current}`);
      }
    } catch (error) {
      if (error instanceof FoundryError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      mkdirSyncSafe(current);
    }
  }
}

function mkdirSyncSafe(directory: string): void {
  const parent = path.dirname(directory);
  rejectSymlinkComponents(parent);
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  rejectSymlinkComponents(directory);
  if (!statSync(directory).isDirectory()) throw new FoundryError(`Expected a directory: ${directory}`);
}

export async function readJson<T = unknown>(absolutePath: string): Promise<T> {
  rejectSymlinkComponents(absolutePath);
  try {
    return JSON.parse(await readFile(absolutePath, 'utf8')) as T;
  } catch (error) {
    throw new FoundryError(`Cannot read JSON ${absolutePath}: ${(error as Error).message}`, { cause: error });
  }
}

export async function atomicWrite(root: string, relative: string, contents: string | Uint8Array, mode = 0o600): Promise<void> {
  const absolute = within(root, relative);
  const parent = path.dirname(absolute);
  ensureAbsoluteDirectories(parent);
  rejectSymlinkComponents(absolute);
  const temporary = path.join(parent, `.foundry-write-${randomUUID()}`);
  const handle = await open(temporary, 'wx', mode);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    rejectSymlinkComponents(parent);
    rejectSymlinkComponents(absolute);
    await rename(temporary, absolute);
    try {
      const directory = await open(parent, 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch {
      // Some filesystems do not support syncing a directory handle.
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function atomicJson(root: string, relative: string, value: unknown): Promise<void> {
  await atomicWrite(root, relative, `${JSON.stringify(value, null, 2)}\n`);
}

export async function ensureDirectory(root: string, relative: string): Promise<string> {
  const absolute = within(root, relative);
  ensureAbsoluteDirectories(absolute);
  rejectSymlinkComponents(absolute);
  return absolute;
}

const lockBusyMessage = 'Another process owns this lock; retry after it finishes';

async function acquireReclaimGuard(absolute: string): Promise<{ absolute: string; token: string }> {
  const guard = `${absolute}.reclaim`;
  rejectSymlinkComponents(guard);
  try {
    await mkdir(guard, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new FoundryError(lockBusyMessage);
    throw error;
  }
  const token = randomUUID();
  const ownerPath = path.join(guard, 'owner.json');
  try {
    const handle = await open(ownerPath, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, started_at: now() }));
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    throw new FoundryError('Cannot establish lock reclamation guard ownership', { cause: error });
  }
  return { absolute: guard, token };
}

async function releaseReclaimGuard(guard: { absolute: string; token: string }): Promise<boolean> {
  try {
    const owner = JSON.parse(await readFile(path.join(guard.absolute, 'owner.json'), 'utf8')) as { token?: string };
    if (owner.token !== guard.token) return false;
    await rm(guard.absolute, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

async function reclaimDeadLock(absolute: string): Promise<boolean> {
  let owner: { pid?: number; token?: string };
  try {
    const ownerPath = path.join(absolute, 'owner.json');
    rejectSymlinkComponents(ownerPath);
    owner = JSON.parse(await readFile(ownerPath, 'utf8')) as { pid?: number; token?: string };
  } catch {
    return false;
  }
  if (!Number.isSafeInteger(owner.pid) || Number(owner.pid) <= 0 || typeof owner.token !== 'string' || !owner.token) return false;
  try {
    process.kill(Number(owner.pid), 0);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false;
  }
  try {
    const ownerPath = path.join(absolute, 'owner.json');
    rejectSymlinkComponents(ownerPath);
    const current = JSON.parse(await readFile(ownerPath, 'utf8')) as { pid?: number; token?: string };
    if (current.pid !== owner.pid || current.token !== owner.token) return false;
    await rm(absolute, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export async function withProcessLock<T>(lockPath: string, action: () => Promise<T>): Promise<T> {
  const absolute = path.resolve(lockPath);
  ensureAbsoluteDirectories(path.dirname(absolute));
  rejectSymlinkComponents(absolute);
  const guard = await acquireReclaimGuard(absolute);
  const token = randomUUID();
  const owner = path.join(absolute, 'owner.json');
  let lockEstablished = false;
  let guardReleased = false;
  try {
    try {
      await mkdir(absolute, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (!(await reclaimDeadLock(absolute))) throw new FoundryError(lockBusyMessage);
      try {
        await mkdir(absolute, { mode: 0o700 });
      } catch (createError) {
        if ((createError as NodeJS.ErrnoException).code === 'EEXIST') throw new FoundryError(lockBusyMessage);
        throw createError;
      }
    }
    const handle = await open(owner, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, started_at: now() }));
      await handle.sync();
    } finally {
      await handle.close();
    }
    lockEstablished = true;
    guardReleased = await releaseReclaimGuard(guard);
    if (!guardReleased) throw new FoundryError('Cannot release lock reclamation guard safely');
    return await action();
  } finally {
    if (!guardReleased) await releaseReclaimGuard(guard);
    if (lockEstablished) {
      try {
        const current = JSON.parse(await readFile(owner, 'utf8')) as { token?: string };
        if (current.token === token) await rm(absolute, { recursive: true });
      } catch {
        // A lock whose ownership cannot be established is deliberately left in place.
      }
    }
  }
}

export async function readFileIfPresent(absolutePath: string): Promise<Buffer | null> {
  rejectSymlinkComponents(absolutePath);
  try {
    return await readFile(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function fileMode(absolutePath: string): number | null {
  rejectSymlinkComponents(absolutePath);
  try {
    return statSync(absolutePath).mode & 0o777;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function expandUserPath(value: string): string {
  if (value === '~') return process.env.HOME ?? value;
  if (value.startsWith('~/')) return path.join(process.env.HOME ?? '', value.slice(2));
  return value;
}

export async function findProjectRoot(value: string): Promise<string> {
  const initial = path.resolve(expandUserPath(value));
  rejectSymlinkComponents(initial);
  let candidate = initial;
  try {
    if (!(await stat(candidate)).isDirectory()) {
      candidate = path.dirname(candidate);
    }
  } catch {
    throw new FoundryError(`Project directory does not exist: ${initial}`);
  }
  for (;;) {
    const config = path.join(candidate, '.foundry/project.json');
    rejectSymlinkComponents(config);
    try {
      const stats = await (await import('node:fs/promises')).stat(config);
      if (stats.isFile()) {
        const pending = path.join(candidate, '.foundry/install-pending.json');
        rejectSymlinkComponents(pending);
        try {
          await access(pending);
          throw new FoundryError('Found an interrupted installation journal; recover the install before continuing');
        } catch (error) {
          if (error instanceof FoundryError) throw error;
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        return candidate;
      }
    } catch (error) {
      if (error instanceof FoundryError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  throw new FoundryError(`No Foundry project found from ${initial}`);
}

export async function exists(root: string, relative: string): Promise<boolean> {
  const absolute = within(root, relative);
  try {
    await access(absolute);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
