import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { access, lstat, mkdir, mkdtemp, open, opendir, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createOpencodeClient, type Config } from '@opencode-ai/sdk/v2/client';
import { z } from 'zod';
import { atomicJson, canonicalJson, rejectSymlinkComponents, withProcessLock } from '../core/fs.js';

export const OPENCODE_VERSION = '1.19.0';
const BODY_LIMIT = 65_536;
const OUTPUT_LIMIT = 65_536;
const absolutePath = z.string().min(1).max(4096).refine(value => path.isAbsolute(value) && !value.includes('\0'));
const profileSchema = z.strictObject({
  purpose: z.literal('lifecycle-only'), binary: absolutePath, project: absolutePath, runtimeParent: absolutePath,
  binaryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  deadlineMs: z.number().int().min(500).max(30_000).default(15_000),
  shutdownMs: z.number().int().min(100).max(5000).default(2000),
});
const projectSchema = z.strictObject({ root: absolutePath, device: z.string(), inode: z.string() });
const sessionId = z.string().regex(/^ses_[a-zA-Z0-9_-]{1,100}$/);
const upstreamSchema = z.object({ id: sessionId, directory: absolutePath, projectID: z.string().min(1).max(128) });
const codes = z.enum(['invalid-profile', 'runtime-unresolved', 'startup-failed', 'output-limit', 'deadline', 'http-failed', 'body-limit', 'protocol-invalid', 'version-mismatch', 'authentication-missing', 'configuration-unsafe', 'binding-changed', 'shutdown-unconfirmed', 'record-failed']);
type FailureCode = z.infer<typeof codes>;
const recordSchema = z.strictObject({
  schemaVersion: z.literal(1), purpose: z.literal('lifecycle-only'), project: projectSchema,
  binary: absolutePath, binaryDigest: z.string().regex(/^[a-f0-9]{64}$/), sdkVersion: z.literal(OPENCODE_VERSION),
  phase: z.enum(['launching', 'running', 'stopped', 'unknown']), pid: z.number().int().positive().nullable(),
  upstreamSessionId: sessionId.nullable(), failure: codes.nullable(),
});
type LaunchRecord = z.infer<typeof recordSchema>;

export class OpenCodeLifecycleError extends Error {
  constructor(readonly code: FailureCode, readonly resourcesStopped: boolean, readonly recordDirectory?: string) {
    super(`OpenCode lifecycle: ${code}`);
    this.name = 'OpenCodeLifecycleError';
  }
}

function fail(code: FailureCode): never { throw new OpenCodeLifecycleError(code, false); }
function nested(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function projectIdentity(root: string): Promise<z.infer<typeof projectSchema>> {
  rejectSymlinkComponents(root);
  const canonical = await realpath(root);
  const info = await lstat(canonical, { bigint: true });
  if (!info.isDirectory()) fail('invalid-profile');
  return { root: canonical, device: String(info.dev), inode: String(info.ino) };
}

export async function privateDirectory(directory: string): Promise<void> {
  if (!process.getuid || process.platform === 'win32') fail('invalid-profile');
  rejectSymlinkComponents(directory);
  for (let current = directory; ; current = path.dirname(current)) {
    try { await lstat(path.join(current, '.git')); fail('invalid-profile'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (current === path.dirname(current)) break;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  rejectSymlinkComponents(directory);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o077)) fail('invalid-profile');
}

async function assertResolved(parent: string, deadline: number): Promise<void> {
  for await (const entry of await opendir(parent)) {
    if (Date.now() >= deadline) fail('runtime-unresolved');
    if (!entry.name.startsWith('opencode-')) continue;
    const directory = path.join(parent, entry.name);
    await privateDirectory(directory);
    const filename = path.join(directory, 'launch.json');
    const info = await lstat(filename);
    if (!info.isFile() || info.nlink !== 1 || info.uid !== process.getuid!() || (info.mode & 0o077) || info.size > 16_384) fail('runtime-unresolved');
    const record = recordSchema.parse(JSON.parse(await readFile(filename, 'utf8')));
    if (record.phase !== 'stopped') fail('runtime-unresolved');
  }
}

const configuration = {
  permission: { '*': 'deny' }, plugin: [], mcp: {}, instructions: [],
  snapshot: false, share: 'disabled', autoupdate: false, lsp: false, formatter: false,
} satisfies Config;
const safeConfigurationSchema = z.object({
  permission: z.strictObject({ '*': z.literal('deny') }),
  plugin: z.array(z.never()).optional(), mcp: z.record(z.string(), z.never()).optional(),
  instructions: z.array(z.never()).optional(), snapshot: z.literal(false), share: z.literal('disabled'),
  autoupdate: z.literal(false), lsp: z.literal(false), formatter: z.literal(false),
});

export async function executableStamp(filename: string): Promise<string> {
  rejectSymlinkComponents(filename);
  const info = await lstat(filename, { bigint: true });
  return [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].map(String).join(':');
}

export async function executableDigest(filename: string): Promise<string> {
  const hash = createHash('sha256');
  let bytes = 0;
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      bytes += chunk.length;
      if (bytes > 536_870_912) fail('invalid-profile');
      hash.update(chunk);
    }
  } finally { await handle.close(); }
  return hash.digest('hex');
}

