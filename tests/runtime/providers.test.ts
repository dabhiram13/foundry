import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { execute, inspectAdapter, providerStatus, registry } from '../../src/runtime/providers.js';
import { digest } from '../../src/core/fs.js';

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

test('requests require an adapter rather than silently selecting a provider', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { adapter: _adapter, ...missingAdapter } = request();
  await assert.rejects(execute(root, missingAdapter), /adapter/);
  await assert.rejects(readdir(path.join(root, '.foundry/state/providers/tasks')));
});

test('neutral protocol forwards provider-defined models for independently named adapters', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  const configuration = JSON.parse(await readFile(path.join(root, '.foundry/providers.json'), 'utf8'));
  const original = configuration.adapters[0];
  configuration.adapters = ['first-provider', 'second-provider'].map(name => ({
    ...original, name, protocol: 'foundry-jsonl-v1',
  }));
  await writeFile(path.join(root, '.foundry/providers.json'), JSON.stringify(configuration));
  await writeFile(path.join(root, 'fake.mjs'), `
    let input = ''; process.stdin.on('data', part => input += part);
    process.stdin.on('end', () => {
      const request = JSON.parse(input);
      console.log(JSON.stringify({ type: 'session.started', session_id: 'neutral-session', model: request.model }));
      console.log(JSON.stringify({ type: 'result', status: 'completed', output: request }));
    });
  `);
  for (const adapter of ['first-provider', 'second-provider']) {
    const result = await execute(root, { ...request(), adapter, model: `${adapter}/model-v7`, reasoning: 'provider-depth' });
    assert.equal(result.status, 'completed');
    const attempt = (result.attempts as JsonRecord[])[0]!;
    const input = attempt.output as JsonRecord;
    assert.equal(input.protocol, 'foundry-jsonl-v1');
    assert.equal(input.adapter, adapter);
    assert.equal(input.model, `${adapter}/model-v7`);
    assert.equal(input.reasoning, 'provider-depth');
    assert.equal(result.resolved_model, input.model);
  }
});

test('bundled wire behavior follows protocol rather than a reserved adapter name', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  const configuration = JSON.parse(await readFile(path.join(root, '.foundry/providers.json'), 'utf8'));
  configuration.adapters[0].name = 'team-runtime';
  configuration.adapters[0].protocol = 'codex-jsonl';
  await writeFile(path.join(root, '.foundry/providers.json'), JSON.stringify(configuration));
  await writeFile(path.join(root, 'fake.mjs'), `
    let input = ''; process.stdin.on('data', part => input += part);
    process.stdin.on('end', () => {
      console.log(JSON.stringify({ type: 'thread.started', thread_id: 'team-session' }));
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ prompt: input, args: process.argv.slice(2) }) } }));
      console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } }));
    });
  `);
  const result = await execute(root, { ...request(), adapter: 'team-runtime', model: 'provider-model', output_schema: { type: 'object' } });
  assert.equal(result.status, 'completed');
  const output = (result.attempts as JsonRecord[])[0]!.output as JsonRecord;
  assert.equal(output.prompt, 'work');
  assert.ok((output.args as string[]).includes('--model'));
  assert.ok((output.args as string[]).includes('provider-model'));
  assert.ok((output.args as string[]).includes('read-only'));
});

test('provider inspection reports origin and executable access without launching commands', async () => {
  const root = await project();
  const adapters = await registry(root);
  const adapter = adapters.fixture!;
  const result = await inspectAdapter(root, adapter);
  assert.equal(result.availability, 'available');
  assert.equal(result.authentication, 'not_checked');
  assert.equal(result.source, '.foundry/providers.json');
  assert.match(String(result.adapter_sha256), /^[a-f0-9]{64}$/);
  assert.equal((await inspectAdapter(root, adapters.chatgpt!)).availability, 'unsupported');
  assert.equal((await inspectAdapter(root, adapters.codex!)).source, 'builtin');
  const marker = path.join(root, 'executed');
  await writeFile(path.join(root, 'inspect-only'), `#!/bin/sh\ntouch ${JSON.stringify(marker)}\n`);
  const local = { ...adapter, command: ['./inspect-only'] };
  assert.equal((await inspectAdapter(root, local)).availability, 'missing');
  await chmod(path.join(root, 'inspect-only'), 0o700);
  assert.equal((await inspectAdapter(root, local)).availability, 'available');
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  assert.equal((await inspectAdapter(root, { ...adapter, command: [root] })).availability, 'missing');
  assert.equal((await inspectAdapter(root, { ...adapter, command: ['foundry-nonexistent-executable'] })).availability, 'missing');
  assert.equal((await inspectAdapter(root, { ...adapter, command: ['node'] })).availability, 'available');
  assert.equal(JSON.stringify(result).includes('fake.mjs'), false);
});

