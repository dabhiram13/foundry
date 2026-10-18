import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout } from 'node:timers/promises';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { SessionError, sessionCommandSchema, sessionSchema, type SessionActor, type SessionCommand } from '../../src/core/session-contract.js';
import { sessionReplySchema } from '../../src/runtime/session-rpc.js';
import { SessionStore } from '../../src/runtime/session-store.js';

const runtime = path.resolve('dist/runtime');
const hash = 'a'.repeat(64);
const owner: SessionActor = { kind: 'owner', id: randomUUID() };

async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-session-'));
  const stores: SessionStore[] = [];
  async function open() {
    const store = await SessionStore.open(directory, runtime);
    stores.push(store);
    return store;
  }
  t.after(async () => { await Promise.all(stores.map((store) => store.close())); await rm(directory, { recursive: true, force: true }); });
  const create = sessionCommandSchema.parse({
    type: 'session.create', sessionId: randomUUID(), requestId: randomUUID(),
    assignment: { projectBindingId: randomUUID(), runId: randomUUID(), taskId: 'task-1', scopeRevision: hash, approvalDigest: hash, roleDigest: hash, checksDigest: hash },
    executor: { kind: 'opencode', profileId: randomUUID() }, consentRef: randomUUID(), maxTurns: 3,
  });
  assert.ok(create.type === 'session.create');
  const store = await open();
  await store.accept(create, owner);
  return { store, create, directory, open };
}

function command(create: SessionCommand, type: string, expectedRevision: number, fields = {}): SessionCommand {
  return sessionCommandSchema.parse({ type, sessionId: create.sessionId, requestId: randomUUID(), expectedRevision, ...fields });
}

test('managed creation persists an idle session and queue intent without launching an executor', async (t) => {
  const { store, create, open } = await fixture(t);
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'idle');
  assert.deepEqual(await store.effects(create.sessionId, owner), []);
  const send = command(create, 'message.send', 0, { text: 'Implement the approved assignment.' });
  const receipt = await store.accept(send, owner);
  assert.equal(receipt.acceptedRevision, 1);
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'queued');
  const effects = await store.effects(create.sessionId, owner);
  assert.equal(effects.length, 1);
  assert.equal(effects[0]?.status, 'pending');
  await store.close();
  const reopened = await open();
  assert.deepEqual(await reopened.accept(send, owner), receipt);
  assert.deepEqual(await reopened.effects(create.sessionId, owner), effects);
  assert.deepEqual((await reopened.events(create.sessionId, owner)).events.map((event) => event.sequence), [1, 2]);
});

async function running(t: TestContext, leaseSeconds = 60) {
  const context = await fixture(t);
  const { store, create } = context;
  const supervisor: SessionActor = { kind: 'supervisor', id: randomUUID() };
  await store.accept(command(create, 'message.send', 0, { text: 'Implement the approved assignment.' }), owner);
  await store.accept(command(create, 'execution.claim', 1, { instanceId: supervisor.id, leaseSeconds }), supervisor);
  const state = (await store.get(create.sessionId, owner)).state;
  assert.ok(state.status === 'running');
  return {
    ...context, supervisor,
    execution: { executionId: state.executionId, leaseToken: state.lease.token, fence: state.lease.fence },
  };
}

function errorCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof SessionError && error.code === code;
}

test('managed commands reject unknown fields, actor smuggling, invalid IDs and byte bounds without writes', async (t) => {
  const { store, create } = await fixture(t);
  const send = command(create, 'message.send', 0, { text: 'Work.' });
  const before = await store.get(create.sessionId, owner);
  for (const invalid of [
    { ...send, extra: true }, { ...send, actor: { kind: 'supervisor', id: owner.id } },
    { ...send, requestId: '../escape' }, { ...send, expectedRevision: -1 },
    { ...send, text: 'x'.repeat(65_537) }, { ...send, text: '😀'.repeat(16_385) },
  ]) await assert.rejects(store.accept(invalid as SessionCommand, owner), errorCode('invalid_input'));
  await assert.rejects(store.accept(send, { ...owner, extra: true } as SessionActor), errorCode('invalid_input'));
  assert.deepEqual(await store.get(create.sessionId, owner), before);
  assert.equal((await store.events(create.sessionId, owner)).events.length, 1);
  assert.deepEqual(await store.effects(create.sessionId, owner), []);
  assert.equal(sessionSchema.safeParse({ ...before, state: { status: 'running' } }).success, false);
});