export function openCodeEnvironment(directory: string, password: string, config: Config = configuration): NodeJS.ProcessEnv {
  return {
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: path.join(directory, 'home'),
    XDG_CONFIG_HOME: path.join(directory, 'config'), XDG_DATA_HOME: path.join(directory, 'data'),
    XDG_STATE_HOME: path.join(directory, 'state'), XDG_CACHE_HOME: path.join(directory, 'cache'),
    TMPDIR: path.join(directory, 'tmp'), LANG: 'C.UTF-8', TZ: 'UTC',
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config), OPENCODE_PURE: '1',
    OPENCODE_TEST_MANAGED_CONFIG_DIR: path.join(directory, 'managed'),
    OPENCODE_DISABLE_PROJECT_CONFIG: '1', OPENCODE_DISABLE_DEFAULT_PLUGINS: '1',
    OPENCODE_DISABLE_EXTERNAL_SKILLS: '1', OPENCODE_DISABLE_CLAUDE_CODE: '1',
    OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: '1', OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_SHARE: '1', OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
    OPENCODE_SERVER_USERNAME: 'foundry', OPENCODE_SERVER_PASSWORD: password,
  };
}

function processGroupMissing(pid: number): boolean {
  try { process.kill(-pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; }
}

export async function stopServer(child: ChildProcess, shutdownMs: number, closed: () => boolean): Promise<boolean> {
  if (!child.pid) {
    const end = Date.now() + shutdownMs;
    while (!closed() && Date.now() < end) await delay(20);
    return closed();
  }
  const pid = child.pid;
  const signal = (value: NodeJS.Signals) => {
    try { process.kill(-pid, value); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false; }
    return true;
  };
  if (!signal('SIGTERM')) return false;
  const end = Date.now() + shutdownMs;
  const escalate = Date.now() + Math.floor(shutdownMs / 2);
  let killed = false;
  while (Date.now() < end) {
    if (closed() && processGroupMissing(pid)) return true;
    if (!killed && Date.now() >= escalate) { if (!signal('SIGKILL')) return false; killed = true; }
    await delay(20);
  }
  return closed() && processGroupMissing(pid);
}

export function serverAddress(child: ChildProcess, controller: AbortController): Promise<string> {
  const { signal } = controller;
  return new Promise((resolve, reject) => {
    let stdout = '';
    let bytes = 0;
    const abort = () => reject(new OpenCodeLifecycleError('deadline', false));
    signal.addEventListener('abort', abort, { once: true });
    const output = (chunk: Buffer, isStdout: boolean) => {
      bytes += chunk.byteLength;
      if (bytes > OUTPUT_LIMIT) { controller.abort('output-limit'); reject(new OpenCodeLifecycleError('output-limit', false)); return; }
      if (isStdout) {
        stdout += chunk.toString('utf8');
        const match = stdout.match(/(?:^|\n)opencode server listening on (http:\/\/127\.0\.0\.1:([0-9]{1,5}))\r?\n/);
        if (match && Number(match[2]) > 0 && Number(match[2]) <= 65_535) resolve(match[1]!);
      }
    };
    child.stdout!.on('data', chunk => output(chunk, true));
    child.stderr!.on('data', chunk => output(chunk, false));
    child.once('error', () => reject(new OpenCodeLifecycleError('startup-failed', false)));
    child.once('close', () => { signal.removeEventListener('abort', abort); reject(new OpenCodeLifecycleError('startup-failed', false)); });
    if (signal.aborted) abort();
  });
}

export async function localRequest(request: Request, signal: AbortSignal): Promise<Response> {
  const body = request.body ? Buffer.from(await request.arrayBuffer()) : null;
  if (body && body.byteLength > BODY_LIMIT) fail('body-limit');
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(request.url, { method: request.method, headers: Object.fromEntries(request.headers), agent: false, signal }, response => {
      void (async () => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        if (Number(response.headers['content-length']) > BODY_LIMIT) { response.destroy(); fail('body-limit'); }
        for await (const chunk of response) {
          const data = Buffer.from(chunk as Uint8Array);
          bytes += data.byteLength;
          if (bytes > BODY_LIMIT) { response.destroy(); fail('body-limit'); }
          chunks.push(data);
        }
        const headers = new Headers();
        for (let i = 0; i < response.rawHeaders.length; i += 2) headers.append(response.rawHeaders[i]!, response.rawHeaders[i + 1]!);
        const status = response.statusCode ?? 500;
        if (status >= 300 && status < 400) fail('http-failed');
        resolve(new Response(status === 204 ? null : Buffer.concat(chunks), { status, headers }));
      })().catch(reject);
    });
    outgoing.once('error', reject);
    outgoing.end(body);
  });
}

