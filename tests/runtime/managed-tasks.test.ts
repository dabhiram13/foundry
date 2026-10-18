import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { approveScope, finishTask, prepareAssignment, reviewScope, saveTaskPlan, start, verify, workContext } from '../../src/core/lifecycle.js';
import { createManagedFixtureTask, dispatchFixtureTurn, publishManagedTask, recoverManagedCreation, releaseManagedTask, verifyManagedCandidate } from '../../src/core/managed-tasks.js';
import { SessionError, sessionCommandSchema, type ManagedSession, type SessionActor } from '../../src/core/session-contract.js';
import { inspectWorkspaceAdmissions, readManagedClaim, reconcileWorkspaceAdmission, withWorkspaceMutation } from '../../src/core/workspace-ownership.js';
import { SessionStore } from '../../src/runtime/session-store.js';
import { initFactory } from '../../src/core/factory.js';
import { execute } from '../../src/runtime/providers.js';

const runtime = path.resolve('dist/runtime');
const options = () => ({ profileId: randomUUID(), consentRef: randomUUID(), maxTurns: 3 });
const owner = { kind: 'owner', id: randomUUID() } as const;
const supervisor = { kind: 'supervisor', id: randomUUID() } as const;
const inspector = { kind: 'inspector', id: randomUUID() } as const;
const good = 'export function add(a: number, b: number): number { return a + b; }\n';
const bad = 'export function add(a: number, b: number): number { return a - b; }\n';

async function project(t: TestContext, approved = true, slow = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-managed-task-'));
  const storage = await mkdtemp(path.join(os.tmpdir(), 'foundry-managed-store-'));
  const stores: SessionStore[] = [];
  async function open() { const store = await SessionStore.open(storage, runtime); stores.push(store); return store; }
  t.after(async () => { await Promise.all(stores.map(store => store.close())); await rm(root, { recursive: true, force: true }); await rm(storage, { recursive: true, force: true }); });
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({ schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: 'fixture', source_pin: 'a'.repeat(64) }));
  await writeFile(path.join(root, '.foundry/roles.json'), await readFile('.foundry/roles.json'));
  await writeFile(path.join(root, '.foundry/providers.json'), JSON.stringify({ adapters: [{
    name: 'fixture', kind: 'agent-runtime', command: [process.execPath, '-e', 'process.exit(99)'],
    capabilities: ['jsonl', 'structured_output', 'resume', 'cancel', 'permissions', 'tools'], billing_modes: ['local'],
  }] }));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'managed fixture', checks: [
    { name: 'behavior', command: ['./check-behavior.cjs'], inputs: ['math.ts', 'behavior.test.mjs', 'check-behavior.cjs'] },
    { name: 'types', command: ['./check-types.cjs', '--project', 'tsconfig.json'], inputs: ['math.ts', 'tsconfig.json', 'check-types.cjs'] },
  ] }));
  await writeFile(path.join(root, 'check-behavior.cjs'), `#!${process.execPath}\nvoid import('./behavior.test.mjs');\n`, { mode: 0o700 });
  await writeFile(path.join(root, 'check-types.cjs'), `#!${process.execPath}\nrequire(${JSON.stringify(path.resolve('node_modules/typescript/lib/tsc.js'))});\n`, { mode: 0o700 });
  await writeFile(path.join(root, 'math.ts'), good);
  await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2023', types: [] }, files: ['math.ts'] }));
  await writeFile(path.join(root, 'behavior.test.mjs'), `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { add } from './math.ts';
${slow ? 'await new Promise(resolve => setTimeout(resolve, 1200));' : ''}
test('adds positive, negative and decimal values', () => { assert.equal(add(2, 3), 5); assert.equal(add(-2, 1), -1); assert.equal(add(1.5, 2), 3.5); });
test('does not receive supervisor secrets or Node injection settings', () => { assert.equal(process.env.FOUNDRY_SUPERVISOR_SENTINEL, undefined); assert.equal(process.env.NODE_OPTIONS, undefined); assert.equal(process.env.NODE_PATH, undefined); });
`);
  await writeFile(path.join(root, 'spec.md'), '# Addition\nCorrect typed addition.');
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ schema_version: 1, criteria: [{ id: 'MT-01', requirement: 'Typed addition works', checks: ['behavior', 'types'] }] }));
  await start(root, 'addition', 'spec.md', 'scope.json');
  await saveTaskPlan(root, { planner_role: 'planner', reviewer_role: 'quality-gate', tasks: [
    { id: 'ADD', title: 'Implement addition', instructions: 'Implement typed addition and run both checks.', role: 'ts-expert', criteria: ['MT-01'], depends_on: [] },
  ] }, (await workContext(root)).snapshot_revision);
  if (approved) await approveScope(root, (await reviewScope(root)).revision);
  return { root, open, store: await open() };
}