test('storage worker independently rejects malformed RPC payloads and survives a valid request', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-rpc-'));
  const worker = new Worker(path.join(runtime, 'foundry-session-storage.cjs'), { workerData: { directory: base } });
  t.after(async () => { await worker.terminate(); await rm(base, { recursive: true, force: true }); });
  assert.deepEqual((await once(worker, 'message'))[0], { ready: true, schemaVersion: 1 });
  async function request(input: unknown) {
    const reply = once(worker, 'message');
    worker.postMessage(input);
    return sessionReplySchema.parse((await reply)[0]);
  }
  for (const invalid of [
    { type: 'get', sessionId: '../elsewhere', actor: owner },
    { type: 'get', sessionId: randomUUID(), actor: { ...owner, admin: true } },
    { type: 'events', sessionId: randomUUID(), actor: owner, after: 0, limit: 201 },
    { type: 'accept', command: { type: 'session.stop' }, actor: owner },
  ]) {
    const id = randomUUID();
    assert.deepEqual(await request({ id, ...invalid }), { id, ok: false, code: 'invalid_input' });
  }
  const id = randomUUID();
  assert.deepEqual(await request({ id, type: 'get', sessionId: randomUUID(), actor: owner }), { id, ok: false, code: 'not_found' });
});

test('idempotency precedes freshness, rejects changed content and is not shared between sessions', async (t) => {
  const { store, create } = await fixture(t);
  const send = command(create, 'message.send', 0, { text: 'Original.' });
  const receipts = await Promise.all(Array.from({ length: 8 }, () => store.accept(send, owner)));
  for (const receipt of receipts) assert.deepEqual(receipt, receipts[0]);
  await assert.rejects(store.accept({ ...send, text: 'Different.' } as SessionCommand, owner), errorCode('idempotency_conflict'));
  await assert.rejects(store.accept(command(create, 'session.stop', 0), owner), errorCode('revision_conflict'));
  const other = { ...create, sessionId: randomUUID(), requestId: randomUUID(), assignment: { ...create.assignment, projectBindingId: randomUUID() } };
  const second = sessionCommandSchema.parse(other);
  await store.accept(second, owner);
  await assert.rejects(store.accept(sessionCommandSchema.parse({ ...send, sessionId: second.sessionId }), owner), errorCode('idempotency_conflict'));
  assert.equal((await store.get(second.sessionId, owner)).state.status, 'idle');
  assert.equal((await store.events(create.sessionId, owner)).events.length, 2);
});

test('owner and supervisor commands cannot cross their authority boundary', async (t) => {
  const { store, create } = await fixture(t);
  const otherOwner: SessionActor = { kind: 'owner', id: randomUUID() };
  for (const read of [() => store.get(create.sessionId, otherOwner), () => store.events(create.sessionId, otherOwner), () => store.effects(create.sessionId, otherOwner)]) {
    await assert.rejects(read(), errorCode('forbidden'));
  }
  await assert.rejects(store.accept(command(create, 'message.send', 0, { text: 'Not mine.' }), otherOwner), errorCode('forbidden'));
  const supervisor: SessionActor = { kind: 'supervisor', id: randomUUID() };
  await assert.rejects(store.accept(command(create, 'session.stop', 0), supervisor), errorCode('forbidden'));
  await store.accept(command(create, 'message.send', 0, { text: 'Owner request.' }), owner);
  await assert.rejects(store.accept(command(create, 'execution.claim', 1, { instanceId: owner.id, leaseSeconds: 60 }), owner), errorCode('forbidden'));
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'queued');
});

test('active project binding is unique and only a confirmed terminal stop releases it', async (t) => {
  const { store, create } = await fixture(t);
  const second = sessionCommandSchema.parse({ ...create, sessionId: randomUUID(), requestId: randomUUID() });
  await assert.rejects(store.accept(second, owner), errorCode('project_busy'));
  await store.accept(command(create, 'session.stop', 0), owner);
  await store.accept(second, owner);
  assert.equal((await store.get(second.sessionId, owner)).state.status, 'idle');
});