export type OpenCodeQualification = {
  purpose: 'lifecycle-only'; sdkVersion: typeof OPENCODE_VERSION; binaryDigest: string;
  project: z.infer<typeof projectSchema>; upstreamSessionId: string; recordDirectory: string;
  resourcesStopped: true; modelExecuted: false; activeAbortQualified: false;
};

export async function qualifyOpenCode(input: unknown): Promise<OpenCodeQualification> {
  let profile: z.infer<typeof profileSchema>;
  let project: z.infer<typeof projectSchema>;
  let binaryDigest: string;
  let binaryStamp: string;
  try {
    profile = profileSchema.parse(input);
    if (process.platform === 'win32' || !process.getuid) fail('invalid-profile');
    rejectSymlinkComponents(profile.binary);
    const binary = await lstat(profile.binary);
    if (!binary.isFile() || binary.size > 536_870_912) fail('invalid-profile');
    await access(profile.binary, constants.X_OK);
    project = await projectIdentity(profile.project);
    if (nested(project.root, profile.runtimeParent) || nested(profile.runtimeParent, project.root)) fail('invalid-profile');
    await privateDirectory(profile.runtimeParent);
    binaryStamp = await executableStamp(profile.binary);
    binaryDigest = await executableDigest(profile.binary);
    if (await executableStamp(profile.binary) !== binaryStamp) fail('invalid-profile');
    if (binaryDigest !== profile.binaryDigest) fail('invalid-profile');
  } catch { throw new OpenCodeLifecycleError('invalid-profile', true); }

  return withProcessLock(path.join(profile.runtimeParent, 'qualification.lock'), async () => {
    const deadline = Date.now() + profile.deadlineMs;
    try { await assertResolved(profile.runtimeParent, deadline); }
    catch { throw new OpenCodeLifecycleError('runtime-unresolved', false); }
    if (await executableStamp(profile.binary) !== binaryStamp) throw new OpenCodeLifecycleError('binding-changed', true);
    const directory = await mkdtemp(path.join(profile.runtimeParent, 'opencode-'));
    for (const name of ['home', 'config', 'data', 'state', 'cache', 'tmp', 'managed']) await mkdir(path.join(directory, name), { mode: 0o700 });
    const record: LaunchRecord = { schemaVersion: 1, purpose: 'lifecycle-only', project, binary: profile.binary, binaryDigest, sdkVersion: OPENCODE_VERSION, phase: 'launching', pid: null, upstreamSessionId: null, failure: null };
    await atomicJson(directory, 'launch.json', record);
    if (Date.now() >= deadline) {
      record.phase = 'stopped'; record.failure = 'deadline';
      await atomicJson(directory, 'launch.json', record);
      throw new OpenCodeLifecycleError('deadline', true, directory);
    }
    const password = randomBytes(32).toString('hex');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
    const child = spawn(profile.binary, ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
      cwd: project.root, env: openCodeEnvironment(directory, password), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let closed = false;
    child.once('close', () => { closed = true; });
    let result: OpenCodeQualification | undefined;
    let failure: FailureCode | null = null;
    try {
      const address = serverAddress(child, controller);
      void address.catch(() => {});
      record.pid = child.pid ?? null;
      record.phase = 'running';
      await atomicJson(directory, 'launch.json', record);
      const origin = await address;
      const limitedFetch: typeof fetch = async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (url.origin !== origin || url.username || url.password || url.hash) fail('http-failed');
        return localRequest(request, controller.signal);
      };
      const authCheck = await limitedFetch(`${origin}/session?directory=${encodeURIComponent(project.root)}`);
      if (authCheck.status !== 401) fail('authentication-missing');
      const client = createOpencodeClient({ baseUrl: origin, directory: project.root, fetch: limitedFetch, throwOnError: true,
        headers: { Authorization: `Basic ${Buffer.from(`foundry:${password}`).toString('base64')}` } });
      const health = z.object({ healthy: z.literal(true), version: z.string() }).parse((await client.global.health()).data);
      if (health.version !== OPENCODE_VERSION) fail('version-mismatch');
      if (!safeConfigurationSchema.safeParse((await client.config.get({ directory: project.root })).data).success) fail('configuration-unsafe');
      const session = upstreamSchema.parse((await client.session.create({ directory: project.root, title: 'Foundry lifecycle qualification', permission: [{ permission: '*', pattern: '*', action: 'deny' }] })).data);
      record.upstreamSessionId = session.id;
      await atomicJson(directory, 'launch.json', record);
      if (session.directory !== project.root) fail('binding-changed');
      const inspected = upstreamSchema.parse((await client.session.get({ directory: project.root, sessionID: session.id })).data);
      if (canonicalJson(inspected) !== canonicalJson(session)) fail('binding-changed');
      if ((await client.session.abort({ directory: project.root, sessionID: session.id })).data !== true) fail('protocol-invalid');
      if ((await client.session.delete({ directory: project.root, sessionID: session.id })).data !== true) fail('protocol-invalid');
      if (canonicalJson(await projectIdentity(project.root)) !== canonicalJson(project)) fail('binding-changed');
      if (await executableStamp(profile.binary) !== binaryStamp) fail('binding-changed');
      if (controller.signal.aborted) fail('deadline');
      result = { purpose: 'lifecycle-only', sdkVersion: OPENCODE_VERSION, binaryDigest, project, upstreamSessionId: session.id, recordDirectory: directory, resourcesStopped: true, modelExecuted: false, activeAbortQualified: false };
    } catch (error) {
      failure = controller.signal.aborted ? controller.signal.reason === 'output-limit' ? 'output-limit' : 'deadline'
        : error instanceof OpenCodeLifecycleError ? error.code : 'protocol-invalid';
    } finally {
      clearTimeout(timeout);
      controller.abort();
      const stopped = await stopServer(child, profile.shutdownMs, () => closed);
      record.phase = stopped ? 'stopped' : 'unknown';
      record.failure = stopped ? failure : 'shutdown-unconfirmed';
      try { await atomicJson(directory, 'launch.json', record); }
      catch { throw new OpenCodeLifecycleError('record-failed', stopped, directory); }
      if (!stopped) throw new OpenCodeLifecycleError('shutdown-unconfirmed', false, directory);
    }
    if (failure || !result) throw new OpenCodeLifecycleError(failure ?? 'protocol-invalid', true, directory);
    return result;
  }).catch(error => {
    if (error instanceof OpenCodeLifecycleError) throw error;
    throw new OpenCodeLifecycleError('runtime-unresolved', false);
  });
}