async function command(store: SessionStore, sessionId: ManagedSession['id'], actor: SessionActor, type: string, fields = {}) {
  const session = await store.get(sessionId, actor);
  await store.accept(sessionCommandSchema.parse({ type, sessionId, requestId: randomUUID(), expectedRevision: session.revision, ...fields }), actor);
  return store.get(sessionId, actor);
}
async function bind(t: TestContext, slow = false) {
  const fixture = await project(t, true, slow);
  const session = await createManagedFixtureTask(fixture.root, fixture.store, owner, options());
  return { ...fixture, session, id: session.id };
}
async function candidate(root: string, store: SessionStore, id: ManagedSession['id'], source = good) {
  await command(store, id, owner, 'message.send', { text: 'Implement only the approved task.' });
  return dispatchFixtureTurn(root, store, owner, supervisor, id, async work => {
    assert.equal(work.assignment.execution, 'host_client');
    await assert.rejects(verify(root), /managed session owns/);
    await writeFile(path.join(work.root, 'math.ts'), source);
    return { resourcesStopped: true, effectsKnown: true };
  });
}
async function waitFor(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt++) { if (await check()) return; await delay(20); }
  throw new Error('Timed out waiting for fixture state');
}

test('real TypeScript edits fail behavior, explicitly repair and record only core-verified task evidence', async t => {
  const { root, store, id, open } = await bind(t);
  const previous = process.env.FOUNDRY_SUPERVISOR_SENTINEL;
  process.env.FOUNDRY_SUPERVISOR_SENTINEL = randomUUID();
  t.after(() => { if (previous === undefined) delete process.env.FOUNDRY_SUPERVISOR_SENTINEL; else process.env.FOUNDRY_SUPERVISOR_SENTINEL = previous; });
  assert.equal((await candidate(root, store, id, bad)).state.status, 'awaiting-verification');
  await assert.rejects(publishManagedTask(root, store, owner, inspector, id), /core-verified/);
  const failed = await verifyManagedCandidate(root, store, owner, supervisor, id);
  assert.equal(failed.state.status, 'failed');
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  const context = await workContext(root);
  const receipt = JSON.parse(await readFile(path.join(root, context.evidence.receipt!), 'utf8'));
  assert.deepEqual(receipt.checks.map((check: { name: string; status: string }) => [check.name, check.status]), [['behavior', 'failed'], ['types', 'passed']]);
  assert.ok(failed.state.status === 'failed');
  await command(store, id, owner, 'session.retry', { failedExecutionId: failed.state.executionId });
  await dispatchFixtureTurn(root, store, owner, supervisor, id, async work => {
    await writeFile(path.join(work.root, 'math.ts'), good);
    return { resourcesStopped: true, effectsKnown: true };
  });
  await store.close();
  const reopened = await open();
  assert.equal((await verifyManagedCandidate(root, reopened, owner, supervisor, id)).state.status, 'recording-task');
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  assert.equal((await publishManagedTask(root, reopened, owner, inspector, id)).state.status, 'stopped');
  assert.equal((await reopened.get(id, owner)).turnsUsed, 2);
  const done = (await workContext(root)).plan?.tasks[0];
  assert.equal(done?.status, 'done');
  assert.ok(done?.evidence?.receipt_sha256);
  const events = (await reopened.events(id, owner)).events;
  assert.equal(events.filter(event => event.data.kind === 'task-recorded').length, 1);
  assert.equal(events.filter(event => event.data.kind === 'verification').length, 2);
  await publishManagedTask(root, reopened, owner, inspector, id);
  await releaseManagedTask(root, reopened, owner, id);
  assert.equal(await readManagedClaim(root), null);
  assert.equal((await prepareAssignment(root, 'reviewer')).execution, 'host_client');
});