test('two storage workers serialize competing revisions and return the same durable duplicate receipt', async (t) => {
  const { store, create, open } = await fixture(t);
  const second = await open();
  const send = command(create, 'message.send', 0, { text: 'One turn.' });
  const duplicate = await Promise.all([store.accept(send, owner), second.accept(send, owner)]);
  assert.deepEqual(duplicate[0], duplicate[1]);
  const results = await Promise.allSettled([
    store.accept(command(create, 'session.pause', 1), owner),
    second.accept(command(create, 'session.stop', 1), owner),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected' && errorCode('revision_conflict')(rejected.reason));
  assert.equal((await store.get(create.sessionId, owner)).revision, 2);
  assert.equal((await second.events(create.sessionId, owner)).events.length, 3);
});

test('a failing receipt insert rolls back state, events and effect intents together', async (t) => {
  const { store, create, directory } = await fixture(t);
  const db = new DatabaseSync(path.join(directory, 'sessions.sqlite'));
  t.after(() => db.close());
  db.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON commands BEGIN SELECT RAISE(ABORT, 'fixture'); END");
  const send = command(create, 'message.send', 0, { text: 'Atomic work.' });
  await assert.rejects(store.accept(send, owner), errorCode('storage_invalid'));
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'idle');
  assert.equal((await store.events(create.sessionId, owner)).events.length, 1);
  assert.deepEqual(await store.effects(create.sessionId, owner), []);
  db.exec('DROP TRIGGER fail_receipt');
  assert.equal((await store.accept(send, owner)).acceptedRevision, 1);
});

test('storage contention returns a typed retryable error and retry does not duplicate the command', async (t) => {
  const { store, create, directory } = await fixture(t);
  const db = new DatabaseSync(path.join(directory, 'sessions.sqlite'));
  t.after(() => db.close());
  const send = command(create, 'message.send', 0, { text: 'Retry after contention.' });
  db.exec('BEGIN IMMEDIATE');
  try { await assert.rejects(store.accept(send, owner), errorCode('storage_busy')); }
  finally { db.exec('ROLLBACK'); }
  const receipt = await store.accept(send, owner);
  assert.deepEqual(await store.accept(send, owner), receipt);
  assert.equal((await store.effects(create.sessionId, owner)).length, 1);
});

test('event cursors are bounded, ordered and complete; damaged history fails closed', async (t) => {
  const { store, create, directory } = await fixture(t);
  await store.accept(command(create, 'message.send', 0, { text: 'One turn.' }), owner);
  const first = await store.events(create.sessionId, owner, 0, 1);
  assert.equal(first.nextCursor, 1);
  assert.equal(first.hasMore, true);
  const last = await store.events(create.sessionId, owner, first.nextCursor, 1);
  assert.equal(last.nextCursor, 2);
  assert.equal(last.hasMore, false);
  assert.deepEqual((await store.events(create.sessionId, owner, 2)).events, []);
  await assert.rejects(store.events(create.sessionId, owner, 3), errorCode('cursor_invalid'));
  for (const [cursor, limit] of [[-1, 1], [0, 0], [0, 201], [0.5, 2]]) {
    await assert.rejects(store.events(create.sessionId, owner, cursor, limit), errorCode('invalid_input'));
  }
  const db = new DatabaseSync(path.join(directory, 'sessions.sqlite'));
  db.prepare('DELETE FROM events WHERE session_id=? AND sequence=1').run(create.sessionId);
  db.close();
  await assert.rejects(store.events(create.sessionId, owner), errorCode('storage_invalid'));
});

test('heartbeats and bounded output advance the event cursor without invalidating owner controls', async (t) => {
  const { store, create, supervisor, execution } = await running(t);
  await store.accept(command(create, 'execution.output', 0, { ...execution, text: 'Working.' }), supervisor);
  await store.accept(command(create, 'execution.heartbeat', 0, { ...execution, leaseSeconds: 60 }), supervisor);
  const observed = await store.get(create.sessionId, owner);
  assert.equal(observed.revision, 2);
  assert.equal(observed.sequence, 5);
  await store.accept(command(create, 'session.pause', 2), owner);
  await store.accept(command(create, 'execution.heartbeat', 0, { ...execution, leaseSeconds: 60 }), supervisor);
  assert.equal((await store.get(create.sessionId, owner)).revision, 3);
  await store.accept(command(create, 'session.stop', 3), owner);
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'stopping');
});

