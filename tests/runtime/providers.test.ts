import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { execute, providerStatus } from '../../src/runtime/providers.js';

type JsonRecord = Record<string, unknown>;

async function project(mode = 'success'): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-provider-'));
  await mkdir(path.join(root, '.foundry'), { recursive: true });
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'fixture', checks: [] }));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1, runtime: 'typescript', runtime_version: '1',
    installed_at: new Date().toISOString(), source_pin: 'c'.repeat(64),
  }));
  const fake = path.join(root, 'fake.mjs');
  const childPidPath = path.join(root, 'orphan.pid');
  const childStoppedPath = path.join(root, 'orphan.stopped');
  const event = JSON.stringify({
    type: 'result', status: 'completed',
    output: mode === 'redacted'
      ? { message: process.env.FOUNDRY_RUNTIME_TEST_API_KEY }
      : mode === 'split-utf8' ? { ok: true, text: 'café' } : { ok: true },
    ...(mode === 'invalid-usage' ? { usage: { reliable: true, input_tokens: -1 } } : {}),
  });
  let script: string;
  if (mode === 'hang') {
    script = 'setTimeout(() => {}, 10000);';
  } else if (mode === 'child-hang') {
    script = `import { spawn } from 'node:child_process'; spawn(process.execPath, ['-e', ${JSON.stringify("process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);")}], { stdio: 'inherit' }); process.on('SIGTERM', () => process.exit(0));`;
  } else if (mode === 'malformed-hang') {
    script = "process.stdin.on('data',()=>{console.log('not-json');setInterval(()=>{},1000);});";
  } else if (mode === 'oversized-line') {
    script = "process.stdin.on('data',()=>{process.stdout.write('x'.repeat(300000));setInterval(()=>{},1000);});";
  } else if (mode === 'oversized-total') {
    script = "process.stdin.on('data',()=>{for(let i=0;i<24;i++)process.stderr.write('x'.repeat(120000)+'\\n');setInterval(()=>{},1000);});";
  } else if (mode === 'stdin-exit') {
    script = 'process.exit(0);';
  } else if (mode === 'completed-orphan') {
    const childScript = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(childPidPath)},String(process.pid));process.on('SIGTERM',()=>{fs.writeFileSync(${JSON.stringify(childStoppedPath)},'stopped');process.exit(0)});setInterval(()=>{},1000);`;
    const completion = [
      JSON.stringify({ type: 'session.started', session_id: 'fixture-session', model: 'fixture-v1' }),
      event,
    ].join('\n') + '\n';
    script = `import { spawn } from 'node:child_process';import fs from 'node:fs';process.stdin.on('data',()=>{spawn(process.execPath,['-e',${JSON.stringify(childScript)}],{stdio:'ignore'});let attempts=0;const ready=setInterval(()=>{if(fs.existsSync(${JSON.stringify(childPidPath)})){clearInterval(ready);process.stdout.write(${JSON.stringify(completion)},()=>process.exit(0));}else if(++attempts>100){clearInterval(ready);process.exit(5);}},10);});`;
  } else if (mode === 'split-utf8') {
    script = `process.stdin.on('data',()=>{const bytes=Buffer.from(JSON.stringify({type:'session.started',session_id:'fixture-session',model:'fixture-v1'})+'\\n'+${JSON.stringify(event)}+'\\n');const split=bytes.indexOf(Buffer.from('é'))+1;process.stdout.write(bytes.subarray(0,split));setTimeout(()=>process.stdout.write(bytes.subarray(split)),5);});`;
  } else {
    script = `process.stdin.on('data',()=>{console.log(JSON.stringify({type:'session.started',session_id:'fixture-session',model:'fixture-v1'}));console.log(${JSON.stringify(event)});});`;
  }
  await writeFile(fake, script);
  await chmod(fake, 0o700);
  await writeFile(path.join(root, '.foundry/providers.json'), JSON.stringify({ adapters: [{
    name: 'fixture', kind: 'agent-runtime', command: [process.execPath, fake],
    capabilities: ['jsonl', 'structured_output', 'resume', 'cancel', 'permissions', 'model_selection', 'reasoning_selection'],
    billing_modes: ['local'],
  }] }));
  return root;
}

function request(): Record<string, unknown> {
  return { adapter: 'fixture', kind: 'agent-runtime', prompt: 'work', billing: { mode: 'local' }, budget: { max_elapsed_seconds: 2 } };
}

test('subprocess environment is restricted and explicitly selected values stay out of saved output', async () => {
  const key = 'FOUNDRY_ENVIRONMENT_TEST_VALUE';
  const previous = process.env[key];
  process.env[key] = 'local-fixture-private-value';
  const root = await project();
  try {
    await writeFile(path.join(root, 'fake.mjs'), `process.stdin.on('data',()=>{console.log(JSON.stringify({type:'session.started',session_id:'fixture-session'}));console.log(JSON.stringify({type:'result',status:'completed',output:{present:process.env.${key}!==undefined,value:process.env.${key}??null}}));});`);
    const first = await execute(root, request());
    assert.equal(first.status, 'completed');
    assert.deepEqual((first.attempts as JsonRecord[])[0]?.output, { present: false, value: null });
    const configPath = path.join(root, '.foundry/providers.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as { adapters: JsonRecord[] };
    config.adapters[0]!.environment = [key];
    await writeFile(configPath, JSON.stringify(config));
    const second = await execute(root, request());
    assert.equal(second.status, 'completed');
    assert.deepEqual((second.attempts as JsonRecord[])[0]?.output, { present: true, value: '[redacted]' });
    assert.equal(JSON.stringify(second).includes(process.env[key]!), false);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
    await rm(root, { recursive: true, force: true });
  }
});

async function waitForTask(root: string): Promise<{ taskId: string; pid: number }> {
  const directory = path.join(root, '.foundry/state/providers/tasks');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      for (const file of await readdir(directory)) {
        if (!file.endsWith('.json')) continue;
        const task = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as JsonRecord;
        const firstAttempt = (task.attempts as JsonRecord[] | undefined)?.[0];
        if (typeof task.task_id === 'string' && typeof firstAttempt?.pid === 'number') {
          return { taskId: task.task_id, pid: firstAttempt.pid };
        }
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Provider task did not start');
}

test('provider runner records successful local JSONL completion', async () => {
  const { kind: _kind, ...withoutKind } = request();
  const root = await project();
  const result = await execute(root, withoutKind);
  assert.equal(result.status, 'completed');
  assert.equal((result.attempts as Array<Record<string, unknown>>)[0]?.output && ((result.attempts as Array<Record<string, unknown>>)[0]?.output as Record<string, unknown>).ok, true);
  assert.equal((result.usage as JsonRecord).subscription_allowance_remaining, null);
  const taskPath = path.join(root, '.foundry/state/providers/tasks', `${String(result.task_id)}.json`);
  const valid = JSON.parse(await readFile(taskPath, 'utf8')) as JsonRecord;
  const invalidCases = [
    (task: JsonRecord) => { task.adapter_contract_version = 2; },
    (task: JsonRecord) => { (task.settings as JsonRecord).budget = { max_attempts: 0 }; },
    (task: JsonRecord) => { task.attempts = {}; },
    (task: JsonRecord) => { delete task.usage; },
    (task: JsonRecord) => { ((task.attempts as JsonRecord[])[0]!.usage as JsonRecord).input_tokens = -1; },
    (task: JsonRecord) => { task.status = 'future-status'; },
  ];
  for (const invalidate of invalidCases) {
    const malformed = structuredClone(valid);
    invalidate(malformed);
    await writeFile(taskPath, JSON.stringify(malformed));
    await assert.rejects(providerStatus(root, String(result.task_id)), /unsupported format/);
  }
});

test('provider runner decodes split UTF-8 JSONL output', async () => {
  const result = await execute(await project('split-utf8'), request());
  assert.equal(result.status, 'completed');
  assert.equal((((result.attempts as JsonRecord[])[0]?.output as JsonRecord).text), 'café');
});

test('malformed output terminates a hanging provider without rescue', async () => {
  const root = await project('malformed-hang');
  const running = execute(root, { ...request(), budget: { max_elapsed_seconds: 5 } });
  const { taskId, pid } = await waitForTask(root);
  let rescued = false;
  const rescue = setTimeout(() => {
    rescued = true;
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // The group may already have exited.
    }
  }, 1500);
  try {
    const result = await running;
    assert.equal(result.status, 'unknown');
    assert.equal(((result.attempts as JsonRecord[])[0]?.error as JsonRecord).code, 'invalid_protocol');
  } finally {
    clearTimeout(rescue);
  }
  assert.equal(rescued, false, 'the runner should terminate malformed-then-hang providers itself');
  assert.equal((await (await import('../../src/runtime/providers.js')).providerStatus(root, taskId) as JsonRecord).status, 'unknown');
});

test('provider runner terminates oversized lines and total output promptly', async () => {
  for (const [mode, code] of [['oversized-line', 'line_limit'], ['oversized-total', 'output_limit']]) {
    const root = await project(mode);
    const result = await execute(root, { ...request(), budget: { max_elapsed_seconds: 5 } });
    assert.equal(result.status, 'unknown');
    assert.equal(((result.attempts as JsonRecord[])[0]?.error as JsonRecord).code, code);
  }
});

test('invalid usage and early stdin closure fail closed without crashing', async () => {
  const invalidUsage = await execute(await project('invalid-usage'), request());
  assert.equal(invalidUsage.status, 'unknown');
  assert.equal(((invalidUsage.attempts as JsonRecord[])[0]?.error as JsonRecord).code, 'invalid_usage');
  const earlyExit = await execute(await project('stdin-exit'), request());
  assert.equal(earlyExit.status, 'unknown');
});

test('provider runner times out bounded processes', async () => {
  const hanging = await execute(await project('hang'), { ...request(), budget: { max_elapsed_seconds: 0.2 } });
  assert.equal(hanging.status, 'timed_out');
});

test('provider runner redacts child output in task receipts and event logs', async () => {
  const secret = 'runtime-test-secret-42';
  const previous = process.env.FOUNDRY_RUNTIME_TEST_API_KEY;
  process.env.FOUNDRY_RUNTIME_TEST_API_KEY = secret;
  try {
    const root = await project('redacted');
    const result = await execute(root, request());
    const attempt = (result.attempts as JsonRecord[])[0] ?? {};
    const evidence = await readFile(path.join(root, String(attempt.evidence)), 'utf8');
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(evidence.includes(secret), false);
  } finally {
    if (previous === undefined) delete process.env.FOUNDRY_RUNTIME_TEST_API_KEY;
    else process.env.FOUNDRY_RUNTIME_TEST_API_KEY = previous;
  }
});

test('provider runner rejects ChatGPT and records unavailable local executables without fallback', async () => {
  const root = await project();
  await assert.rejects(execute(root, { ...request(), adapter: 'chatgpt' }), /unsupported in the TypeScript preview/);
  const registryPath = path.join(root, '.foundry/providers.json');
  const config = JSON.parse(await readFile(registryPath, 'utf8')) as { adapters: Array<{ command: string[] }> };
  config.adapters[0]!.command = [path.join(root, 'missing-adapter')];
  await writeFile(registryPath, JSON.stringify(config));
  const result = await execute(root, request());
  assert.equal(result.status, 'unavailable');
  assert.equal(((result.usage as JsonRecord).api_dollars), 0);
});

test('provider runner requires explicit subscription or API billing consent', async () => {
  const root = await project();
  await assert.rejects(execute(root, { ...request(), adapter: 'codex', billing: { mode: 'subscription' } }), /explicit confirmation/);
  await assert.rejects(execute(root, { ...request(), adapter: 'codex', billing: { mode: 'api', allow_api: true } }), /explicit consent/);
  await assert.rejects(execute(root, { prompt: 'work', billing: { mode: 'api', allow_api: true } }), /explicit consent/);
});

test('provider runner honors cancellation through its owned process group', async () => {
  const root = await project('hang');
  const running = execute(root, { ...request(), budget: { max_elapsed_seconds: 5 } });
  const { taskId } = await waitForTask(root);
  const { cancel } = await import('../../src/runtime/providers.js');
  await cancel(root, taskId);
  assert.equal((await running).status, 'canceled');
});

test('provider runner kills the whole owned process group after its leader exits', { skip: process.platform === 'win32' }, async () => {
  const root = await project('child-hang');
  const running = execute(root, { ...request(), budget: { max_elapsed_seconds: 5 } });
  const { pid, taskId } = await waitForTask(root);
  const { cancel } = await import('../../src/runtime/providers.js');
  await cancel(root, taskId);
  let rescued = false;
  const rescue = setTimeout(() => {
    rescued = true;
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // The group may already have exited.
    }
  }, 1500);
  try {
    assert.equal((await running).status, 'canceled');
  } finally {
    clearTimeout(rescue);
  }
  assert.equal(rescued, false, 'the runner should kill descendant processes without test cleanup');
});

test('orphaned ignored-stdio descendants override a claimed completion', { skip: process.platform === 'win32' }, async () => {
  const root = await project('completed-orphan');
  const result = await execute(root, request());
  assert.equal(result.status, 'unknown');
  const attempt = (result.attempts as JsonRecord[])[0] ?? {};
  assert.equal((attempt.error as JsonRecord).code, 'orphan_process_group');
  assert.equal(await readFile(path.join(root, 'orphan.stopped'), 'utf8'), 'stopped');
  const pid = Number(await readFile(path.join(root, 'orphan.pid'), 'utf8'));
  let alive = true;
  for (let attemptNumber = 0; attemptNumber < 100 && alive; attemptNumber += 1) {
    try {
      process.kill(pid, 0);
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
      alive = !stat || stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z';
      if (alive) await new Promise((resolve) => setTimeout(resolve, 10));
    } catch {
      alive = false;
    }
  }
  assert.equal(alive, false, 'the runner should terminate ignored-stdio descendants');
});

test('provider status can inspect an unmarked workspace but execution cannot mutate it', async () => {
  const root = await project();
  await rm(path.join(root, '.foundry/runtime.json'));
  assert.deepEqual(await providerStatus(root), []);
  await assert.rejects(execute(root, request()), /unmarked or legacy workspace/);
});
