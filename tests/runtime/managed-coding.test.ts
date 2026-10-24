import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { approveScope, saveTaskPlan, start, reviewScope, workContext } from '../../src/core/lifecycle.js';
import { managedProfileSchema, type ManagedProfile } from '../../src/core/managed-profile.js';
import { ManagedService } from '../../src/runtime/managed-service.js';
import { readManagedClaim } from '../../src/core/workspace-ownership.js';
import { executableDigest } from '../../src/runtime/opencode.js';
import { inspectManagedLaunch, ManagedExecutorError } from '../../src/runtime/managed-opencode.js';

const binary = process.env.FOUNDRY_OPENCODE_QUALIFY_BINARY;
const runtime = path.resolve(process.env.FOUNDRY_MANAGED_TEST_RUNTIME ?? 'dist/runtime');
const cli = path.join(runtime, 'foundry.cjs');
const good = 'export function add(a: number, b: number): number { return a + b; }\n';
const bad = 'export function add(a: number, b: number): number { return a - b; }\n';
if (process.env.FOUNDRY_MANAGED_QUALIFICATION === 'required' && (!binary || process.platform !== 'linux')) throw new Error('Managed executor qualification needs the selected Linux binary; skipping is forbidden');

async function waitFor(check: () => Promise<boolean>, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await delay(50); }
  throw new Error('Timed out waiting for managed execution');
}