test('binding needs approval and the next ready task without dispatch', async t => {
  const { root, store } = await project(t, false);
  await assert.rejects(createManagedFixtureTask(root, store, owner, options()), /approve/);
  assert.equal(await readManagedClaim(root), null);
  await approveScope(root, (await reviewScope(root)).revision);
  // Legacy checks still intentionally inherit the host environment outside managed work.
  assert.equal(await verify(root), 0);
  await finishTask(root, 'ADD', (await workContext(root)).snapshot_revision);
  await assert.rejects(createManagedFixtureTask(root, store, owner, options()), /No pending/);
  assert.equal(await readManagedClaim(root), null);
});

test('different roots cannot reuse project ownership', async t => {
  const first = await bind(t);
  const second = await project(t);
  const claim = await readManagedClaim(first.root);
  assert.ok(claim);
  await mkdir(path.join(second.root, '.foundry/state'), { recursive: true });
  await writeFile(path.join(second.root, '.foundry/state/managed-session.json'), JSON.stringify(claim), { mode: 0o600 });
  await assert.rejects(recoverManagedCreation(second.root, first.store, owner, first.id), /another root/);
});

for (const change of ['scope', 'role', 'checks'] as const) {
  test(`changed ${change} cannot dispatch a previously bound assignment`, async t => {
    const { root, store, id } = await bind(t);
    await command(store, id, owner, 'message.send', { text: 'Implement addition.' });
    const filename = change === 'scope' ? 'spec.md' : change === 'role' ? '.foundry/roles.json' : '.foundry/project.json';
    const full = path.join(root, filename);
    let text = await readFile(full, 'utf8');
    if (change === 'scope') text += '\nChanged approved work.';
    else if (change === 'role') {
      const roles = JSON.parse(text);
      const role = Array.isArray(roles) ? roles.find((entry: { name: string }) => entry.name === 'ts-expert') : roles.roles.find((entry: { name: string }) => entry.name === 'ts-expert');
      role.instructions += '\nChanged role policy.';
      text = JSON.stringify(roles);
    } else {
      const configuration = JSON.parse(text); configuration.checks[0].timeout = 19; text = JSON.stringify(configuration);
    }
    await writeFile(full, text);
    let called = false;
    await assert.rejects(dispatchFixtureTurn(root, store, owner, supervisor, id, async () => { called = true; return { resourcesStopped: true, effectsKnown: true }; }));
    assert.equal(called, false);
    assert.equal((await store.get(id, owner)).state.status, 'queued');
  });
}

test('changed candidate inputs do not launch checks or reuse evidence', async t => {
  const { root, store, id } = await bind(t);
  await candidate(root, store, id);
  await writeFile(path.join(root, 'math.ts'), bad);
  await assert.rejects(verifyManagedCandidate(root, store, owner, supervisor, id), /unchanged confirmed/);
  assert.equal((await workContext(root)).evidence.receipt, null);
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
});

test('core evidence that changes before publication requires inspection', async t => {
  const { root, store, id } = await bind(t);
  await candidate(root, store, id);
  await verifyManagedCandidate(root, store, owner, supervisor, id);
  await writeFile(path.join(root, 'math.ts'), bad);
  await assert.rejects(publishManagedTask(root, store, owner, inspector, id), /evidence changed/);
  await assert.rejects(command(store, id, owner, 'session.stop'), (error: unknown) => error instanceof SessionError && error.code === 'invalid_state');
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  await command(store, id, inspector, 'task.abandon', { inspectionDigest: 'a'.repeat(64), resourcesStopped: true, effectsKnown: true });
  await releaseManagedTask(root, store, owner, id);
});

test('ownership blocks scoped, Factory and provider writes across restart', async t => {
  const { root, store, id, open } = await bind(t);
  await store.close();
  const reopened = await open();
  await recoverManagedCreation(root, reopened, owner, id);
  await assert.rejects(verify(root), /managed session owns/);
  await assert.rejects(approveScope(root, (await reviewScope(root)).revision), /managed session owns/);
  await assert.rejects(withWorkspaceMutation(root, 'factory', async () => {}), /managed session owns/);
  await assert.rejects(withWorkspaceMutation(root, 'provider', async () => {}), /managed session owns/);
  await assert.rejects(initFactory(root, { name: 'Competing work', idea: 'Do not start', adapter: 'fixture', billing: 'local' }), /managed session owns/);
  await assert.rejects(execute(root, { adapter: 'fixture', kind: 'agent-runtime', prompt: 'Do not start', billing: { mode: 'local' } }), /managed session owns/);
  assert.equal((await reopened.get(id, owner)).state.status, 'idle');
  await command(reopened, id, owner, 'session.stop');
  await releaseManagedTask(root, reopened, owner, id);
});

