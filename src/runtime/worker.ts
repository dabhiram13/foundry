import { parentPort, workerData } from 'node:worker_threads';
import { runProjectUntilBoundary } from '../core/projects.js';

if (!parentPort || typeof workerData?.root !== 'string') {
  throw new Error('Factory worker needs a project root');
}

async function main(): Promise<void> {
  try {
    const state = await runProjectUntilBoundary(workerData.root);
    parentPort?.postMessage({ ok: true, state });
  } catch {
    parentPort?.postMessage({ ok: false, error: 'Factory work failed; inspect the saved local receipt.' });
    process.exitCode = 1;
  }
}

void main();