async function setup(t: TestContext, approved = true) {
  const previousSentinel = process.env.FOUNDRY_SUPERVISOR_SENTINEL;
  process.env.FOUNDRY_SUPERVISOR_SENTINEL = 'private-supervisor-value-do-not-forward';
  t.after(() => {
    if (previousSentinel === undefined) delete process.env.FOUNDRY_SUPERVISOR_SENTINEL;
    else process.env.FOUNDRY_SUPERVISOR_SENTINEL = previousSentinel;
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-managed-coding-'));
  const root = path.join(directory, 'project');
  const storage = path.join(directory, 'private');
  await mkdir(root, { mode: 0o700 });
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({ schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: 'fixture', source_pin: 'a'.repeat(64) }));
  await writeFile(path.join(root, '.foundry/roles.json'), await readFile('.foundry/roles.json'));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'Managed executor test', checks: [
    { name: 'behavior', command: ['./check.cjs'], inputs: ['math.ts', 'behavior.test.mjs', 'check.cjs'] },
  ] }));
  await writeFile(path.join(root, 'check.cjs'), `#!${process.execPath}\nvoid import('./behavior.test.mjs');\n`, { mode: 0o700 });
  await writeFile(path.join(root, 'math.ts'), bad);
  await writeFile(path.join(root, 'behavior.test.mjs'), `import assert from 'node:assert/strict';
import { add } from './math.ts';
assert.equal(add(2, 3), 5); assert.equal(add(-2, 1), -1);
assert.equal(process.env.FOUNDRY_SUPERVISOR_SENTINEL, undefined);
assert.equal(process.env.OPENCODE_SERVER_PASSWORD, undefined);
`);
  await writeFile(path.join(root, 'spec.md'), '# Addition\nImplement correct typed addition.');
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ schema_version: 1, criteria: [{ id: 'CODE-01', requirement: 'Addition works', checks: ['behavior'] }] }));
  await start(root, 'addition', 'spec.md', 'scope.json');
  await saveTaskPlan(root, { planner_role: 'planner', reviewer_role: 'quality-gate', tasks: [
    { id: 'ADD', title: 'Correct addition', instructions: 'Implement addition. Preserve existing owner files.', role: 'ts-expert', criteria: ['CODE-01'], depends_on: [] },
  ] }, (await workContext(root)).snapshot_revision);
  if (approved) await approveScope(root, (await reviewScope(root)).revision);
  const services: ManagedService[] = [];
  const open = async () => { const service = await ManagedService.open(root, storage, runtime); services.push(service); return service; };
  const service = await open();
  let tool = 'write';
  let source = good;
  let shell = '';
  const requests: Array<{ model: string; messages: Array<{ role: string; content?: unknown }> }> = [];
  const errors: string[] = [];
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let text = '';
      for await (const chunk of request) { text += String(chunk); assert.ok(Buffer.byteLength(text) < 1_048_576); }
      const body = JSON.parse(text);
      const hasTools = body.tools?.length > 0;
      if (hasTools) requests.push(body);
      assert.ok(requests.length <= 16, 'bounded model request count');
      const answered = body.messages.some((message: { role: string }) => message.role === 'tool');
      const call = hasTools && !answered;
      const delta = call ? { tool_calls: [{ index: 0, id: `call_${requests.length}`, type: 'function', function: { name: tool,
        arguments: JSON.stringify(tool === 'write' ? { filePath: path.join(root, 'math.ts'), content: source }
          : { command: shell, timeout: 60_000, description: 'Local long running test' }),
      } }] } : { content: 'Task candidate prepared. FOUNDRY_SUPERVISOR_SENTINEL must never be echoed.' };
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const [part, finish] of [[{ role: 'assistant' }, null], [delta, null], [{}, call ? 'tool_calls' : 'stop']]) response.write(`data: ${JSON.stringify({ id: 'chatcmpl-local', object: 'chat.completion.chunk', created: 1,
        model: 'test-model', choices: [{ index: 0, delta: part, finish_reason: finish }] })}\n\n`);
      response.end('data: [DONE]\n\n');
    } catch (error) { errors.push(String(error)); response.writeHead(400).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const profile: ManagedProfile = { schemaVersion: 1, id: randomUUID(), consentRef: randomUUID(), boundary: 'trusted-local-disposable', inference: 'local-test-only',
    binary: binary ?? process.execPath, binaryDigest: await executableDigest(binary ?? process.execPath),
    provider: { id: 'local-test', model: 'test-model', baseURL: `http://127.0.0.1:${address.port}/v1` },
    permissions: 'read-edit-shell', maxTurns: 3, maxSteps: 4, deadlineMs: 45_000 };
  const profileFile = path.join(directory, 'profile.json');
  await writeFile(profileFile, JSON.stringify(profile));
  t.after(async () => {
    await Promise.all(services.map(service => service.close()));
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
    assert.deepEqual(errors, []);
  });
  const configure = (options: { tool?: string; source?: string; shell?: string }) => { tool = options.tool ?? 'write'; source = options.source ?? good; shell = options.shell ?? ''; };
  const command = async (args: string[], started?: (child: ReturnType<typeof spawn>) => void) => {
    const child = spawn(process.execPath, [cli, 'session', ...args, '--project', root, '--storage', storage, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    started?.(child);
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { error += chunk; });
    const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    return { code, value: output ? JSON.parse(output) : null, error };
  };
  return { root, storage, service, open, profile, profileFile, command, configure, requests };
}

test('managed profiles require explicit authority, model, permission, limits and local-only inference', () => {
  const profile = { schemaVersion: 1, id: randomUUID(), consentRef: randomUUID(), boundary: 'trusted-local-disposable', inference: 'local-test-only',
    binary: process.execPath, binaryDigest: 'a'.repeat(64), provider: { id: 'test', model: 'test', baseURL: 'http://127.0.0.1:1234/v1' }, permissions: 'read-edit', maxTurns: 2, maxSteps: 4, deadlineMs: 5000 };
  assert.equal(managedProfileSchema.safeParse(profile).success, true);
  for (const key of ['consentRef', 'provider', 'permissions', 'maxSteps', 'boundary']) {
    const altered: Record<string, unknown> = { ...profile }; delete altered[key];
    assert.equal(managedProfileSchema.safeParse(altered).success, false);
  }
  for (const baseURL of ['https://provider.example/v1', 'http://localhost:1234/v1', 'http://user:secret@127.0.0.1:1234/v1', 'http://127.0.0.1:1234/v1?key=value']) assert.equal(managedProfileSchema.safeParse({ ...profile, provider: { ...profile.provider, baseURL } }).success, false);
  assert.equal(managedProfileSchema.safeParse({ ...profile, owner: { id: randomUUID() } }).success, false);
});

test('managed service refuses unapproved assignments without any upstream request', async t => {
  const fixture = await setup(t, false);
  await assert.rejects(fixture.service.start(fixture.profile, randomUUID()));
  assert.equal(await readManagedClaim(fixture.root), null);
  assert.equal(fixture.requests.length, 0);
  await assert.rejects(ManagedService.open(fixture.root, path.join(fixture.root, 'private-storage'), runtime), /outside the project/);
  await assert.rejects(readFile(path.join(fixture.root, 'private-storage/identity.json')), { code: 'ENOENT' });
});

test('managed preflight rejects non-executable selections without creating or consuming a session', async t => {
  const { root, storage, service, profile, requests } = await setup(t);
  const selected = path.join(storage, 'selected-opencode');
  await writeFile(selected, '#!/bin/sh\nexit 0\n', { mode: 0o600 });
  const invalid = { ...profile, binary: selected, binaryDigest: await executableDigest(selected) };
  await assert.rejects(service.start(invalid, randomUUID()), /executable file/);
  assert.equal(await readManagedClaim(root), null);
  await chmod(selected, 0o700);
  const queued = await service.start(invalid, randomUUID());
  await chmod(selected, 0o600);
  await assert.rejects(service.run(invalid), /executable file/);
  assert.deepEqual(await service.status(), queued);
  assert.equal(requests.length, 0);
  await service.control('stop', randomUUID(), queued.revision);
  await service.release();
});

test('oversized managed assignments fail before reserving a project or claiming execution', async t => {
  const { root, service, profile, requests } = await setup(t);
  await writeFile(path.join(root, 'spec.md'), '# Addition\n' + 'Explicit assignment detail.\n'.repeat(2400));
  await approveScope(root, (await reviewScope(root)).revision);
  await assert.rejects(service.start(profile, randomUUID()), /prompt limit/);
  assert.equal(await readManagedClaim(root), null);
  assert.equal(requests.length, 0);
});

test('managed start and resume reject changed authority and executor bindings before dispatch', async t => {
  for (const filename of ['spec.md', '.foundry/roles.json', '.foundry/project.json']) await t.test(filename, async t => {
    const { service, profile, root, requests } = await setup(t);
    await service.start(profile, randomUUID());
    const queued = await service.status();
    const paused = await service.control('pause', randomUUID(), queued.revision);
    assert.equal(paused.state.status, 'paused');
    const original = await readFile(path.join(root, filename), 'utf8');
    await writeFile(path.join(root, filename), filename === 'spec.md' ? `${original}\nChanged scope.`
      : filename.endsWith('roles.json') ? original.replace('TypeScript', 'Changed TypeScript')
        : JSON.stringify({ ...JSON.parse(original), checks: [{ name: 'behavior', command: ['./check.cjs'], inputs: ['math.ts'] }] }));
    assert.notEqual(await readFile(path.join(root, filename), 'utf8'), original);
    await assert.rejects(service.control('resume', randomUUID(), paused.revision));
    assert.equal((await service.status()).state.status, 'paused');
    assert.equal(requests.length, 0);
  });
  await t.test('changed binary', async t => {
    const { service, profile, root, requests } = await setup(t);
    await assert.rejects(service.start({ ...profile, binaryDigest: 'a'.repeat(64) }, randomUUID()), /binary changed/);
    assert.equal(await readManagedClaim(root), null);
    assert.equal(requests.length, 0);
  });
});

test('real managed OpenCode tools fail checks, repair explicitly and record only core evidence', { skip: !binary, timeout: 120_000 }, async t => {
  const fixture = await setup(t);
  const { service, profile, root, configure } = fixture;
  const requestId = randomUUID();
  const initial = await service.start(profile, requestId);
  assert.equal(initial.state.status, 'queued');
  assert.equal((await service.start(profile, requestId)).id, initial.id);
  configure({ source: bad });
  const first = await service.run(profile);
  if (first.state.status !== 'awaiting-verification') t.diagnostic(JSON.stringify(await readLaunches(fixture.storage)));
  assert.equal(first.state.status, 'awaiting-verification');
  await assert.rejects(service.record(), /core-verified/);
  const failed = await service.verify();
  assert.equal(failed.state.status, 'failed');
  const retryId = randomUUID();
  await service.control('retry', retryId, failed.revision);
  assert.equal((await service.control('retry', retryId, failed.revision)).state.status, 'queued');
  configure({ source: good });
  assert.equal((await service.run(profile)).state.status, 'awaiting-verification');
  assert.equal(await readFile(path.join(root, 'math.ts'), 'utf8'), good);
  assert.equal((await service.verify()).state.status, 'recording-task');
  assert.equal((await service.record()).state.status, 'stopped');
  assert.equal((await service.record()).state.status, 'stopped');
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'done');
  assert.equal((await service.status()).turnsUsed, 2);
  const events = await service.events();
  assert.ok(events.events.some(event => event.data.kind === 'output'));
  assert.ok(!JSON.stringify(events).includes('FOUNDRY_SUPERVISOR_SENTINEL'));
  assert.ok(!JSON.stringify(events).includes(process.env.FOUNDRY_SUPERVISOR_SENTINEL!));
  assert.ok(events.events.some(event => event.data.kind === 'task-recorded'));
  assert.deepEqual((await service.events(events.nextCursor)).events, []);
  await service.release();
  assert.equal(await readManagedClaim(root), null);
});

