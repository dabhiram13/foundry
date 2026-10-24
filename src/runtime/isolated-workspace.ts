import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { atomicJson, FoundryError, rejectSymlinkComponents, withProcessLock } from '../core/fs.js';
import type { ManagedSession } from '../core/session-contract.js';
import { projectIdentity, privateDirectory } from './opencode.js';

const imageSchema = z.string().regex(/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/).refine(value => !/\s/.test(value));
const filenameSchema = z.string().min(1).max(512).refine(name =>
  !name.includes('\0') && !name.includes('\\') && !name.includes('\n') && !name.startsWith('/')
  && name.split('/').every(part => part && part !== '.' && part !== '..'));
const recordSchema = z.strictObject({ schemaVersion: z.literal(1), id: z.uuid(), sessionId: z.uuid(),
  root: z.string(), device: z.string(), inode: z.string(), image: imageSchema,
  phase: z.enum(['preparing', 'starting', 'ready', 'executing', 'stopped', 'failed', 'unknown']),
  files: z.number().int().nonnegative().max(2000), bytes: z.number().int().nonnegative().max(64 * 1024 * 1024),
});
type Record = z.infer<typeof recordSchema>;

const MAX_OUTPUT = 64 * 1024;
const DOCKER = '/usr/bin/docker';
const env = { PATH: '/usr/bin:/bin', HOME: '/nonexistent', DOCKER_HOST: 'unix:///var/run/docker.sock' };

async function command(binary: string, args: string[], cwd: string, timeoutMs: number, limit = MAX_OUTPUT): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let excess = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= limit) chunks.push(chunk);
      else { excess = true; child.kill('SIGKILL'); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut || excess) reject(new FoundryError(timedOut ? 'Workspace command timed out' : 'Workspace output exceeded the limit'));
      else resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString('utf8') });
    });
  });
}

async function docker(args: string[], timeoutMs = 10_000): Promise<{ code: number; output: string }> {
  return command(DOCKER, args, '/', timeoutMs);
}

function allowed(relative: string): boolean {
  filenameSchema.parse(relative);
  const parts = relative.split('/');
  return !parts.some(part => part === '.foundry' || part === '.git' || part === 'node_modules'
    || part === '.env' || part.startsWith('.env.') || part === '.npmrc' || part === '.pypirc'
    || part === '.netrc' || part === '.docker' || /\.(pem|key|p12|pfx)$/i.test(part));
}

async function filesFromGit(root: string): Promise<string[]> {
  // Git only selects paths. File bytes are read directly, without filters or hooks.
  const result = await command('/usr/bin/git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--'], root, 10_000, 1024 * 1024);
  if (result.code !== 0) throw new FoundryError('Snapshot needs a Git project');
  const names = result.output.split('\0').filter(Boolean).filter(allowed);
  if (names.length > 2000 || new Set(names).size !== names.length) throw new FoundryError('Too many or duplicate snapshot files');
  return names.sort();
}

async function regularFile(filename: string): Promise<{ bytes: Buffer; mode: number }> {
  rejectSymlinkComponents(filename);
  const info = await lstat(filename);
  if (!info.isFile() || info.nlink !== 1 || info.size > 1024 * 1024) throw new FoundryError('Workspace snapshot requires small regular files');
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = await handle.stat();
    if (info.ino !== current.ino || info.dev !== current.dev || info.size !== current.size || info.mtimeMs !== current.mtimeMs) throw new FoundryError('Source changed during snapshot');
    const bytes = Buffer.alloc(info.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const after = await handle.stat();
    if (bytesRead !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs) throw new FoundryError('Source changed during snapshot');
    return { bytes: bytes.subarray(0, bytesRead), mode: info.mode & 0o777 };
  } finally { await handle.close(); }
}

async function snapshot(root: string, directory: string): Promise<{ files: number; bytes: number }> {
  const names = await filesFromGit(root);
  let total = 0;
  for (const name of names) {
    const { bytes, mode } = await regularFile(path.join(root, name));
    total += bytes.length;
    if (total > 64 * 1024 * 1024) throw new FoundryError('Workspace snapshot exceeds the size limit');
    for (const kind of ['baseline', 'working']) {
      const filename = path.join(directory, kind, name);
      await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
      await writeFile(filename, bytes, { flag: 'wx', mode });
    }
  }
  return { files: names.length, bytes: total };
}

async function tree(directory: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  let entries = 0;
  let total = 0;
  async function walk(folder: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (++entries > 4000) throw new FoundryError('Workspace contains too many entries');
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!allowed(relative)) continue;
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(filename, relative);
      else {
        if (!entry.isFile()) throw new FoundryError('Workspace contains an unsupported file');
        const { bytes } = await regularFile(filename);
        total += bytes.length;
        if (total > 64 * 1024 * 1024) throw new FoundryError('Workspace exceeds the size limit');
        if (result.size >= 2000) throw new FoundryError('Workspace contains too many files');
        result.set(relative, createHash('sha256').update(bytes).digest('hex'));
      }
    }
  }
  await walk(directory);
  return result;
}