test('provider attempts retain bounded handoff metadata and exact input digests without raw prompts', async () => {
  const root = await project();
  await writeFile(path.join(root, 'fake.mjs'), `import fs from 'node:fs';let parts=[];process.stdin.on('data',chunk=>parts.push(chunk));process.stdin.on('end',()=>{fs.writeFileSync('input.bin',Buffer.concat(parts));console.log(JSON.stringify({type:'session.started',session_id:'fixture-session'}));console.log(JSON.stringify({type:'result',status:'completed',output:{ok:true}}));});`);
  const handoff = { stage: 'research', role: 'market-researcher', role_sha256: 'b'.repeat(64), inputs: { 'docs/product/idea.md': 'c'.repeat(64) } };
  const result = await execute(root, { ...request(), prompt: 'private customer idea, café' }, undefined, { handoff });
  assert.equal(result.status, 'completed');
  const attempt = (result.attempts as JsonRecord[])[0]!;
  const bytes = await readFile(path.join(root, 'input.bin'));
  assert.deepEqual(attempt.input, { sha256: digest(bytes), bytes: bytes.length, limit_bytes: 256 * 1024 });
  assert.deepEqual(attempt.handoff, handoff);
  const savedPath = path.join(root, '.foundry/state/providers/tasks', `${String(result.task_id)}.json`);
  const savedText = await readFile(savedPath, 'utf8');
  assert.equal(savedText.includes('private customer idea'), false);
  assert.deepEqual((await providerStatus(root, String(result.task_id)) as JsonRecord).attempts, result.attempts);
  const old = JSON.parse(savedText);
  delete old.attempts[0].input;
  delete old.attempts[0].handoff;
  await writeFile(savedPath, JSON.stringify(old));
  assert.equal((await providerStatus(root, String(result.task_id)) as JsonRecord).status, 'completed');
  for (const invalid of [
    { ...handoff, inputs: { '../outside': 'c'.repeat(64) } },
    { ...handoff, role_sha256: 'invalid' },
    { ...handoff, inputs: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`docs/${i}`, 'c'.repeat(64)])) },
  ]) await assert.rejects(execute(root, request(), undefined, { handoff: invalid }));
  assert.equal((await readdir(path.dirname(savedPath))).length, 1);
});