async function readLaunches(storage: string) {
  const result = [];
  for (const session of await readdir(path.join(storage, 'executions'))) for (const execution of await readdir(path.join(storage, 'executions', session))) result.push(JSON.parse(await readFile(path.join(storage, 'executions', session, execution, 'launch.json'), 'utf8')));
  return result;
}

test('packaged CLI pauses a real active tool, resumes with owner edits and verifies the candidate', { skip: !binary, timeout: 120_000 }, async t => {
  const fixture = await setup(t);
  const { root, service, profile, profileFile, command, configure } = fixture;
  assert.equal((await command(['start', '--profile', profileFile, '--request-id', randomUUID()])).code, 2);
  const started = await command(['start', '--profile', profileFile, '--confirmed', '--request-id', randomUUID()]);
  assert.equal(started.code, 0, started.error);
  const ticker = path.join(root, 'ticks.txt');
  const pidFile = path.join(root, 'tool.pid');
  const descendantPid = path.join(root, 'descendant.pid');
  const detached = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(descendantPid)},String(process.pid));setInterval(()=>fs.appendFileSync(${JSON.stringify(ticker)},'tick\\n'),25)`;
  const script = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(detached)}],{detached:true,stdio:'ignore'}).unref();setInterval(()=>{},1000);`;
  await writeFile(path.join(root, 'long-tool.cjs'), script);
  configure({ tool: 'bash', shell: `${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(root, 'long-tool.cjs'))}` });
  const running = command(['run', '--profile', profileFile]);
  await Promise.race([
    waitFor(async () => (await readFile(ticker, 'utf8').catch(() => '')).length > 10),
    running.then(result => { throw new Error(`Executor ended before the tool started: ${JSON.stringify(result)}; requests=${fixture.requests.length}`); }),
  ]);
  const active = await service.status();
  assert.equal((await command(['pause', '--request-id', randomUUID(), '--expected-revision', String(active.revision)])).value.state.status, 'pausing');
  assert.equal((await running).value.state.status, 'paused');
  const pid = Number(await readFile(pidFile, 'utf8'));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  await waitFor(async () => {
    try { process.kill(Number(await readFile(descendantPid, 'utf8')), 0); return false; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error; }
  });
  const frozen = await readFile(ticker, 'utf8');
  await delay(400);
  assert.equal(await readFile(ticker, 'utf8'), frozen);
  await writeFile(path.join(root, 'owner-note.txt'), 'Keep this owner change.');
  const paused = await service.status();
  const resumeId = randomUUID();
  assert.equal((await command(['resume', '--request-id', resumeId, '--expected-revision', String(paused.revision)])).value.state.status, 'queued');
  assert.equal((await command(['resume', '--request-id', resumeId, '--expected-revision', String(paused.revision)])).value.state.status, 'queued');
  configure({ source: good });
  assert.equal((await command(['run', '--profile', profileFile])).value.state.status, 'awaiting-verification');
  assert.equal(await readFile(path.join(root, 'owner-note.txt'), 'utf8'), 'Keep this owner change.');
  assert.equal((await command(['verify'])).value.state.status, 'recording-task');
  assert.equal((await command(['record'])).value.state.status, 'stopped');
  assert.equal((await command(['release'])).value.released, true);
});