export class IsolatedWorkspace {
  private constructor(readonly root: string, readonly parent: string, readonly session: ManagedSession) {}

  static async bind(root: string, storage: string, session: ManagedSession, inspectOnly = false): Promise<IsolatedWorkspace> {
    if (!inspectOnly && !['queued', 'paused', 'awaiting-verification', 'stopped'].includes(session.state.status)) throw new FoundryError('Pause and confirm managed work stopped before opening the owner workspace');
    const parent = path.join(storage, 'workspaces');
    if (parent.includes(',')) throw new FoundryError('Workspace storage cannot contain commas');
    await privateDirectory(parent);
    return new IsolatedWorkspace(root, parent, session);
  }

  private get directory(): string { return path.join(this.parent, this.session.id); }
  private get name(): string { return `foundry-ws-${this.session.id}`; }
  private async locked<T>(fn: () => Promise<T>): Promise<T> { return withProcessLock(path.join(this.parent, `${this.session.id}.lock`), fn); }
  private async read(): Promise<Record> {
    await privateDirectory(this.directory);
    const filename = path.join(this.directory, 'record.json');
    const info = await lstat(filename);
    if (!info.isFile() || info.nlink !== 1 || info.uid !== process.getuid!() || (info.mode & 0o077) || info.size > 4096) throw new FoundryError('Workspace record needs inspection');
    const record = recordSchema.parse(JSON.parse(await readFile(filename, 'utf8')));
    const identity = await projectIdentity(this.root);
    if (record.sessionId !== this.session.id || record.root !== identity.root || record.device !== identity.device || record.inode !== identity.inode) throw new FoundryError('Workspace belongs to another project');
    return record;
  }
  private async save(record: Record): Promise<void> { await atomicJson(this.directory, 'record.json', record); }

  private async present(): Promise<boolean> {
    const result = await docker(['container', 'ls', '-aq', '--filter', `name=^/${this.name}$`]);
    if (result.code !== 0) throw new FoundryError('Docker inspection failed');
    return Boolean(result.output.trim());
  }

  private async running(): Promise<boolean> {
    const result = await docker(['inspect', '--format', '{{.State.Running}}', this.name]);
    if (result.code !== 0 || !['true', 'false'].includes(result.output.trim())) throw new FoundryError('Docker running state needs inspection');
    return result.output.trim() === 'true';
  }

  private async remove(): Promise<void> {
    if (await this.present()) {
      const result = await docker(['rm', '-f', this.name]);
      if (result.code !== 0 && await this.present()) throw new FoundryError('Docker shutdown could not be confirmed');
    }
    if (await this.present()) throw new FoundryError('Docker resource remains after shutdown');
  }

  private async startContainer(record: Record): Promise<void> {
    const inspected = await docker(['image', 'inspect', '--format', '{{.Id}}', record.image]);
    if (inspected.code !== 0 || !/^sha256:[a-f0-9]{64}\s*$/.test(inspected.output)) throw new FoundryError('Pull and inspect the selected digest-pinned image first');
    record.phase = 'starting';
    await this.save(record);
    const created = await docker(['create', '--name', this.name, '--network', 'none', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--pids-limit', '128', '--memory', '512m', '--cpus', '1',
      '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--user', `${process.getuid!()}:${process.getgid!()}`,
      '--mount', `type=bind,source=${path.join(this.directory, 'working')},target=/workspace`,
      '--workdir', '/workspace', '--env', 'HOME=/tmp', record.image, 'node', '-e', 'setInterval(() => {}, 60000)']);
    if (created.code !== 0) throw new FoundryError('Docker could not create the workspace');
    const started = await docker(['start', this.name]);
    if (started.code !== 0) throw new FoundryError('Docker could not start the workspace');
    const version = await docker(['exec', this.name, 'node', '--version']);
    const major = /^v(\d+)\.\d+\.\d+/.exec(version.output.trim())?.[1];
    if (version.code !== 0 || !major || Number(major) < 24) throw new FoundryError('Selected image must run Node 24 or newer');
    record.phase = 'ready';
    await this.save(record);
  }