test('provider registry parse errors retain a cause without exposing malformed configuration', async () => {
  const root = await project();
  const secret = 'DUMMY_PROVIDER_CONFIG_SECRET';
  const configPath = path.join(root, '.foundry/providers.json');
  await writeFile(configPath, secret);
  try {
    await assert.rejects(registry(root), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^Cannot read JSON .*\.foundry\/providers\.json$/);
      assert.equal(error.message.includes(secret), false);
      assert.ok(error.cause instanceof Error);
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess environment is restricted and explicitly selected values stay out of saved output', async () => {
  const key = 'FOUNDRY_ENVIRONMENT_TEST_VALUE';
  const shortKey = 'FOUNDRY_ENVIRONMENT_TEST_SHORT';
  const previous = process.env[key];
  const previousShort = process.env[shortKey];
  process.env[key] = 'local-fixture-private-value';
  process.env[shortKey] = 'Q7';
  const root = await project();
  try {
    await writeFile(path.join(root, 'fake.mjs'), `process.stdin.on('data',()=>{console.log(JSON.stringify({type:'session.started',session_id:'fixture-session'}));console.log(JSON.stringify({type:'result',status:'completed',output:{present:process.env.${key}!==undefined,value:process.env.${key}??null,neutral:process.env.${shortKey}??null}}));});`);
    const first = await execute(root, request());
    assert.equal(first.status, 'completed');
    assert.deepEqual((first.attempts as JsonRecord[])[0]?.output, { present: false, value: null, neutral: null });
    const configPath = path.join(root, '.foundry/providers.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as { adapters: JsonRecord[] };
    config.adapters[0]!.environment = [key, shortKey];
    await writeFile(configPath, JSON.stringify(config));
    const second = await execute(root, request());
    assert.equal(second.status, 'completed');
    assert.deepEqual((second.attempts as JsonRecord[])[0]?.output, {
      present: true,
      value: '[redacted]',
      neutral: '[redacted]',
    });
    assert.equal(JSON.stringify(second).includes(process.env[key]!), false);
    assert.equal(JSON.stringify(second).includes(process.env[shortKey]!), false);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
    if (previousShort === undefined) delete process.env[shortKey];
    else process.env[shortKey] = previousShort;
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
  await assert.rejects(execute(root, { ...request(), adapter: 'chatgpt' }), /unsupported by this runtime; configure a supported provider adapter/);
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
  await assert.rejects(execute(root, { adapter: 'codex', prompt: 'work', billing: { mode: 'api', allow_api: true } }), /explicit consent/);
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

async function configureAdapter(root: string, changes: JsonRecord, script: string): Promise<void> {
  const configPath = path.join(root, '.foundry/providers.json');
  const config = JSON.parse(await readFile(configPath, 'utf8')) as { adapters: JsonRecord[] };
  Object.assign(config.adapters[0]!, changes);
  await writeFile(configPath, JSON.stringify(config));
  await writeFile(path.join(root, 'fake.mjs'), script);
}

function apiRequest(billing: JsonRecord = {}, budget: JsonRecord = {}): JsonRecord {
  return {
    ...request(),
    billing: { mode: 'api', allow_api: true, acknowledge_posthoc_cost: true, reservation_dollars: 0.5, ...billing },
    budget: { max_elapsed_seconds: 5, max_api_dollars: 1, ...budget },
  };
}

const METERED = [...['jsonl', 'structured_output', 'resume', 'cancel', 'permissions', 'model_selection', 'reasoning_selection'], 'usage_metering'];

test('brokered credentials reach the upstream without entering the adapter environment or saved state', async (t) => {
  const secret = 'fixture-provider-secret-5521';
  const previous = process.env.FOUNDRY_PROVIDER_TEST_SECRET;
  process.env.FOUNDRY_PROVIDER_TEST_SECRET = secret;
  const received: string[] = [];
  const { createServer } = await import('node:http');
  const upstream = createServer((incoming, response) => {
    received.push(String(incoming.headers['x-api-key']));
    response.end(JSON.stringify({ answer: 'fixture' }));
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const root = await project();
  t.after(async () => {
    if (previous === undefined) delete process.env.FOUNDRY_PROVIDER_TEST_SECRET;
    else process.env.FOUNDRY_PROVIDER_TEST_SECRET = previous;
    upstream.close();
    await rm(root, { recursive: true, force: true });
  });
  const port = (upstream.address() as { port: number }).port;
  await configureAdapter(root, {
    capabilities: METERED, billing_modes: ['local', 'api'],
    credentials: [{
      id: 'fixture-api', delivery: 'broker', source_env: 'FOUNDRY_PROVIDER_TEST_SECRET', billing_modes: ['api'],
      upstream: `http://127.0.0.1:${port}`, header: 'x-api-key', base_url_env: 'FIXTURE_BASE_URL', token_env: 'FIXTURE_API_KEY',
    }],
  }, `process.stdin.on('data', async () => {
    const reply = await fetch(process.env.FIXTURE_BASE_URL + '/v1/messages', { method: 'POST', headers: { 'x-api-key': process.env.FIXTURE_API_KEY }, body: '{}' });
    const answer = await reply.json();
    const values = Object.values(process.env);
    console.log(JSON.stringify({ type: 'session.started', session_id: 'broker-session' }));
    console.log(JSON.stringify({ type: 'usage', reliable: true, input_tokens: 3, output_tokens: 1, api_dollars: 0.01 }));
    console.log(JSON.stringify({ type: 'result', status: 'completed', output: { answer, token: process.env.FIXTURE_API_KEY, saw_raw_value: values.includes(${JSON.stringify(secret)}) }, usage: { reliable: true, input_tokens: 3, output_tokens: 1, api_dollars: 0.01 } }));
  });`);
  const inspection = await inspectAdapter(root, (await registry(root)).fixture!);
  assert.equal(JSON.stringify(inspection).includes(secret), false);
  const result = await execute(root, apiRequest());
  assert.equal(result.status, 'completed');
  const attempt = (result.attempts as JsonRecord[])[0]!;
  assert.deepEqual(attempt.output, { answer: { answer: 'fixture' }, token: '[redacted]', saw_raw_value: false });
  assert.deepEqual(received, [secret]);
  assert.deepEqual(attempt.credentials, [{
    id: 'fixture-api', delivery: 'broker', source_env: 'FOUNDRY_PROVIDER_TEST_SECRET', exposed_to_adapter_process: false,
    upstream_origin: `http://127.0.0.1:${port}`, requests: 1, rejected_requests: 0,
  }]);
  const evidence = await readFile(path.join(root, String(attempt.evidence)), 'utf8');
  const saved = await readFile(path.join(root, `.foundry/state/providers/tasks/${String(result.task_id)}.json`), 'utf8');
  for (const text of [JSON.stringify(result), evidence, saved]) assert.equal(text.includes(secret), false);
});

test('missing selected credentials fail closed before a provider starts', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  delete process.env.FOUNDRY_PROVIDER_MISSING_SECRET;
  await configureAdapter(root, {
    capabilities: METERED, billing_modes: ['local', 'api'],
    credentials: [{ id: 'absent', delivery: 'environment', source_env: 'FOUNDRY_PROVIDER_MISSING_SECRET', target_env: 'PROVIDER_KEY', billing_modes: ['api'] }],
  }, "process.stdin.on('data',()=>process.exit(9));");
  await assert.rejects(execute(root, apiRequest()), /Selected credentials are not set: absent/);
  await assert.rejects(readdir(path.join(root, '.foundry/state/providers/tasks')));
  assert.equal((await execute(root, { ...request(), budget: { max_elapsed_seconds: 2 } })).status, 'failed');
});

test('API billing without usage metering or a provider-enforced limit is refused', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  await configureAdapter(root, { billing_modes: ['local', 'api'] }, "process.stdin.on('data',()=>process.exit(9));");
  await assert.rejects(execute(root, apiRequest()), /unbounded paid execution is refused/);
  await assert.rejects(execute(root, apiRequest({ allow_api: false, provider_limit_dollars: 1 })), /explicit consent/);
  await assert.rejects(execute(root, apiRequest({ provider_limit_dollars: 2 })), /above max_api_dollars/);
  await assert.rejects(execute(root, { ...request(), billing: { mode: 'local', provider_limit_dollars: 1 } }), /Only API billing/);
  await assert.rejects(readdir(path.join(root, '.foundry/state/providers/tasks')));
});

test('owner-attested provider limits are recorded separately from post-hoc accounting', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  await configureAdapter(root, { billing_modes: ['local', 'api'] }, `process.stdin.on('data',()=>{console.log(JSON.stringify({type:'session.started',session_id:'limit'}));console.log(JSON.stringify({type:'result',status:'completed',output:{ok:true},usage:{reliable:true,input_tokens:1,output_tokens:1,api_dollars:0.2}}));});`);
  const result = await execute(root, apiRequest({ provider_limit_dollars: 0.75 }));
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.spend_control, {
    mode: 'api', max_api_dollars: 1, reservation_dollars: 0.5,
    provider_enforced_limit_dollars: 0.75, provider_enforced_limit: 'owner_attested_not_verified',
    runtime_metering: 'none', runtime_stop: 'cancel_at_reservation', accounting: 'post_hoc_provider_reported', hard_dollar_cap: false,
  });
  assert.match(String(result.billing_assurance), /did not verify/);
  assert.equal((result.usage as JsonRecord).known_api_dollars, 0.2);
});

test('streamed usage stops the provider at its reservation and blocks further paid attempts', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  await configureAdapter(root, { capabilities: METERED, billing_modes: ['local', 'api'] }, `process.stdin.on('data',()=>{
    const emit = value => console.log(JSON.stringify(value));
    emit({type:'session.started',session_id:'metered'});
    emit({type:'usage',reliable:false,api_dollars:9});
    emit({type:'usage',reliable:true,input_tokens:10,output_tokens:2,api_dollars:0.2});
    setTimeout(()=>emit({type:'usage',reliable:true,input_tokens:40,output_tokens:9,api_dollars:0.55}),50);
    setInterval(()=>{},1000);
  });`);
  const started = Date.now();
  const result = await execute(root, apiRequest({}, { max_attempts: 2 }));
  assert.ok(Date.now() - started < 4000, 'metered stop should not wait for the elapsed budget');
  assert.equal(result.status, 'budget_exceeded');
  const attempt = (result.attempts as JsonRecord[])[0]!;
  assert.equal((attempt.error as JsonRecord).code, 'reservation_reached');
  assert.deepEqual(attempt.metered_usage, { input_tokens: 40, output_tokens: 9, api_dollars: 0.55, events: 2 });
  assert.equal((attempt.usage as JsonRecord).api_dollars, null);
  assert.equal((result.usage as JsonRecord).api_dollars, null);
  assert.equal((result.usage as JsonRecord).known_api_dollars, 0.55);
  assert.equal((result.spend_control as JsonRecord).runtime_metering, 'adapter_usage_events');
  assert.equal((result.spend_control as JsonRecord).hard_dollar_cap, false);
  await assert.rejects(execute(root, apiRequest({}, { max_attempts: 2 }), String(result.task_id)), /cost is unknown/);
});

test('streamed usage must be cumulative and API charges outside API billing stop the provider', async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  await configureAdapter(root, {}, `process.stdin.on('data',()=>{
    console.log(JSON.stringify({type:'usage',reliable:true,output_tokens:5}));
    console.log(JSON.stringify({type:'usage',reliable:true,output_tokens:2}));
    setInterval(()=>{},1000);
  });`);
  const regressed = await execute(root, request());
  assert.equal(regressed.status, 'unknown');
  assert.equal(((regressed.attempts as JsonRecord[])[0]!.error as JsonRecord).code, 'invalid_usage');
  const second = await project();
  t.after(() => rm(second, { recursive: true, force: true }));
  await writeFile(path.join(second, 'fake.mjs'), `process.stdin.on('data',()=>{console.log(JSON.stringify({type:'usage',reliable:true,api_dollars:0.01}));setInterval(()=>{},1000);});`);
  const charged = await execute(second, request());
  assert.equal(charged.status, 'billing_violation');
  assert.equal(((charged.attempts as JsonRecord[])[0]!.error as JsonRecord).code, 'unexpected_api_charge');
});

test('credential-like names passed through environment are recorded as exposed', async (t) => {
  const previous = process.env.FOUNDRY_FIXTURE_API_TOKEN;
  process.env.FOUNDRY_FIXTURE_API_TOKEN = 'fixture-exposed-value-3310';
  const root = await project();
  t.after(async () => {
    if (previous === undefined) delete process.env.FOUNDRY_FIXTURE_API_TOKEN;
    else process.env.FOUNDRY_FIXTURE_API_TOKEN = previous;
    await rm(root, { recursive: true, force: true });
  });
  await configureAdapter(root, { environment: ['FOUNDRY_FIXTURE_API_TOKEN', 'FOUNDRY_FIXTURE_REGION'] }, `process.stdin.on('data',()=>{console.log(JSON.stringify({type:'session.started',session_id:'exposed'}));console.log(JSON.stringify({type:'result',status:'completed',output:{seen:process.env.FOUNDRY_FIXTURE_API_TOKEN}}));});`);
  const result = await execute(root, request());
  assert.equal(result.status, 'completed');
  const attempt = (result.attempts as JsonRecord[])[0]!;
  assert.deepEqual(attempt.credentials, [{
    id: 'foundry-fixture-api-token', delivery: 'environment', source_env: 'FOUNDRY_FIXTURE_API_TOKEN', exposed_to_adapter_process: true,
  }]);
  assert.deepEqual(attempt.output, { seen: '[redacted]' });
});