test('managed CLI denies ungranted shell tools and stops without recording a task', { skip: !binary, timeout: 120_000 }, async t => {
  const { root, profile, profileFile, command, configure } = await setup(t);
  await writeFile(profileFile, JSON.stringify({ ...profile, permissions: 'read-edit' }));
  assert.equal((await command(['start', '--profile', profileFile, '--confirmed', '--request-id', randomUUID()])).code, 0);
  configure({ tool: 'bash', shell: 'printf forbidden > forbidden.txt' });
  const run = await command(['run', '--profile', profileFile]);
  assert.equal(run.code, 0, run.error);
  await assert.rejects(readFile(path.join(root, 'forbidden.txt')), { code: 'ENOENT' });
  assert.equal((await command(['verify'])).value.state.status, 'failed');
  const failed = (await command(['status'])).value;
  assert.equal((await command(['stop', '--request-id', randomUUID(), '--expected-revision', String(failed.revision)])).value.state.status, 'stopped');
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  assert.equal((await command(['release'])).value.released, true);
});

test('managed CLI confirms active Stop only after tool output freezes and the process exits', { skip: !binary, timeout: 120_000 }, async t => {
  const { root, service, profile, profileFile, command, configure } = await setup(t);
  await service.start(profile, randomUUID());
  const ticker = path.join(root, 'stop-ticks.txt');
  const pidFile = path.join(root, 'stop-tool.pid');
  await writeFile(path.join(root, 'stop-tool.cjs'), `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>fs.appendFileSync(${JSON.stringify(ticker)},'tick\\n'),25);`);
  configure({ tool: 'bash', shell: `${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(root, 'stop-tool.cjs'))}` });
  const running = command(['run', '--profile', profileFile]);
  await waitFor(async () => (await readFile(ticker, 'utf8').catch(() => '')).length > 10);
  const active = await service.status();
  assert.equal((await command(['stop', '--request-id', randomUUID(), '--expected-revision', String(active.revision)])).value.state.status, 'stopping');
  assert.equal((await running).value.state.status, 'stopped');
  const pid = Number(await readFile(pidFile, 'utf8'));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  const frozen = await readFile(ticker, 'utf8');
  await delay(400);
  assert.equal(await readFile(ticker, 'utf8'), frozen);
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  assert.equal((await command(['release'])).value.released, true);
});

