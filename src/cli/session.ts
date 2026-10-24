import { lstat, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FoundryError } from '../core/fs.js';
import { ManagedService } from '../runtime/managed-service.js';
import { writeResult } from './output.js';

export async function sessionCommand(args: string[], runtime: string): Promise<number> {
  const [action, ...rest] = args;
  if (!action || action === '--help') {
    process.stdout.write(`Foundry managed session preview (Linux, disposable trusted projects, local test endpoint only)
  session start --profile FILE --confirmed --request-id UUID
  session run --profile FILE
  session status|events|verify|record|release
  session pause|stop|resume|retry --request-id UUID --expected-revision NUMBER
  session recover [--inspection-digest HASH]
All commands accept --project PATH --storage PRIVATE_DIRECTORY --json.
Events accept --after NUMBER. Run stays in the foreground; Ctrl+C requests Pause and drains shutdown.
Pause/Stop commands request a transition. Only status paused/stopped confirms shutdown.
`);
    return 0;
  }
  const permitted: Record<string, string[]> = {
    start: ['profile', 'confirmed', 'request-id'], run: ['profile'], status: [], events: ['after'],
    pause: ['request-id', 'expected-revision'], stop: ['request-id', 'expected-revision'], resume: ['request-id', 'expected-revision'], retry: ['request-id', 'expected-revision'],
    verify: [], record: [], release: [], recover: ['inspection-digest'],
  };
  const allowed = permitted[action];
  if (!allowed) throw new FoundryError('Unknown managed session command');
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const argument = rest[i]!;
    if (!argument.startsWith('--')) throw new FoundryError('Unexpected managed session argument');
    const name = argument.slice(2);
    if (!['project', 'storage', 'json', ...allowed].includes(name) || values.has(name) || flags.has(name)) throw new FoundryError(`Unknown or repeated option --${name}`);
    if (name === 'json' || name === 'confirmed') flags.add(name);
    else {
      const value = rest[++i];
      if (!value || value.startsWith('--')) throw new FoundryError(`Missing value for --${name}`);
      values.set(name, value);
    }
  }
  const required = (name: string) => { const value = values.get(name); if (!value) throw new FoundryError(`Missing --${name}`); return value; };
  const integer = (name: string, fallback?: number) => {
    const value = values.get(name);
    if (value === undefined && fallback !== undefined) return fallback;
    if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new FoundryError(`Invalid --${name}`);
    return Number(value);
  };
  let profile: unknown;
  if (action === 'start' || action === 'run') {
    if (action === 'start' && !flags.has('confirmed')) throw new FoundryError('Review the profile and explicitly consent with --confirmed');
    const filename = path.resolve(required('profile'));
    const info = await lstat(filename);
    if (!info.isFile() || info.size > 16_384) throw new FoundryError('Invalid managed profile file');
    profile = JSON.parse(await readFile(filename, 'utf8'));
  }
  const service = await ManagedService.open(path.resolve(values.get('project') ?? process.cwd()),
    path.resolve(values.get('storage') ?? path.join(os.homedir(), '.local/state/foundry-managed')), runtime);
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  if (action === 'run') { process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt); }
  try {
    let result: unknown;
    if (action === 'start') result = await service.start(profile, required('request-id'));
    else if (action === 'run') result = await service.run(profile, controller.signal);
    else if (action === 'status') result = await service.status();
    else if (action === 'events') result = await service.events(integer('after', 0));
    else if (action === 'verify') result = await service.verify();
    else if (action === 'record') result = await service.record();
    else if (action === 'release') { await service.release(); result = { released: true }; }
    else if (action === 'recover') result = await service.recover(values.get('inspection-digest'));
    else if (action === 'pause' || action === 'stop' || action === 'resume' || action === 'retry') result = await service.control(action, required('request-id'), integer('expected-revision'));
    writeResult(result, flags.has('json'));
    const status = (result as { state?: { status: string } } | undefined)?.state?.status;
    return status === 'failed' || status === 'recovery-required' ? 1 : 0;
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await service.close();
  }
}