test('output chunk and total budgets use UTF-8 bytes rather than character counts', async (t) => {
  const { store, create, supervisor, execution } = await running(t);
  await assert.rejects(store.accept(command(create, 'execution.output', 2, { ...execution, text: 'Valid.' }), { kind: 'supervisor', id: randomUUID() }), errorCode('lease_conflict'));
  const output = command(create, 'execution.output', 2, { ...execution, text: '😀'.repeat(4096) });
  await assert.rejects(store.accept({ ...output, text: '😀'.repeat(4097) } as SessionCommand, supervisor), errorCode('invalid_input'));
  for (let index = 0; index < 128; index++) await store.accept({ ...output, requestId: randomUUID() } as SessionCommand, supervisor);
  await assert.rejects(store.accept({ ...output, requestId: randomUUID() } as SessionCommand, supervisor), errorCode('budget_exhausted'));
  assert.equal((await store.get(create.sessionId, owner)).outputBytes, 2_097_152);
});

test('pause needs supervisor confirmation; resume uses the exact checkpoint and a new bounded execution', async (t) => {
  const { store, create, supervisor, execution } = await running(t);
  await store.accept(command(create, 'session.pause', 2), owner);
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'pausing');
  const checkpointId = randomUUID();
  await assert.rejects(store.accept(command(create, 'session.resume', 3, { checkpointId }), owner), errorCode('invalid_state'));
  await store.accept(command(create, 'execution.confirm', 3, { ...execution, resourcesStopped: true, effectsKnown: true, result: { kind: 'paused', checkpointId } }), supervisor);
  await assert.rejects(store.accept(command(create, 'session.resume', 4, { checkpointId: randomUUID() }), owner), errorCode('invalid_state'));
  await store.accept(command(create, 'session.resume', 4, { checkpointId }), owner);
  const next = await store.get(create.sessionId, owner);
  assert.ok(next.state.status === 'queued');
  assert.notEqual(next.state.executionId, execution.executionId);
  assert.equal(next.turnsUsed, 2);
  const start = (await store.effects(create.sessionId, owner)).at(-1);
  assert.equal(start?.text, null);
  await store.accept(command(create, 'execution.claim', 5, { instanceId: supervisor.id, leaseSeconds: 60 }), supervisor);
  const claimed = await store.get(create.sessionId, owner);
  assert.ok(claimed.state.status === 'running');
  assert.equal(claimed.state.lease.fence, execution.fence + 1);
  await assert.rejects(store.accept(command(create, 'execution.output', 6, { ...execution, text: 'Late.' }), supervisor), errorCode('lease_conflict'));
});

test('stop supersedes pause and a late completion cannot overwrite the accepted stop', async (t) => {
  const { store, create, supervisor, execution } = await running(t);
  await store.accept(command(create, 'session.pause', 2), owner);
  await store.accept(command(create, 'session.stop', 3), owner);
  for (const result of [{ kind: 'paused', checkpointId: randomUUID() }, { kind: 'candidate', candidateDigest: hash }]) {
    await assert.rejects(store.accept(command(create, 'execution.confirm', 4, { ...execution, resourcesStopped: true, effectsKnown: true, result }), supervisor), errorCode('invalid_state'));
  }
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'stopping');
  await store.accept(command(create, 'execution.confirm', 4, { ...execution, resourcesStopped: true, effectsKnown: true, result: { kind: 'stopped' } }), supervisor);
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'stopped');
  assert.ok((await store.effects(create.sessionId, owner)).every((effect) => effect.status === 'confirmed'));
});

test('an executor candidate waits for independent core verification and cannot complete a task', async (t) => {
  const { store, create, supervisor, execution } = await running(t);
  await store.accept(command(create, 'execution.confirm', 2, { ...execution, resourcesStopped: true, effectsKnown: true, result: { kind: 'candidate', candidateDigest: hash } }), supervisor);
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'awaiting-verification');
  await assert.rejects(store.accept({ ...command(create, 'session.stop', 3), type: 'task.finish' } as unknown as SessionCommand, supervisor), errorCode('invalid_input'));
  await assert.rejects(store.accept(command(create, 'session.retry', 3, { failedExecutionId: execution.executionId }), owner), errorCode('invalid_state'));
});

