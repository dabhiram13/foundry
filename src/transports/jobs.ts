import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { FoundryError } from '../core/fs.js';
import { ProjectService } from '../core/projects.js';

type JsonRecord = Record<string, unknown>;
type WorkerMessage = { ok?: unknown; state?: { status?: unknown }; error?: unknown };
type JobEntry = {
  service: ProjectService;
  identifier: string;
  root: string;
  worker?: Worker;
  ready: Promise<void>;
  resolveReady: () => void;
  closing: boolean;
  forcedTermination: boolean;
  message?: WorkerMessage;
};

const MAX_ACTIVE_RUNS = 4;
const workers = new Map<string, JobEntry>();
const runEpochs = new WeakMap<ProjectService, number>();
const closingServices = new WeakMap<ProjectService, number>();

export function isProjectRunActive(root: string): boolean {
  return workers.has(path.resolve(root));
}

function runEpoch(service: ProjectService): number {
  return runEpochs.get(service) ?? 0;
}

function advanceRunEpoch(service: ProjectService): void {
  runEpochs.set(service, runEpoch(service) + 1);
}

function finish(entry: JobEntry, status: string, error?: string): void {
  if (workers.get(entry.root) !== entry) return;
  entry.service.setJob(entry.identifier, status, error);
  workers.delete(entry.root);
  entry.resolveReady();
}

function outcome(entry: JobEntry, exitCode: number): { status: string; error?: string } {
  if (entry.forcedTermination) {
    return {
      status: 'recovery_required',
      error: 'Worker shutdown was not confirmed; inspect and explicitly recover the saved Factory state.',
    };
  }
  if (exitCode !== 0 || !entry.message || entry.message.ok !== true) {
    return { status: 'failed', error: 'Factory worker exited without a confirmed boundary.' };
  }
  const status = entry.message.state?.status;
  if (status === 'awaiting_approval' || status === 'completed') return { status: 'completed' };
  if (status === 'recovery_required') {
    return { status: 'recovery_required', error: 'Factory ownership needs explicit recovery.' };
  }
  return { status: 'failed', error: 'Factory work failed; inspect the saved local receipt.' };
}

function waitForExit(worker: Worker, timeoutMs: number): Promise<boolean> {
  if (worker.threadId === -1) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      worker.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    worker.once('exit', onExit);
  });
}

export async function startProjectRun(service: ProjectService, identifier: string): Promise<JsonRecord> {
  const epoch = runEpoch(service);
  if ((closingServices.get(service) ?? 0) > 0) throw new FoundryError('The project service is shutting down');
  const target = await service.resolveRunTarget(identifier);
  if ((closingServices.get(service) ?? 0) > 0 || runEpoch(service) !== epoch) {
    throw new FoundryError('The project service is shutting down');
  }
  const root = path.resolve(target.path);
  if (workers.has(root)) throw new FoundryError('This project already has a run in progress');
  if (workers.size >= MAX_ACTIVE_RUNS) throw new FoundryError('The four local Factory worker slots are full; retry after a run finishes');

  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const entry: JobEntry = {
    service,
    identifier: target.id,
    root,
    ready,
    resolveReady,
    closing: false,
    forcedTermination: false,
  };
  workers.set(root, entry);
  service.setJob(target.id, 'running');

  try {
    const workerPath = path.join(service.runtimeDir, 'foundry-worker.cjs');
    const workerInfo = await lstat(workerPath);
    if (!workerInfo.isFile() || workerInfo.isSymbolicLink()) {
      throw new FoundryError('The TypeScript worker bundle must be a regular file');
    }
    if (entry.closing) throw new FoundryError('The service is shutting down');
    const worker = new Worker(workerPath, { workerData: { root } });
    entry.worker = worker;
    worker.once('message', (message: WorkerMessage) => {
      entry.message = message;
    });
    worker.once('error', () => {
      entry.message = undefined;
    });
    worker.once('exit', (exitCode) => {
      const result = outcome(entry, exitCode);
      finish(entry, result.status, result.error);
    });
    entry.resolveReady();
  } catch (error) {
    finish(entry, 'failed', 'Factory worker could not be started.');
    if (error instanceof FoundryError) throw error;
    throw new FoundryError('The TypeScript worker bundle is missing or could not be started; run npm ci && npm run build:runtime', { cause: error });
  }
  return { status: 'running', job: target.id };
}

export async function closeProjectRuns(service: ProjectService): Promise<boolean> {
  let confirmed = true;
  closingServices.set(service, (closingServices.get(service) ?? 0) + 1);
  advanceRunEpoch(service);
  try {
    const owned = [...workers.values()].filter((entry) => entry.service === service);
    await Promise.all(owned.map(async (entry) => {
      entry.closing = true;
      await entry.ready;
      const worker = entry.worker;
      if (!worker || workers.get(entry.root) !== entry) return;
      let stopTimer: NodeJS.Timeout | undefined;
      await Promise.race([
        service.stop(entry.identifier).catch(() => undefined),
        new Promise<void>((resolve) => {
          stopTimer = setTimeout(resolve, 5_000);
          stopTimer.unref();
        }),
      ]);
      if (stopTimer) clearTimeout(stopTimer);
      if (await waitForExit(worker, 10_000)) return;

      confirmed = false;
      entry.forcedTermination = true;
      try {
        await worker.terminate();
      } catch {
        finish(entry, 'recovery_required', 'Worker shutdown was not confirmed; inspect and explicitly recover the saved Factory state.');
        return;
      }
      if (workers.get(entry.root) === entry) {
        finish(entry, 'recovery_required', 'Worker shutdown was not confirmed; inspect and explicitly recover the saved Factory state.');
      }
    }));
  } finally {
    const remaining = (closingServices.get(service) ?? 1) - 1;
    if (remaining > 0) closingServices.set(service, remaining);
    else closingServices.delete(service);
    advanceRunEpoch(service);
  }
  return confirmed;
}
