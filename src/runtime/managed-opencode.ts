import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { access, lstat, mkdir, open, readdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createOpencodeClient, type Config } from '@opencode-ai/sdk/v2/client';
import { z } from 'zod';
import { atomicJson, canonicalJson, digest, FoundryError, rejectSymlinkComponents } from '../core/fs.js';
import { managedProfileSchema, type ManagedProfile } from '../core/managed-profile.js';
import { executableDigest, executableStamp, localRequest, openCodeEnvironment, OPENCODE_VERSION,
  privateDirectory, projectIdentity, serverAddress, stopServer } from './opencode.js';

const uuid = z.uuid();
const launchSchema = z.strictObject({
  schemaVersion: z.literal(1), purpose: z.literal('managed-coding'),
  sessionId: uuid, executionId: uuid, profileDigest: z.string().regex(/^[a-f0-9]{64}$/),
  project: z.strictObject({ root: z.string(), device: z.string(), inode: z.string() }),
  token: uuid, pid: z.number().int().positive().nullable(),
  uninspectable: z.array(z.strictObject({ pid: z.number().int().positive(), stamp: z.string().regex(/^\d+$/) })).max(256),
  upstreamSessionId: z.string().regex(/^ses_[a-zA-Z0-9_-]{1,100}$/).nullable(),
  phase: z.enum(['launching', 'running', 'stopped', 'unknown']),
  outcome: z.enum(['candidate', 'interrupted', 'failed']).nullable(),
});
type Launch = z.infer<typeof launchSchema>;
const MARKER = 'FOUNDRY_MANAGED_EXECUTION';
const allowedTools = new Set(['read', 'glob', 'grep', 'list', 'edit', 'write', 'apply_patch', 'bash']);

export class ManagedExecutorError extends FoundryError {
  constructor(readonly resourcesStopped: boolean) { super(resourcesStopped ? 'Managed executor failed after confirmed shutdown' : 'Managed executor outcome requires inspection'); }
}

async function readPrivate(filename: string): Promise<string> {
  rejectSymlinkComponents(filename);
  const info = await lstat(filename);
  if (!info.isFile() || info.nlink !== 1 || info.uid !== process.getuid!() || (info.mode & 0o077) || info.size > 16_384) throw new ManagedExecutorError(false);
  const handle = await open(filename, 'r');
  try {
    const current = await handle.stat();
    if (info.ino !== current.ino || info.dev !== current.dev) throw new ManagedExecutorError(false);
    const bytes = Buffer.alloc(16_385);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead > 16_384) throw new ManagedExecutorError(false);
    return bytes.subarray(0, bytesRead).toString('utf8');
  } finally { await handle.close(); }
}