test('unknown effects retain the project claim and only trusted inspection allows a fresh retry', async (t) => {
  const { store, create, supervisor, execution } = await running(t);
  await store.accept(command(create, 'execution.unknown', 2, execution), supervisor);
  const session = await store.get(create.sessionId, owner);
  assert.equal(session.state.status, 'recovery-required');
  assert.equal((await store.effects(create.sessionId, owner))[0]?.status, 'uncertain');
  await assert.rejects(store.accept(command(create, 'session.stop', 3), owner), errorCode('recovery_required'));
  await assert.rejects(store.accept(command(create, 'session.retry', 3, { failedExecutionId: execution.executionId }), owner), errorCode('invalid_state'));
  await assert.rejects(store.accept(sessionCommandSchema.parse({ ...create, sessionId: randomUUID(), requestId: randomUUID() }), owner), errorCode('project_busy'));
  const reconcile = command(create, 'execution.reconcile', 3, { executionId: execution.executionId, inspectionDigest: hash, resourcesStopped: true, effectsKnown: true });
  await assert.rejects(store.accept(reconcile, owner), errorCode('forbidden'));
  const inspector: SessionActor = { kind: 'inspector', id: randomUUID() };
  await assert.rejects(store.accept({ ...reconcile, effectsKnown: false } as unknown as SessionCommand, inspector), errorCode('invalid_input'));
  await store.accept(reconcile, inspector);
  assert.equal((await store.get(create.sessionId, owner)).state.status, 'failed');
  await store.accept(command(create, 'session.retry', 4, { failedExecutionId: execution.executionId }), owner);
  const queued = await store.get(create.sessionId, owner);
  assert.ok(queued.state.status === 'queued' && queued.state.executionId !== execution.executionId);
});

test('lease expiration is fenced after restart and records recovery rather than replaying a claimed effect', async (t) => {
  const { store, create, supervisor, execution, open } = await running(t, 1);
  await store.close();
  await setTimeout(1100);
  const reopened = await open();
  assert.equal((await reopened.get(create.sessionId, owner)).state.status, 'running');
  const effects = await reopened.effects(create.sessionId, owner);
  assert.equal(effects.length, 1);
  assert.equal(effects[0]?.status, 'claimed');
  await assert.rejects(reopened.accept(command(create, 'execution.heartbeat', 2, { ...execution, leaseSeconds: 60 }), supervisor), errorCode('recovery_required'));
  const inspector: SessionActor = { kind: 'inspector', id: randomUUID() };
  await reopened.accept(command(create, 'execution.expire', 2, { executionId: execution.executionId }), inspector);
  assert.equal((await reopened.get(create.sessionId, owner)).state.status, 'recovery-required');
  assert.equal((await reopened.effects(create.sessionId, owner))[0]?.status, 'uncertain');
});

test('canceling a queued turn cancels the undispatched start and resume does not reset the turn budget', async (t) => {
  const { store, create } = await fixture(t);
  for (let turn = 0; turn < 3; turn++) {
    const before = await store.get(create.sessionId, owner);
    if (before.state.status === 'idle') await store.accept(command(create, 'message.send', before.revision, { text: 'Work.' }), owner);
    else {
      assert.ok(before.state.status === 'paused');
      await store.accept(command(create, 'session.resume', before.revision, { checkpointId: before.state.checkpointId }), owner);
    }
    const queued = await store.get(create.sessionId, owner);
    await store.accept(command(create, 'session.pause', queued.revision), owner);
  }
  const final = await store.get(create.sessionId, owner);
  assert.ok(final.state.status === 'paused');
  await assert.rejects(store.accept(command(create, 'session.resume', final.revision, { checkpointId: final.state.checkpointId }), owner), errorCode('budget_exhausted'));
  assert.ok((await store.effects(create.sessionId, owner)).every((effect) => effect.status === 'canceled'));
});