  async open(imageInput: string): Promise<Record> {
    if (process.platform !== 'linux' || !process.getuid || process.getuid() === 0) throw new FoundryError('Isolated owner workspace requires a non-root Linux host');
    const image = imageSchema.parse(imageInput);
    return this.locked(async () => {
      // Do not pull automatically: image selection and download are owner decisions.
      const inspected = await docker(['image', 'inspect', '--format', '{{.Id}}', image]);
      if (inspected.code !== 0 || !/^sha256:[a-f0-9]{64}\s*$/.test(inspected.output)) throw new FoundryError('Pull and inspect the selected digest-pinned image first');
      const identity = await projectIdentity(this.root);
      await mkdir(this.directory, { mode: 0o700 }); // An orphaned directory must be inspected, not overwritten.
      const record: Record = { schemaVersion: 1, id: randomUUID(), sessionId: this.session.id,
        root: identity.root, device: identity.device, inode: identity.inode, image,
        phase: 'preparing', files: 0, bytes: 0 };
      await this.save(record);
      try {
        await mkdir(path.join(this.directory, 'baseline'), { mode: 0o700 });
        await mkdir(path.join(this.directory, 'working'), { mode: 0o700 });
        Object.assign(record, await snapshot(this.root, this.directory));
        await this.startContainer(record);
        return record;
      } catch (error) {
        try { await this.remove(); record.phase = 'failed'; }
        catch { record.phase = 'unknown'; }
        await this.save(record);
        throw error;
      }
    });
  }

  async resume(): Promise<Record> {
    return this.locked(async () => {
      const record = await this.read();
      if (record.phase !== 'stopped' || await this.present()) throw new FoundryError('Workspace requires confirmed stop before resuming');
      await tree(path.join(this.directory, 'baseline'));
      await tree(path.join(this.directory, 'working'));
      try { await this.startContainer(record); }
      catch (error) {
        try { await this.remove(); record.phase = 'stopped'; }
        catch { record.phase = 'unknown'; }
        await this.save(record);
        throw error;
      }
      return record;
    });
  }

  async status(): Promise<{ record: Record; containerPresent: boolean }> {
    return { record: await this.read(), containerPresent: await this.present() };
  }

  async exec(argv: string[], deadlineMs = 30_000): Promise<{ exitCode: number; output: string }> {
    z.array(z.string().min(1).max(512).refine(arg => !arg.includes('\0'))).min(1).max(32).parse(argv);
    z.number().int().min(100).max(30_000).parse(deadlineMs);
    return this.locked(async () => {
      const record = await this.read();
      if (record.phase !== 'ready' || !(await this.present()) || !(await this.running())) throw new FoundryError('Workspace is not ready; inspect or recover it');
      record.phase = 'executing';
      await this.save(record);
      try {
        const result = await docker(['exec', '--user', `${process.getuid!()}:${process.getgid!()}`, '--workdir', '/workspace', this.name, ...argv], deadlineMs);
        record.phase = 'ready';
        await this.save(record);
        return { exitCode: result.code, output: result.output };
      } catch (error) {
        try { await this.remove(); record.phase = 'stopped'; }
        catch { record.phase = 'unknown'; }
        await this.save(record);
        throw error;
      }
    });
  }

  async diff(): Promise<{ path: string; status: 'added' | 'modified' | 'deleted'; patch: string }[]> {
    return this.locked(async () => {
      const record = await this.read();
      if (record.phase !== 'stopped' || await this.present()) throw new FoundryError('Confirm workspace stop before reading its diff');
      const before = await tree(path.join(this.directory, 'baseline'));
      const after = await tree(path.join(this.directory, 'working'));
      const result: { path: string; status: 'added' | 'modified' | 'deleted'; patch: string }[] = [];
      let size = 0;
      for (const name of [...new Set([...before.keys(), ...after.keys()])].sort()) {
        if (before.get(name) === after.get(name)) continue;
        const status = !before.has(name) ? 'added' : !after.has(name) ? 'deleted' : 'modified';
        const oldPath = before.has(name) ? path.join(this.directory, 'baseline', name) : '/dev/null';
        const newPath = after.has(name) ? path.join(this.directory, 'working', name) : '/dev/null';
        const patch = await command('/usr/bin/diff', ['-u', '--label', `a/${name}`, '--label', `b/${name}`, oldPath, newPath], '/', 10_000);
        if (patch.code !== 1 && patch.code !== 0) throw new FoundryError('Cannot inspect workspace diff');
        size += patch.output.length;
        if (size > MAX_OUTPUT) throw new FoundryError('Workspace diff exceeds the limit');
        result.push({ path: name, status, patch: patch.output });
      }
      return result;
    });
  }

  async stop(): Promise<Record> {
    await this.read();
    // Interrupt an active exec before waiting for its operation lock to drain.
    await this.remove();
    const deadline = Date.now() + 5000;
    for (;;) {
      try {
        return await this.locked(async () => {
          const record = await this.read();
          await this.remove();
          record.phase = 'stopped';
          await this.save(record);
          return record;
        });
      } catch (error) {
        if (!(error instanceof FoundryError) || !error.message.startsWith('Another process owns this lock') || Date.now() >= deadline) throw error;
        await delay(50);
      }
    }
  }

  async assertNotActive(): Promise<void> {
    return this.locked(async () => {
      const info = await lstat(this.directory).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      });
      if (!info) return;
      const record = await this.read();
      if (record.phase !== 'stopped' && record.phase !== 'failed') throw new FoundryError('Stop and inspect the owner workspace before running the executor');
      if (await this.present()) throw new FoundryError('An owner workspace resource is unresolved');
    });
  }
}