test('crashed CLI retains a live tool claim and recovers only after expiry and stopped-resource inspection', { skip: !binary, timeout: 150_000 }, async t => {
  const fixture = await setup(t);
  const { root, storage, service, profile, profileFile, command, configure, requests } = fixture;
  await service.start(profile, randomUUID());
  const pidFile = path.join(root, 'crash-tool.pid');
  await writeFile(path.join(root, 'crash-tool.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));setInterval(()=>{},1000);`);
  configure({ tool: 'bash', shell: `${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(root, 'crash-tool.cjs'))}` });
  let child: ReturnType<typeof spawn> | undefined;
  const running = command(['run', '--profile', profileFile], value => { child = value; });
  await waitFor(async () => Boolean(await readFile(pidFile, 'utf8').catch(() => '')));
  const active = await service.status();
  assert.ok(active.state.status === 'running');
  const executionId = active.state.executionId;
  const toolPid = Number(await readFile(pidFile, 'utf8'));
  const launch = (await readLaunches(storage)).find(record => record.executionId === executionId)!;
  const killResources = () => {
    for (const pid of [toolPid, -launch.pid]) try { process.kill(pid, 'SIGKILL'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  t.after(killResources);
  child!.kill('SIGKILL');
  await running;
  const count = requests.length;
  assert.equal((await fixture.open()).root, root);
  assert.equal((await service.status()).state.status, 'running');
  assert.equal((await inspectManagedLaunch(path.join(storage, 'executions'), active.id, executionId)).stopped, false);
  assert.ok(await readManagedClaim(root));
  await assert.rejects(service.run(profile));
  assert.equal(requests.length, count);
  await delay(Math.max(0, Date.parse(active.state.lease.expiresAt) - Date.now() + 100));
  const inspection = (await command(['recover'])).value;
  assert.equal(inspection.stopped, false);
  assert.equal((await command(['recover', '--inspection-digest', inspection.digest])).code, 2);
  assert.equal((await service.status()).state.status, 'recovery-required');
  killResources();
  await waitFor(async () => {
    try { return (await inspectManagedLaunch(path.join(storage, 'executions'), active.id, executionId)).stopped; }
    catch (error) { if (error instanceof ManagedExecutorError && !error.resourcesStopped) return false; throw error; }
  });
  const stopped = (await command(['recover'])).value;
  assert.equal((await command(['recover', '--inspection-digest', 'a'.repeat(64)])).code, 2);
  const recovered = (await command(['recover', '--inspection-digest', stopped.digest])).value;
  assert.equal(recovered.state.status, 'failed');
  assert.equal((await command(['stop', '--request-id', randomUUID(), '--expected-revision', String(recovered.revision)])).value.state.status, 'stopped');
  assert.equal(requests.length, count);
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  assert.equal((await command(['release'])).value.released, true);
});