test('private storage preserves owner files and rejects unsafe paths and permissions', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-private-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  await assert.rejects(SessionStore.open('relative', runtime), errorCode('storage_invalid'));
  await assert.rejects(SessionStore.open('x'.repeat(4097), runtime), errorCode('invalid_input'));
  const target = path.join(base, 'target');
  await mkdir(target, { mode: 0o700 });
  const alias = path.join(base, 'alias');
  await symlink(target, alias);
  await assert.rejects(SessionStore.open(alias, runtime), errorCode('storage_invalid'));
  const repo = path.join(base, 'repository');
  await mkdir(path.join(repo, '.git'), { recursive: true });
  await assert.rejects(SessionStore.open(path.join(repo, 'store'), runtime), errorCode('storage_invalid'));
  const publicDirectory = path.join(base, 'public');
  await mkdir(publicDirectory);
  await chmod(publicDirectory, 0o755);
  await assert.rejects(SessionStore.open(publicDirectory, runtime), errorCode('storage_invalid'));
  const file = path.join(target, 'sessions.sqlite');
  await writeFile(file, 'Owner data', { mode: 0o600 });
  const other = path.join(base, 'other');
  await mkdir(other, { mode: 0o700 });
  await symlink(file, path.join(other, 'sessions.sqlite'));
  await assert.rejects(SessionStore.open(other, runtime), errorCode('storage_invalid'));
  await rm(path.join(other, 'sessions.sqlite'));
  await link(file, path.join(other, 'sessions.sqlite'));
  await assert.rejects(SessionStore.open(other, runtime), errorCode('storage_invalid'));
  assert.equal(await readFile(file, 'utf8'), 'Owner data');
  await rm(path.join(other, 'sessions.sqlite'));
  await chmod(file, 0o644);
  await assert.rejects(SessionStore.open(target, runtime), errorCode('storage_invalid'));
  assert.equal(await readFile(file, 'utf8'), 'Owner data');
});

test('private database permissions and checked migration survive reopening without data loss', async (t) => {
  const { store, create, directory, open } = await fixture(t);
  await store.close();
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  const file = path.join(directory, 'sessions.sqlite');
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const db = new DatabaseSync(file);
  const checksum = db.prepare('SELECT checksum FROM migrations WHERE version=1').get()?.checksum;
  db.prepare('UPDATE migrations SET checksum=? WHERE version=1').run('changed');
  db.close();
  await assert.rejects(open(), errorCode('storage_invalid'));
  const repair = new DatabaseSync(file);
  repair.prepare('UPDATE migrations SET checksum=? WHERE version=1').run(String(checksum));
  repair.exec('PRAGMA user_version=99');
  repair.close();
  await assert.rejects(open(), errorCode('storage_invalid'));
  const reset = new DatabaseSync(file);
  assert.equal(reset.prepare('PRAGMA user_version').get()?.user_version, 99);
  reset.exec('PRAGMA user_version=1');
  reset.close();
  const reopened = await open();
  assert.equal((await reopened.get(create.sessionId, owner)).state.status, 'idle');
});

test('session state tampering is rejected rather than accepted as a valid snapshot', async (t) => {
  const { store, create, directory } = await fixture(t);
  const db = new DatabaseSync(path.join(directory, 'sessions.sqlite'));
  db.prepare("UPDATE sessions SET snapshot=json_set(snapshot, '$.state.status', 'stopped') WHERE id=?").run(create.sessionId);
  db.close();
  await assert.rejects(store.get(create.sessionId, owner), errorCode('storage_invalid'));
});

test('worker exit rejects all pending requests; closed stores reject new work', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-worker-exit-'));
  const runtimeDirectory = path.join(base, 'runtime');
  await mkdir(runtimeDirectory);
  await writeFile(path.join(runtimeDirectory, 'foundry-session-storage.cjs'), `
    const { parentPort } = require('node:worker_threads');
    parentPort.postMessage({ ready: true, schemaVersion: 1 });
    parentPort.on('message', () => process.exit(17));
  `);
  const store = await SessionStore.open(path.join(base, 'data'), runtimeDirectory);
  t.after(async () => { await store.close(); await rm(base, { recursive: true, force: true }); });
  const id = sessionSchema.shape.id.parse(randomUUID());
  const results = await Promise.allSettled([store.get(id, owner), store.effects(id, owner)]);
  for (const result of results) assert.ok(result.status === 'rejected' && errorCode('worker_unavailable')(result.reason));
  await store.close();
  await assert.rejects(store.get(id, owner), errorCode('worker_unavailable'));
});