test('legacy mutations can overlap, but reservation cannot race an admitted mutation', async t => {
  const { root, store } = await project(t);
  let entered = 0;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const first = withWorkspaceMutation(root, 'provider', async () => { entered++; await held; });
  await waitFor(async () => entered === 1);
  const second = withWorkspaceMutation(root, 'provider', async () => { entered++; await held; });
  await waitFor(async () => entered === 2);
  await assert.rejects(createManagedFixtureTask(root, store, owner, options()), /Unresolved workspace admissions/);
  release(); await Promise.all([first, second]);
  assert.equal((await createManagedFixtureTask(root, store, owner, options())).state.status, 'idle');
});

test('unknown fixture outcomes retain ownership and require inspection, not automatic replay', async t => {
  const { root, store, id, open } = await bind(t);
  await command(store, id, owner, 'message.send', { text: 'Implement addition.' });
  await assert.rejects(dispatchFixtureTurn(root, store, owner, supervisor, id, async () => { throw new Error('lost fixture outcome'); }), /lost fixture outcome/);
  await store.close();
  const reopened = await open();
  const session = await reopened.get(id, owner);
  assert.equal(session.state.status, 'recovery-required');
  await assert.rejects(releaseManagedTask(root, reopened, owner, id), /unresolved/);
  assert.ok(session.state.status === 'recovery-required');
  await command(reopened, id, inspector, 'execution.reconcile', { executionId: session.state.executionId, inspectionDigest: 'b'.repeat(64), resourcesStopped: true, effectsKnown: true });
  assert.equal((await reopened.get(id, owner)).turnsUsed, 1);
  await command(reopened, id, owner, 'session.stop');
  await releaseManagedTask(root, reopened, owner, id);
});

test('lost creation acknowledgement recovers the stored request without dispatch', async t => {
  const { root, store } = await project(t);
  const accept = store.accept.bind(store);
  store.accept = async (command, actor) => { const receipt = await accept(command, actor); if (command.type === 'session.create') throw new SessionError('worker_unavailable'); return receipt; };
  await assert.rejects(createManagedFixtureTask(root, store, owner, options()));
  const claim = await readManagedClaim(root); assert.ok(claim);
  store.accept = accept;
  assert.equal((await recoverManagedCreation(root, store, owner, claim.create.sessionId)).state.status, 'idle');
  assert.deepEqual(await store.effects(claim.create.sessionId, owner), []);
});

for (const stage of ['verification.record', 'task.recorded'] as const) {
  test(`lost ${stage} acknowledgement reconciles without repeating checks or task completion`, async t => {
    const { root, store, id, open } = await bind(t);
    await candidate(root, store, id);
    const accept = store.accept.bind(store);
    store.accept = async (command, actor) => {
      if (command.type === stage) {
        if (stage === 'verification.record') await accept(command, actor);
        throw new SessionError('worker_unavailable');
      }
      return accept(command, actor);
    };
    if (stage === 'verification.record') await assert.rejects(verifyManagedCandidate(root, store, owner, supervisor, id));
    else { await verifyManagedCandidate(root, store, owner, supervisor, id); await assert.rejects(publishManagedTask(root, store, owner, inspector, id)); }
    const before = await workContext(root);
    await store.close();
    const reopened = await open();
    await publishManagedTask(root, reopened, owner, inspector, id);
    const after = await workContext(root);
    assert.equal(after.evidence.receipt, before.evidence.receipt);
    assert.equal(after.plan?.tasks.filter(task => task.status === 'done').length, 1);
    assert.equal((await reopened.events(id, owner)).events.filter(event => event.data.kind === 'task-recorded').length, 1);
    assert.equal((await reopened.get(id, owner)).turnsUsed, 1);
  });
}

test('Stop during real verification cancels and drains checks before confirmation', async t => {
  const { root, store, id } = await bind(t, true);
  await candidate(root, store, id);
  const checking = verifyManagedCandidate(root, store, owner, supervisor, id);
  await waitFor(async () => (await store.get(id, owner)).state.status === 'verifying');
  await command(store, id, owner, 'session.stop');
  assert.equal((await checking).state.status, 'stopped');
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  await releaseManagedTask(root, store, owner, id);
});

