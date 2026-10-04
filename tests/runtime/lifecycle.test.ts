import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { complete, pauseOrResume, recover, start, status, verify } from '../../src/core/lifecycle.js';

async function project(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-life-'));
  await mkdir(path.join(root, '.foundry'), { recursive: true });
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({
    name: 'fixture',
    checks: [{ name: 'behavior', command: [process.execPath, '-e', 'process.stdout.write("ok")'], inputs: ['spec.md'], timeout: 10, required: true }],
  }));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1, runtime: 'typescript', runtime_version: '1',
    installed_at: new Date().toISOString(), source_pin: 'a'.repeat(64),
  }));
  await writeFile(path.join(root, 'spec.md'), '# acceptance\n');
  return root;
}

test('start, verify, and complete preserve durable IDs and freshness', async () => {
  const root = await project();
  const state = await start(root, 'fixture-run', 'spec.md');
  assert.equal(state.status, 'building');
  assert.equal(await verify(root), 0);
  const before = await status(root);
  assert.equal((before.active as { status: string }).status, 'verified');
  assert.equal(await complete(root), 0);
  const stateJson = JSON.parse(await readFile(path.join(root, '.foundry/state/last-completed.json'), 'utf8')) as { run_id: string };
  assert.equal(stateJson.run_id, state.run_id);
  assert.equal(await complete(root), 0);
});

test('changing a declared input makes verification fail closed', async () => {
  const root = await project();
  await start(root, 'stale-run', 'spec.md');
  await writeFile(path.join(root, 'spec.md'), '# changed\n');
  assert.equal(await verify(root), 0, 'the changed input is the new baseline for this run');
  await writeFile(path.join(root, 'spec.md'), '# changed again\n');
  await assert.rejects(complete(root), /stale|mismatch/i);
});

test('pause and resume preserve the run ID and discard prior verification freshness', async () => {
  const root = await project();
  const started = await start(root, 'pause-run', 'spec.md');
  assert.equal(await verify(root), 0);
  const verified = (await status(root)).active as Record<string, unknown>;
  assert.equal(typeof verified.verification, 'string');
  const paused = await pauseOrResume(root, true);
  assert.equal(paused.run_id, started.run_id);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.verification, verified.verification);
  const resumed = await pauseOrResume(root, false);
  assert.equal(resumed.run_id, started.run_id);
  assert.equal(resumed.status, 'building');
  assert.equal(resumed.verification, undefined);
});

test('failed and timed-out checks retain explicit failure receipts', async () => {
  const failedRoot = await project();
  const projectPath = path.join(failedRoot, '.foundry/project.json');
  const config = JSON.parse(await readFile(projectPath, 'utf8')) as { checks: Array<Record<string, unknown>> };
  config.checks[0]!.command = [process.execPath, '-e', 'process.exit(7)'];
  await writeFile(projectPath, JSON.stringify(config));
  await start(failedRoot, 'failed-check', 'spec.md');
  assert.equal(await verify(failedRoot), 1);
  const failedState = (await status(failedRoot)).active as Record<string, unknown>;
  const failedEvidence = JSON.parse(await readFile(path.join(failedRoot, String(failedState.verification)), 'utf8')) as {
    checks: Array<Record<string, unknown>>;
  };
  assert.equal(failedEvidence.checks[0]?.status, 'failed');
  assert.equal(failedEvidence.checks[0]?.exit_code, 7);

  const timedOutRoot = await project();
  const timeoutPath = path.join(timedOutRoot, '.foundry/project.json');
  const timeoutConfig = JSON.parse(await readFile(timeoutPath, 'utf8')) as { checks: Array<Record<string, unknown>> };
  timeoutConfig.checks[0]!.command = [process.execPath, '-e', 'setTimeout(() => {}, 5000)'];
  timeoutConfig.checks[0]!.timeout = 0.1;
  await writeFile(timeoutPath, JSON.stringify(timeoutConfig));
  await start(timedOutRoot, 'timed-out-check', 'spec.md');
  assert.equal(await verify(timedOutRoot), 1);
  const timedOutState = (await status(timedOutRoot)).active as Record<string, unknown>;
  const timedOutEvidence = JSON.parse(await readFile(path.join(timedOutRoot, String(timedOutState.verification)), 'utf8')) as {
    checks: Array<Record<string, unknown>>;
  };
  assert.equal(timedOutEvidence.checks[0]?.status, 'timed_out');
});

