import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { FoundryError } from '../core/fs.js';
import { ProjectService } from '../core/projects.js';

type JsonRecord = Record<string, unknown>;

const workers = new Map<Worker, { service: ProjectService; identifier: string }>();

export async function startProjectRun(service: ProjectService, identifier: string): Promise<JsonRecord> {
  if (service.jobSnapshot()[identifier]?.status === 'running') {
    throw new FoundryError('This project already has a run in progress');
  }
  const project = await service.status(identifier);
  if (typeof project.path !== 'string') throw new FoundryError('Project path is unavailable');
  const workerPath = path.join(service.sourceRoot, 'dist/runtime/foundry-worker.cjs');
  service.setJob(identifier, 'running');
  let worker: Worker;
  try {
    await lstat(workerPath);
    worker = new Worker(workerPath, { workerData: { root: project.path } });
  } catch (error) {
    service.clearJob(identifier);
    throw new FoundryError('The TypeScript worker bundle is missing; run npm ci && npm run build:runtime', { cause: error });
  }
  workers.set(worker, { service, identifier });
  worker.once('message', (message: { ok?: boolean; state?: JsonRecord; error?: string }) => {
    if (message.ok) {
      const state = message.state;
      service.setJob(
        identifier,
        state?.status === 'failed' || state?.status === 'interrupted' ? 'failed' : 'completed',
        state?.status === 'failed' || state?.status === 'interrupted' ? 'Factory work failed; inspect the saved local receipt.' : undefined,
      );
    } else {
      service.setJob(identifier, 'failed', 'Factory work failed; inspect the saved local receipt.');
    }
  });
  worker.once('error', () => {
    service.setJob(identifier, 'failed', 'Factory work failed; inspect the saved local receipt.');
  });
  worker.once('exit', () => workers.delete(worker));
  return { status: 'running', job: identifier };
}

export async function closeProjectRuns(): Promise<void> {
  const active = [...workers.entries()];
  await Promise.all(active.map(async ([worker, { service, identifier }]) => {
    try {
      await service.stop(identifier);
    } catch {}
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 3_000);
      worker.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    if (!exited) await worker.terminate();
  }));
  workers.clear();
}