test('Pause during checks needs explicit bounded resume before a new turn', async t => {
  const { root, store, id } = await bind(t, true);
  await candidate(root, store, id);
  const checking = verifyManagedCandidate(root, store, owner, supervisor, id);
  await waitFor(async () => (await store.get(id, owner)).state.status === 'verifying');
  await command(store, id, owner, 'session.pause');
  const paused = await checking;
  assert.equal(paused.state.status, 'paused');
  assert.equal((await workContext(root)).run?.saved_status, 'paused');
  assert.ok(paused.state.status === 'paused');
  await command(store, id, owner, 'session.resume', { checkpointId: paused.state.checkpointId });
  const resumed = await dispatchFixtureTurn(root, store, owner, supervisor, id, async () => ({ resourcesStopped: true, effectsKnown: true }));
  assert.equal(resumed.state.status, 'awaiting-verification');
  assert.equal((await workContext(root)).run?.saved_status, 'building');
  assert.equal((await verifyManagedCandidate(root, store, owner, supervisor, id)).state.status, 'recording-task');
  await publishManagedTask(root, store, owner, inspector, id);
  assert.equal((await store.get(id, owner)).turnsUsed, 2);
});

test('Stop during a live fixture waits for its abort and refuses executor-only completion', async t => {
  const { root, store, id } = await bind(t);
  await command(store, id, owner, 'message.send', { text: 'Work on the approved task.' });
  const executing = dispatchFixtureTurn(root, store, owner, supervisor, id, async (_work, signal) => {
    await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
    return { resourcesStopped: true, effectsKnown: true };
  }, 3000);
  await waitFor(async () => (await store.get(id, owner)).state.status === 'running');
  await command(store, id, owner, 'session.stop');
  assert.equal((await executing).state.status, 'stopped');
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
  await releaseManagedTask(root, store, owner, id);
});

test('fixture deadline leaves an inspectable claim without executor replay', async t => {
  const { root, store, id } = await bind(t);
  await command(store, id, owner, 'message.send', { text: 'Work on the approved task.' });
  await assert.rejects(dispatchFixtureTurn(root, store, owner, supervisor, id, async () => {
    await new Promise<void>(() => {});
    return { resourcesStopped: true, effectsKnown: true };
  }, 25), /outcome is unknown/);
  assert.equal((await store.get(id, owner)).state.status, 'recovery-required');
  assert.ok(await readManagedClaim(root));
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'pending');
});

test('private project claims reject hard links and readable files', async t => {
  const { root, store, id } = await bind(t);
  const filename = path.join(root, '.foundry/state/managed-session.json');
  const alias = path.join(root, '.foundry/state/alias.json');
  await link(filename, alias);
  await assert.rejects(readManagedClaim(root), /Invalid managed project claim/);
  await rm(alias);
  await chmod(filename, 0o644);
  await assert.rejects(readManagedClaim(root), /Invalid managed project claim/);
  await chmod(filename, 0o600);
  await command(store, id, owner, 'session.stop');
  await releaseManagedTask(root, store, owner, id);
});

test('a crashed admission fails closed until exact trusted reconciliation', async t => {
  const { root, store } = await project(t);
  const helper = path.resolve('dist/runtime-tests/workspace-admission-fixture.cjs');
  const child = spawn(process.execPath, [helper, root], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGKILL'));
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  await new Promise<void>((resolve, reject) => { child.stdout.once('data', () => resolve()); child.once('error', reject); child.once('exit', () => reject(new Error('Admission helper exited before entering'))); });
  child.kill('SIGKILL'); await exited;
  const entries = await inspectWorkspaceAdmissions(root);
  assert.equal(entries.length, 1);
  const entry = entries[0]!;
  await assert.rejects(createManagedFixtureTask(root, store, owner, options()), /Unresolved workspace admissions/);
  await assert.rejects(reconcileWorkspaceAdmission(root, inspector, { id: entry.id, digest: 'a'.repeat(64), resourcesStopped: true, effectsKnown: true }));
  await assert.rejects(reconcileWorkspaceAdmission(root, owner, { ...entry, resourcesStopped: true, effectsKnown: true }));
  await reconcileWorkspaceAdmission(root, inspector, { id: entry.id, digest: entry.digest, resourcesStopped: true, effectsKnown: true });
  assert.deepEqual(await inspectWorkspaceAdmissions(root), []);
  const session = await createManagedFixtureTask(root, store, owner, options());
  await command(store, session.id, owner, 'session.stop');
  await releaseManagedTask(root, store, owner, session.id);
});