test('check leaders cannot leave ignored-stdio descendants behind', { skip: process.platform === 'win32' }, async () => {
  const root = await project();
  const childPidPath = path.join(root, 'orphan.pid');
  const childStoppedPath = path.join(root, 'orphan.stopped');
  const childCode = `const fs=require('node:fs');process.on('SIGTERM',()=>{fs.writeFileSync(${JSON.stringify(childStoppedPath)},'stopped');process.exit(0)});fs.writeFileSync(${JSON.stringify(childPidPath)},String(process.pid));setInterval(()=>{},1000);`;
  const parentCode = `const {spawn}=require('node:child_process');const fs=require('node:fs');spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:'ignore'});let attempts=0;const ready=setInterval(()=>{if(fs.existsSync(${JSON.stringify(childPidPath)})){clearInterval(ready);process.exit(0)}else if(++attempts>100){clearInterval(ready);process.exit(5)}},10);`;
  const projectPath = path.join(root, '.foundry/project.json');
  const config = JSON.parse(await readFile(projectPath, 'utf8')) as { checks: Array<Record<string, unknown>> };
  config.checks[0]!.command = [process.execPath, '-e', parentCode];
  await writeFile(projectPath, JSON.stringify(config));
  await start(root, 'orphan-check', 'spec.md');
  assert.equal(await verify(root), 1);
  assert.equal(await readFile(childStoppedPath, 'utf8'), 'stopped');
  const state = (await status(root)).active as Record<string, unknown>;
  const receipt = JSON.parse(await readFile(path.join(root, String(state.verification)), 'utf8')) as {
    checks: Array<{ status: string; log: string }>;
  };
  assert.equal(receipt.checks[0]?.status, 'failed');
  assert.match(await readFile(path.join(root, String(receipt.checks[0]?.log)), 'utf8'), /Check left processes running/);
});

test('recovery marks an interrupted verification unverified and repairs completed pointers', async () => {
  const root = await project();
  const started = await start(root, 'recovery-run', 'spec.md');
  assert.equal(await verify(root), 0);
  const current = (await status(root)).active as Record<string, unknown>;
  const statePath = path.join(root, '.foundry/state/runs', String(started.run_id), 'state.json');
  await writeFile(statePath, JSON.stringify({ ...current, status: 'verifying' }));
  const paused = await recover(root);
  assert.equal(paused?.status, 'paused');
  const interrupted = JSON.parse(await readFile(path.join(root, String(current.verification)), 'utf8')) as Record<string, unknown>;
  assert.equal(interrupted.status, 'interrupted');
  assert.equal(interrupted.passed, false);

  assert.equal(await verify(root), 0);
  assert.equal(await complete(root), 0);
  const completed = JSON.parse(await readFile(statePath, 'utf8')) as Record<string, unknown>;
  await writeFile(path.join(root, '.foundry/state/active.json'), JSON.stringify({ run_id: completed.run_id, slug: completed.slug }));
  const repaired = await recover(root);
  assert.equal(repaired?.status, 'completed');
  assert.equal(await readFile(path.join(root, '.foundry/state/last-completed.json'), 'utf8').then((value) => value.includes(String(completed.run_id))), true);
  await assert.rejects(readFile(path.join(root, '.foundry/state/active.json')), { code: 'ENOENT' });
});

test('persisted run status and verification pointers fail closed when malformed', async () => {
  const root = await project();
  const started = await start(root, 'schema-run', 'spec.md');
  const statePath = path.join(root, '.foundry/state/runs', started.run_id, 'state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8')) as Record<string, unknown>;
  await writeFile(statePath, JSON.stringify({ ...state, status: 'future-status' }));
  await assert.rejects(status(root), /Invalid run state|status/i);
  await writeFile(statePath, JSON.stringify({ ...state, verification: '../outside.json' }));
  await assert.rejects(status(root), /Invalid run state|Project paths|Pointer/i);
  await writeFile(statePath, JSON.stringify({ ...state, schema_version: 2 }));
  await assert.rejects(status(root), /Invalid run state|schema_version/i);
  await writeFile(statePath, JSON.stringify({ ...state, schema_version: 1 }));
  assert.equal((await status(root)).active !== null, true);
  const activePath = path.join(root, '.foundry/state/active.json');
  await writeFile(activePath, JSON.stringify({ run_id: started.run_id, slug: started.slug, schema_version: 1 }));
  assert.equal((await status(root)).active !== null, true);
  await writeFile(activePath, JSON.stringify({ run_id: started.run_id, slug: started.slug, schema_version: 2 }));
  await assert.rejects(status(root), /active pointer|schema_version/i);
});

test('runtime marker rejects unsupported runtime versions', async () => {
  const root = await project();
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1,
    runtime: 'typescript',
    runtime_version: '2',
    installed_at: new Date().toISOString(),
    source_pin: 'a'.repeat(64),
  }));
  await assert.rejects(start(root, 'future-marker', 'spec.md'), /Invalid TypeScript runtime marker/);
});
