import os from 'node:os';
import path from 'node:path';
import { FoundryError } from '../core/fs.js';
import { IsolatedWorkspace } from '../runtime/isolated-workspace.js';
import { ManagedService } from '../runtime/managed-service.js';
import { writeResult } from './output.js';

export async function workspaceCommand(args: string[], runtime: string): Promise<number> {
  const [action, ...rest] = args;
  if (!action || action === '--help') {
    process.stdout.write(`Foundry isolated owner workspace (local Docker, approved managed session)
  workspace open --image IMAGE@sha256:DIGEST
  workspace exec -- PROGRAM [ARG ...]
  workspace status|diff|stop|resume
All commands accept --project PATH --storage PRIVATE_DIRECTORY --json.
Open never downloads an image. Exec runs inside a private disposable copy, not the original project.
Stop confirms the container is gone; the copied files remain available for inspection.
Diff requires confirmed stop. Exec accepts --timeout-ms 100..30000 (default 30000).
This is an owner terminal preview, not isolated managed coding or a browser UI.
`);
    return 0;
  }
  if (!['open', 'exec', 'status', 'diff', 'stop', 'resume'].includes(action)) throw new FoundryError('Unknown workspace command');
  const values = new Map<string, string>();
  let json = false;
  let split = -1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--') { split = i; break; }
    const name = rest[i]!.replace(/^--/, '');
    if (!rest[i]!.startsWith('--') || !['project', 'storage', 'image', 'timeout-ms', 'json'].includes(name)
      || values.has(name) || (name === 'json' && json)) throw new FoundryError('Invalid or repeated workspace option');
    if (name === 'json') json = true;
    else {
      const value = rest[++i];
      if (!value || value.startsWith('--')) throw new FoundryError(`Missing value for --${name}`);
      values.set(name, value);
    }
  }
  if ((action === 'exec') !== (split >= 0) || (split >= 0 && action !== 'exec')
    || (action !== 'open' && values.has('image')) || (action !== 'exec' && values.has('timeout-ms'))) throw new FoundryError('Invalid workspace arguments');
  if (action === 'open' && !values.has('image')) throw new FoundryError('Select a digest-pinned image with --image');
  const argv = split < 0 ? [] : rest.slice(split + 1);
  const root = path.resolve(values.get('project') ?? process.cwd());
  const storage = path.resolve(values.get('storage') ?? path.join(os.homedir(), '.local/state/foundry-managed'));
  const service = await ManagedService.open(root, storage, runtime);
  try {
    const session = await service.status();
    const workspace = await IsolatedWorkspace.bind(service.root, storage, session, action === 'stop' || action === 'diff' || action === 'status');
    const result = action === 'open' ? await service.openWorkspace(values.get('image')!)
      : action === 'exec' ? await service.execWorkspace(argv, values.has('timeout-ms') ? Number(values.get('timeout-ms')) : undefined)
        : action === 'resume' ? await service.resumeWorkspace()
        : action === 'status' ? await workspace.status()
          : action === 'diff' ? await workspace.diff() : await workspace.stop();
    writeResult(result, json);
    return action === 'exec' && 'exitCode' in result ? result.exitCode : 0;
  } finally { await service.close(); }
}