async function processStamp(pid: number): Promise<string | null> {
  try {
    const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    return fields[0] === 'Z' ? null : fields[19]!;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ESRCH') return null; throw error; }
}

// Trusted-local descendants must retain their inherited execution marker. This is not a sandbox.
async function ownedProcesses(token: string, uninspectable: Array<{ pid: number; stamp: string }>, baseline = false): Promise<Array<{ pid: number; stamp: string }>> {
  const result: Array<{ pid: number; stamp: string }> = [];
  const names = await readdir('/proc');
  if (names.length > 16_384) throw new ManagedExecutorError(false);
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue;
    const pid = Number(name);
    try {
      if ((await lstat(`/proc/${name}`)).uid !== process.getuid!()) continue;
      const stamp = await processStamp(pid);
      if (!stamp) continue;
      const handle = await open(`/proc/${name}/environ`, 'r').catch(error => {
        if ((error as NodeJS.ErrnoException).code !== 'EACCES') throw error;
        if (uninspectable.some(entry => entry.pid === pid && entry.stamp === stamp)) return null;
        if (!baseline || uninspectable.length >= 256) throw new ManagedExecutorError(false);
        uninspectable.push({ pid, stamp });
        return null;
      });
      if (!handle) continue;
      try {
        const bytes = Buffer.alloc(131_073);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
        if (bytesRead === bytes.length) throw new ManagedExecutorError(false);
        if (bytes.subarray(0, bytesRead).toString().split('\0').includes(`${MARKER}=${token}`)) result.push({ pid, stamp });
      } finally { await handle.close(); }
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  return result;
}

async function stopOwned(record: Launch, serverPid: number | undefined): Promise<void> {
  for (const entry of (await ownedProcesses(record.token, record.uninspectable)).filter(entry => entry.pid !== serverPid)) {
    if (await processStamp(entry.pid) !== entry.stamp) throw new ManagedExecutorError(false);
    try { process.kill(entry.pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}

export function managedLaunchDirectory(parent: string, sessionId: string, executionId: string): string {
  return path.join(parent, uuid.parse(sessionId), uuid.parse(executionId));
}

export async function validateManagedExecutor(root: string, parent: string, input: unknown): Promise<ManagedProfile> {
  const profile = managedProfileSchema.parse(input);
  if (process.platform !== 'linux') throw new FoundryError('Managed trusted-local preview currently requires Linux');
  validateManagedStorage(root, parent);
  await privateDirectory(parent);
  const stamp = await executableStamp(profile.binary);
  if (!(await lstat(profile.binary)).isFile()) throw new FoundryError('Selected executor must be an executable file');
  try { await access(profile.binary, constants.X_OK); }
  catch { throw new FoundryError('Selected executor must be an executable file'); }
  if (await executableDigest(profile.binary) !== profile.binaryDigest || await executableStamp(profile.binary) !== stamp) throw new FoundryError('Selected executor binary changed');
  return profile;
}

export function validateManagedStorage(root: string, parent: string): void {
  if (!path.isAbsolute(parent)) throw new FoundryError('Managed storage must be an absolute private path');
  const relative = path.relative(root, parent);
  const inverse = path.relative(parent, root);
  if (!relative.startsWith('..') || !inverse.startsWith('..')) throw new FoundryError('Managed storage must be outside the project');
}

export async function inspectManagedLaunch(parent: string, sessionId: string, executionId: string): Promise<{ digest: string; stopped: boolean; phase: Launch['phase'] }> {
  const directory = managedLaunchDirectory(parent, sessionId, executionId);
  const text = await readPrivate(path.join(directory, 'launch.json'));
  const record = launchSchema.parse(JSON.parse(text));
  if (record.sessionId !== sessionId || record.executionId !== executionId) throw new ManagedExecutorError(false);
  return { digest: digest(text), stopped: (await ownedProcesses(record.token, record.uninspectable)).length === 0, phase: record.phase };
}

export async function runManagedOpenCode(root: string, parent: string, input: unknown, execution: {
  sessionId: string; executionId: string; prompt: string; signal: AbortSignal;
  authorize: () => Promise<void>; observe: (text: string) => Promise<void>;
}): Promise<{ resourcesStopped: true; outcome: 'candidate' | 'interrupted' | 'failed' }> {
  const profile = await validateManagedExecutor(root, parent, input);
  const project = await projectIdentity(root);
  const directory = managedLaunchDirectory(parent, execution.sessionId, execution.executionId);
  await privateDirectory(path.dirname(directory));
  try { await mkdir(directory, { mode: 0o700 }); }
  catch { throw new ManagedExecutorError(false); }
  const record: Launch = { schemaVersion: 1, purpose: 'managed-coding', sessionId: execution.sessionId, executionId: execution.executionId,
    profileDigest: digest(canonicalJson(profile)), project, token: randomUUID(), pid: null, uninspectable: [], upstreamSessionId: null, phase: 'launching', outcome: null };
  await ownedProcesses(record.token, record.uninspectable, true);
  await atomicJson(directory, 'launch.json', record);
  const permission = { '*': 'deny', read: 'allow', glob: 'allow', grep: 'allow', list: 'allow', edit: 'allow',
    ...(profile.permissions === 'read-edit-shell' ? { bash: 'allow' as const } : {}), external_directory: 'deny', doom_loop: 'deny' } as const;
  const config: Config = {
    enabled_providers: [profile.provider.id],
    provider: { [profile.provider.id]: { npm: '@ai-sdk/openai-compatible', name: 'Selected local test endpoint',
      options: { baseURL: profile.provider.baseURL, apiKey: 'local-protocol-fixture' }, models: { [profile.provider.model]: { name: 'Selected test model' } } } },
    model: `${profile.provider.id}/${profile.provider.model}`, small_model: `${profile.provider.id}/${profile.provider.model}`,
    default_agent: 'build', permission, agent: { build: { steps: profile.maxSteps, permission }, explore: { disable: true }, general: { disable: true } },
    plugin: [], mcp: {}, instructions: [], snapshot: false, share: 'disabled', autoupdate: false, lsp: false, formatter: false,
  };
  for (const name of ['home', 'config', 'data', 'state', 'cache', 'tmp', 'managed']) await mkdir(path.join(directory, name), { mode: 0o700 });
  const password = randomBytes(32).toString('hex');
  const controller = new AbortController();
  const abort = () => controller.abort();
  execution.signal.addEventListener('abort', abort, { once: true });
  if (execution.signal.aborted) controller.abort();
  const timeout = setTimeout(abort, profile.deadlineMs);
  let child: ReturnType<typeof spawn> | undefined;
  let closed = false;
  let stopped = false;
  try {
    await execution.authorize();
    if (controller.signal.aborted) throw new ManagedExecutorError(true);
    child = spawn(profile.binary, ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
      cwd: root, env: { ...openCodeEnvironment(directory, password, config), [MARKER]: record.token }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.once('close', () => { closed = true; });
    const address = serverAddress(child, controller);
    void address.catch(() => {});
    record.pid = child.pid ?? null;
    record.phase = 'running';
    await atomicJson(directory, 'launch.json', record);
    const origin = await address;
    const limitedFetch: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).origin !== origin) throw new ManagedExecutorError(false);
      return localRequest(request, controller.signal);
    };
    if ((await limitedFetch(`${origin}/session`)).status !== 401) throw new ManagedExecutorError(false);
    const client = createOpencodeClient({ baseUrl: origin, directory: root, fetch: limitedFetch, throwOnError: true,
      headers: { Authorization: `Basic ${Buffer.from(`foundry:${password}`).toString('base64')}` } });
    const health = z.object({ healthy: z.literal(true), version: z.literal(OPENCODE_VERSION) }).parse((await client.global.health()).data);
    if (!health.healthy) throw new ManagedExecutorError(false);
    const actual = (await client.config.get({ directory: root })).data;
    for (const key of ['permission', 'plugin', 'mcp', 'instructions', 'enabled_providers', 'model', 'small_model', 'snapshot', 'share', 'autoupdate', 'lsp', 'formatter'] as const) {
      if (canonicalJson(actual?.[key] ?? null) !== canonicalJson(config[key] ?? null)) throw new ManagedExecutorError(false);
    }
    const upstream = z.object({ id: z.string().regex(/^ses_[a-zA-Z0-9_-]{1,100}$/), directory: z.literal(root) }).parse((await client.session.create({ directory: root, title: 'Foundry approved task' })).data);
    record.upstreamSessionId = upstream.id;
    await atomicJson(directory, 'launch.json', record);
    await execution.authorize();
    await execution.observe('Executor ready. Running the approved task.');
    let polling = false;
    let pending = Promise.resolve();
    const seen = new Set<string>();
    const poll = setInterval(() => {
      if (polling || controller.signal.aborted) return;
      polling = true;
      pending = (async () => {
        const messages = (await client.session.messages({ sessionID: upstream.id, directory: root, limit: 20 })).data ?? [];
        if (messages.length > 20) throw new ManagedExecutorError(false);
        for (const message of messages) for (const part of message.parts) {
          if (part.type !== 'tool' || !allowedTools.has(part.tool)) continue;
          const key = `${part.id}:${part.state.status}`;
          if (seen.has(key)) continue;
          if (seen.size >= 128) throw new ManagedExecutorError(false);
          seen.add(key);
          await execution.observe(`Tool ${part.tool}: ${part.state.status}.`);
        }
      })().catch(() => controller.abort()).finally(() => { polling = false; });
    }, 200);
    let response: Awaited<ReturnType<typeof client.session.prompt>>;
    try {
      response = await client.session.prompt({ sessionID: upstream.id, directory: root, model: { providerID: profile.provider.id, modelID: profile.provider.model },
        agent: 'build', parts: [{ type: 'text', text: execution.prompt }] });
    } finally { clearInterval(poll); await pending; }
    if (!response.data || response.data.info.role !== 'assistant' || response.data.info.error || response.data.info.finish !== 'stop') throw new ManagedExecutorError(false);
    for (const part of response.data.parts) {
      if (part.type === 'tool' && allowedTools.has(part.tool)) await execution.observe(`Tool ${part.tool}: ${['completed', 'error'].includes(part.state.status) ? part.state.status : 'finished'}.`);
    }
    if (canonicalJson(await projectIdentity(root)) !== canonicalJson(project)) throw new ManagedExecutorError(false);
    record.outcome = 'candidate';
  } catch {
    record.outcome = execution.signal.aborted ? 'interrupted' : 'failed';
  } finally {
    clearTimeout(timeout);
    execution.signal.removeEventListener('abort', abort);
    controller.abort();
    let descendantsStopped = true;
    try { await stopOwned(record, child?.pid); }
    catch { descendantsStopped = false; }
    const serverStopped = child ? await stopServer(child, 4000, () => closed) : true;
    try {
      await stopOwned(record, undefined);
      await delay(100);
      stopped = descendantsStopped && serverStopped && (await ownedProcesses(record.token, record.uninspectable)).length === 0;
    } catch { stopped = false; }
    record.phase = stopped ? 'stopped' : 'unknown';
    await atomicJson(directory, 'launch.json', record);
  }
  if (!stopped) throw new ManagedExecutorError(false);
  return { resourcesStopped: true, outcome: record.outcome ?? 'failed' };
}