test('closing drains already submitted commands and rejects later ones', async (t) => {
  const { store, create, open } = await fixture(t);
  const send = command(create, 'message.send', 0, { text: 'Finish this transaction before close.' });
  const saved = store.accept(send, owner);
  const closed = store.close();
  await assert.rejects(store.get(create.sessionId, owner), errorCode('worker_unavailable'));
  const receipt = await saved;
  await closed;
  const reopened = await open();
  assert.deepEqual(await reopened.accept(send, owner), receipt);
});

test('shutdown is bounded even when a worker acknowledges close without exiting', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-worker-hang-'));
  await writeFile(path.join(base, 'foundry-session-storage.cjs'), `
    const { parentPort } = require('node:worker_threads');
    parentPort.postMessage({ ready: true, schemaVersion: 1 });
    parentPort.on('message', ({ id }) => parentPort.postMessage({ id, ok: true, data: null }));
    setInterval(() => {}, 1000);
  `);
  const store = await SessionStore.open(path.join(base, 'data'), base);
  t.after(async () => { await store.close(); await rm(base, { recursive: true, force: true }); });
  await assert.rejects(store.close(), errorCode('worker_unavailable'));
});

test('losing a worker before acknowledgement permits an exact retry, not duplicate intents', async (t) => {
  const { store, create, directory, open } = await fixture(t);
  await store.close();
  const worker = new Worker(path.join(runtime, 'foundry-session-storage.cjs'), { workerData: { directory } });
  t.after(() => worker.terminate());
  assert.deepEqual((await once(worker, 'message'))[0], { ready: true, schemaVersion: 1 });
  const send = command(create, 'message.send', 0, { text: 'Retry the same command after a lost acknowledgement.' });
  worker.postMessage({ id: randomUUID(), type: 'accept', command: send, actor: owner });
  await worker.terminate();
  const reopened = await open();
  const receipt = await reopened.accept(send, owner);
  assert.deepEqual(await reopened.accept(send, owner), receipt);
  assert.equal((await reopened.effects(create.sessionId, owner)).length, 1);
  assert.equal((await reopened.events(create.sessionId, owner)).events.length, 2);
});

test('concurrent first opens serialize the migration or return bounded contention', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-migration-race-'));
  const stores: SessionStore[] = [];
  t.after(async () => { await Promise.all(stores.map((store) => store.close())); await rm(directory, { recursive: true, force: true }); });
  const opened = await Promise.allSettled([SessionStore.open(directory, runtime), SessionStore.open(directory, runtime)]);
  for (const result of opened) {
    if (result.status === 'fulfilled') stores.push(result.value);
    else assert.ok(errorCode('storage_busy')(result.reason));
  }
  assert.ok(stores.length >= 1);
  stores.push(await SessionStore.open(directory, runtime));
});

test('unknown existing SQLite data is left intact instead of being adopted as a new store', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-foreign-db-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'sessions.sqlite');
  await writeFile(file, '', { mode: 0o600 });
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE owner_data(value TEXT); INSERT INTO owner_data VALUES ('preserve');");
  db.close();
  await assert.rejects(SessionStore.open(directory, runtime), errorCode('storage_invalid'));
  const intact = new DatabaseSync(file);
  assert.equal(intact.prepare('SELECT value FROM owner_data').get()?.value, 'preserve');
  assert.equal(intact.prepare('PRAGMA user_version').get()?.user_version, 0);
  intact.close();
});

test('a malformed worker result invalidates the connection instead of returning unchecked data', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-invalid-reply-'));
  await writeFile(path.join(directory, 'foundry-session-storage.cjs'), `
    const { parentPort } = require('node:worker_threads');
    parentPort.postMessage({ ready: true, schemaVersion: 1 });
    parentPort.on('message', ({ id }) => parentPort.postMessage({ id, ok: true, data: { state: 'invented' } }));
  `);
  const store = await SessionStore.open(path.join(directory, 'data'), directory);
  t.after(async () => { await store.close(); await rm(directory, { recursive: true, force: true }); });
  const id = sessionSchema.shape.id.parse(randomUUID());
  await assert.rejects(store.get(id, owner), errorCode('storage_invalid'));
  await assert.rejects(store.get(id, owner), errorCode('worker_unavailable'));
});
