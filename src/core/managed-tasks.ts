import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, digest, FoundryError } from './fs.js';
import { readBoundedText, readFactoryState } from './factory-contract.js';
import { finishTask, pauseOrResume, prepareAssignment, requireRuntimeWorkspace, reviewScope, verify, workContext, workspaceRevision } from './lifecycle.js';
import { roleByName } from './roles.js';
import { assignmentBindingSchema, sessionCommandSchema, verificationEvidenceSchema, type ManagedSession, type SessionActor, type SessionCommand } from './session-contract.js';
import { reserveManagedProject, releaseManagedProject, withManagedProject, withWorkspaceAdmission, type ManagedClaim } from './workspace-ownership.js';
import { providerStatus } from '../runtime/providers.js';
import type { SessionStore } from '../runtime/session-store.js';
import { managedProfileSchema } from './managed-profile.js';
import { inspectManagedLaunch, runManagedOpenCode, validateManagedExecutor } from '../runtime/managed-opencode.js';

type Owner = Extract<SessionActor, { kind: 'owner' }>;
type Supervisor = Extract<SessionActor, { kind: 'supervisor' }>;
type Inspector = Extract<SessionActor, { kind: 'inspector' }>;
type Binding = z.infer<typeof assignmentBindingSchema>;
type Evidence = z.infer<typeof verificationEvidenceSchema>;
type LeaseState = Extract<ManagedSession['state'], { lease: unknown }>;
const fixtureOptionsSchema = z.strictObject({ profileId: z.uuid(), consentRef: z.uuid(), maxTurns: z.number().int().min(1).max(3) });
const fixtureOutcomeSchema = z.strictObject({ resourcesStopped: z.literal(true), effectsKnown: z.literal(true) });

async function bindingFor(root: string, projectBindingId: string, taskId: string): Promise<Binding> {
  const context = await workContext(root);
  const scope = await reviewScope(root);
  const task = context.plan?.tasks.find(item => item.id === taskId);
  if (!context.run || context.run.historical || !task || scope.approval.status !== 'current' || scope.blockers.length) {
    throw new FoundryError('Managed work needs a current approved scoped task');
  }
  if (scope.checks.some(check => check.environment.length)) throw new FoundryError('Managed fixtures do not grant supervisor environment variables to checks');
  return assignmentBindingSchema.parse({
    projectBindingId, runId: context.run.id, taskId, scopeRevision: scope.revision,
    approvalDigest: scope.approval.sha256,
    roleDigest: digest(canonicalJson({ role: await roleByName(root, task.role), permissions: 'workspace-write' })),
    checksDigest: digest(canonicalJson(scope.checks)),
  });
}

async function assertBinding(root: string, claim: ManagedClaim): Promise<void> {
  const expected = claim.create.assignment;
  if (canonicalJson(await bindingFor(root, expected.projectBindingId, expected.taskId)) !== canonicalJson(expected)) {
    throw new FoundryError('Managed assignment changed; inspect the session instead of rebinding it');
  }
}

function assertSession(claim: ManagedClaim, session: ManagedSession): void {
  if (session.ownerId !== claim.ownerId || session.id !== claim.create.sessionId
    || canonicalJson(session.assignment) !== canonicalJson(claim.create.assignment)
    || canonicalJson(session.executor) !== canonicalJson(claim.create.executor)) throw new FoundryError('Managed session does not match project ownership');
}

async function send(store: SessionStore, session: ManagedSession, actor: SessionActor, fields: Record<string, unknown>): Promise<ManagedSession> {
  await store.accept(sessionCommandSchema.parse({ sessionId: session.id, requestId: randomUUID(), expectedRevision: session.revision, ...fields }), actor);
  return store.get(session.id, actor);
}

function leasedFields(state: LeaseState) {
  return { executionId: state.executionId, leaseToken: state.lease.token, fence: state.lease.fence };
}

function managedPrompt(assignment: Awaited<ReturnType<typeof prepareAssignment>>): string {
  const prompt = `Implement only this current Foundry Builder assignment. Preserve owner edits. Do not alter .foundry state, approvals or checks. Do not complete the task yourself.\n${JSON.stringify(assignment)}`;
  if (Buffer.byteLength(prompt) > 60_000) throw new FoundryError('Managed assignment exceeds the prompt limit');
  return prompt;
}

export async function createManagedFixtureTask(rootInput: string, store: SessionStore, owner: Owner, options: unknown): Promise<ManagedSession> {
  const settings = fixtureOptionsSchema.parse(options);
  return createManagedTask(rootInput, store, owner, settings, { kind: 'fixture', profileId: settings.profileId });
}

export async function createManagedOpenCodeTask(rootInput: string, parent: string, store: SessionStore, owner: Owner, input: unknown): Promise<ManagedSession> {
  const root = await requireRuntimeWorkspace(rootInput, 'bind managed OpenCode work in');
  const profile = await validateManagedExecutor(root, parent, input);
  return createManagedTask(root, store, owner, profile, { kind: 'opencode', profileId: profile.id, profileDigest: digest(canonicalJson(profile)) });
}

async function createManagedTask(rootInput: string, store: SessionStore, owner: Owner,
  settings: { consentRef: string; maxTurns: number }, executor: ManagedSession['executor']): Promise<ManagedSession> {
  const root = await requireRuntimeWorkspace(rootInput, 'bind managed work in');
  return withWorkspaceAdmission(root, async () => {
    if (await readFactoryState(root)) throw new FoundryError('Managed fixture work requires a scoped project without a Factory controller');
    const tasks = await providerStatus(root);
    if (!Array.isArray(tasks) || tasks.some(task => ['running', 'unknown'].includes(String(task.status)))) throw new FoundryError('Reconcile provider tasks before binding managed work');
    const source = await prepareAssignment(root, 'builder');
    if (!source.task || source.execution !== 'host_client') throw new FoundryError('No approved Builder assignment');
    if (executor.kind === 'opencode') managedPrompt(source);
    const assignment = await bindingFor(root, randomUUID(), source.task.id);
    const create = sessionCommandSchema.parse({
      type: 'session.create', sessionId: randomUUID(), requestId: randomUUID(), assignment,
      executor, consentRef: settings.consentRef, maxTurns: settings.maxTurns,
    });
    if (create.type !== 'session.create') throw new FoundryError('Invalid managed creation');
    await reserveManagedProject(root, owner.id, create);
    await store.accept(create, owner);
    return store.get(create.sessionId, owner);
  });
}

export async function dispatchManagedOpenCodeTurn(rootInput: string, parent: string, store: SessionStore, owner: Owner,
  supervisor: Supervisor, sessionId: ManagedSession['id'], input: unknown, signal?: AbortSignal): Promise<ManagedSession> {
  const root = await requireRuntimeWorkspace(rootInput, 'run managed OpenCode work in');
  const profile = managedProfileSchema.parse(input);
  const prepared = await withManagedProject(root, sessionId, owner.id, async claim => {
    await assertBinding(root, claim);
    let session = await store.get(sessionId, owner);
    assertSession(claim, session);
    if (session.executor.kind !== 'opencode' || session.executor.profileDigest !== digest(canonicalJson(profile))
      || session.consentRef !== profile.consentRef || session.state.status !== 'queued') throw new FoundryError('Managed executor profile or queued assignment changed');
    await validateManagedExecutor(root, parent, profile);
    const context = await workContext(root);
    if (context.run?.saved_status === 'paused') await pauseOrResume(root, false, context.snapshot_revision);
    const prompt = managedPrompt(await prepareAssignment(root, 'builder'));
    session = await send(store, session, supervisor, { type: 'execution.claim', instanceId: supervisor.id, leaseSeconds: 60 });
    if (session.state.status !== 'running') throw new FoundryError('Managed execution was not claimed');
    return { session, lease: leasedFields(session.state), prompt };
  });
  const controller = new AbortController();
  let busy = false;
  let pending = Promise.resolve();
  let heartbeat = Date.now();
  const watch = setInterval(() => {
    if (busy) return;
    busy = true;
    pending = (async () => {
      const session = await store.get(sessionId, owner);
      if (session.state.status !== 'running') { controller.abort(); return; }
      if (Date.now() - heartbeat > 10_000) {
        await send(store, session, supervisor, { type: 'execution.heartbeat', ...prepared.lease, leaseSeconds: 60 });
        heartbeat = Date.now();
      }
    })().catch(() => controller.abort()).finally(() => { busy = false; });
  }, 50);
  const interrupt = () => {
    pending = pending.then(async () => {
      const session = await store.get(sessionId, owner);
      if (session.state.status === 'running') await send(store, session, owner, { type: 'session.pause' });
    }).catch(() => {}).finally(() => controller.abort());
  };
  signal?.addEventListener('abort', interrupt, { once: true });
  if (signal?.aborted) interrupt();
  let outcome: Awaited<ReturnType<typeof runManagedOpenCode>>;
  try {
    outcome = await runManagedOpenCode(root, parent, profile, {
      sessionId, executionId: prepared.lease.executionId, prompt: prepared.prompt, signal: controller.signal,
      authorize: async () => {
        await withManagedProject(root, sessionId, owner.id, claim => assertBinding(root, claim));
        const current = await store.get(sessionId, supervisor);
        if (current.state.status !== 'running' || current.state.lease.token !== prepared.lease.leaseToken
          || Date.parse(current.state.lease.expiresAt) <= Date.now()) throw new FoundryError('Managed execution lost authority');
      },
      observe: async text => {
        const current = await store.get(sessionId, supervisor);
        if (current.state.status === 'running') await send(store, current, supervisor, { type: 'execution.output', ...prepared.lease, text });
      },
    });
  } catch (error) {
    const current = await store.get(sessionId, owner);
    if ('lease' in current.state) await send(store, current, supervisor, { type: 'execution.unknown', ...prepared.lease }).catch(() => {});
    throw error;
  } finally {
    clearInterval(watch);
    signal?.removeEventListener('abort', interrupt);
    await pending;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await store.get(sessionId, owner);
    const result = current.state.status === 'stopping' ? { kind: 'stopped' }
      : current.state.status === 'pausing' ? { kind: 'paused', checkpointId: randomUUID() }
        : outcome.outcome === 'candidate' ? { kind: 'candidate', candidateDigest: await workspaceRevision(root) }
          : { kind: 'failed', evidenceDigest: digest(canonicalJson({ executionId: prepared.lease.executionId, outcome: outcome.outcome })) };
    try { return await send(store, current, supervisor, { type: 'execution.confirm', ...prepared.lease, resourcesStopped: true, effectsKnown: true, result }); }
    catch (error) { if ((error as { code?: string }).code !== 'revision_conflict' || attempt === 4) throw error; }
  }
  throw new FoundryError('Managed confirmation requires inspection');
}

export async function recoverManagedOpenCodeTurn(rootInput: string, parent: string, store: SessionStore, owner: Owner,
  inspector: Inspector, sessionId: ManagedSession['id'], acknowledgeDigest?: string): Promise<unknown> {
  const root = await requireRuntimeWorkspace(rootInput, 'inspect managed execution in');
  return withManagedProject(root, sessionId, owner.id, async claim => {
    let session = await store.get(sessionId, owner);
    assertSession(claim, session);
    if (session.executor.kind !== 'opencode' || !('executionId' in session.state)) throw new FoundryError('No managed execution needs inspection');
    if ('lease' in session.state && Date.parse(session.state.lease.expiresAt) <= Date.now()) {
      session = await send(store, session, inspector, { type: 'execution.expire', executionId: session.state.executionId });
    }
    if (session.state.status !== 'recovery-required') throw new FoundryError('Only uncertain or expired execution can be reconciled');
    const inspection = await inspectManagedLaunch(parent, sessionId, session.state.executionId);
    if (acknowledgeDigest !== undefined) {
      if (!inspection.stopped || acknowledgeDigest !== inspection.digest) throw new FoundryError('Inspection changed or execution resources remain');
      return send(store, session, inspector, { type: 'execution.reconcile', executionId: session.state.executionId,
        inspectionDigest: inspection.digest, resourcesStopped: true, effectsKnown: true });
    }
    return inspection;
  });
}

export async function recoverManagedCreation(rootInput: string, store: SessionStore, owner: Owner, sessionId: ManagedSession['id']): Promise<ManagedSession> {
  const root = await requireRuntimeWorkspace(rootInput, 'inspect managed creation in');
  return withManagedProject(root, sessionId, owner.id, async claim => {
    await store.accept(claim.create, owner);
    const session = await store.get(sessionId, owner);
    assertSession(claim, session);
    return session;
  });
}

export async function controlManagedTask(root: string, store: SessionStore, owner: Owner, command: SessionCommand): Promise<ManagedSession> {
  return withManagedProject(root, command.sessionId, owner.id, async claim => {
    if (command.type === 'session.resume' || command.type === 'session.retry') await assertBinding(root, claim);
    await store.accept(command, owner);
    return store.get(command.sessionId, owner);
  });
}

function watchVerification(store: SessionStore, initial: ManagedSession, supervisor: Supervisor) {
  if (!('lease' in initial.state)) throw new FoundryError('Verification needs a live lease');
  const lease = leasedFields(initial.state);
  let canceled = false;
  let error: unknown;
  let busy = false;
  let heartbeat = Date.now();
  let pending: Promise<void> = Promise.resolve();
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    pending = (async () => {
      const session = await store.get(initial.id, supervisor);
      if (session.state.status !== 'verifying') { canceled = true; return; }
      if (Date.now() - heartbeat >= 10_000) {
        await send(store, session, supervisor, { type: 'execution.heartbeat', ...lease, leaseSeconds: 60 });
        heartbeat = Date.now();
      }
    })().catch(reason => { error = reason; canceled = true; }).finally(() => { busy = false; });
  }, 50);
  return { canceled: () => canceled, async close() { clearInterval(timer); await pending; if (error) throw error; } };
}

export type TrustedFixtureWork = { root: string; assignment: Awaited<ReturnType<typeof prepareAssignment>> };

export async function dispatchFixtureTurn(
  rootInput: string, store: SessionStore, owner: Owner, supervisor: Supervisor, sessionId: ManagedSession['id'],
  execute: (work: TrustedFixtureWork, signal: AbortSignal) => Promise<z.infer<typeof fixtureOutcomeSchema>>,
  deadlineMs = 30_000,
): Promise<ManagedSession> {
  const root = await requireRuntimeWorkspace(rootInput, 'dispatch a trusted fixture in');
  z.number().int().min(1).max(30_000).parse(deadlineMs);
  const prepared = await withManagedProject(root, sessionId, owner.id, async claim => {
    await assertBinding(root, claim);
    let session = await store.get(sessionId, owner);
    assertSession(claim, session);
    if (session.executor.kind !== 'fixture' || session.state.status !== 'queued') throw new FoundryError('Only an explicitly queued fixture turn can dispatch');
    const context = await workContext(root);
    if (session.turnsUsed > 1 && context.run?.saved_status === 'paused') await pauseOrResume(root, false, context.snapshot_revision);
    const assignment = await prepareAssignment(root, 'builder');
    session = await send(store, session, supervisor, { type: 'execution.claim', instanceId: supervisor.id, leaseSeconds: 60 });
    if (session.state.status !== 'running') throw new FoundryError('Fixture execution was not claimed');
    return { session, lease: leasedFields(session.state), assignment };
  });
  // No project authority, actor credentials or lease is passed into fixture work.
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  let poll: NodeJS.Timeout | undefined;
  let pending = Promise.resolve();
  let polling = false;
  try {
    poll = setInterval(() => {
      if (polling) return;
      polling = true;
      pending = store.get(sessionId, owner).then(session => {
        if (session.state.status !== 'running') controller.abort();
      }).catch(() => controller.abort()).finally(() => { polling = false; });
    }, 50);
    const outcome = await Promise.race([
      execute({ root, assignment: structuredClone(prepared.assignment) }, controller.signal),
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new FoundryError('Fixture turn outcome is unknown')); }, deadlineMs); }),
    ]);
    fixtureOutcomeSchema.parse(outcome);
  } catch (error) {
    const session = await store.get(sessionId, owner);
    if ('lease' in session.state) await send(store, session, supervisor, { type: 'execution.unknown', ...prepared.lease });
    throw error;
  } finally {
    clearTimeout(timeout);
    clearInterval(poll);
    await pending;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await store.get(sessionId, owner);
    const result = session.state.status === 'stopping' ? { kind: 'stopped' }
      : session.state.status === 'pausing' ? { kind: 'paused', checkpointId: randomUUID() }
        : { kind: 'candidate', candidateDigest: await workspaceRevision(root) };
    try { return await send(store, session, supervisor, { type: 'execution.confirm', ...prepared.lease, resourcesStopped: true, effectsKnown: true, result }); }
    catch (error) { if ((error as { code?: string }).code !== 'revision_conflict' || attempt === 2) throw error; }
  }
  throw new FoundryError('Fixture confirmation needs inspection');
}

async function coreEvidence(root: string, candidateDigest: string): Promise<Evidence> {
  const context = await workContext(root);
  if (!context.evidence.receipt || !context.evidence.receipt_sha256) throw new FoundryError('Core verification receipt is missing');
  const saved = await readBoundedText(root, context.evidence.receipt, 1_048_576);
  const receipt = z.object({ inputs_before: z.string() }).parse(JSON.parse(saved.text));
  if (digest(saved.bytes) !== context.evidence.receipt_sha256 || receipt.inputs_before !== candidateDigest) throw new FoundryError('Core verification does not match the candidate');
  return verificationEvidenceSchema.parse({ receipt: context.evidence.receipt, receiptDigest: context.evidence.receipt_sha256, inputsDigest: candidateDigest });
}

export async function verifyManagedCandidate(rootInput: string, store: SessionStore, owner: Owner, supervisor: Supervisor, sessionId: ManagedSession['id']): Promise<ManagedSession> {
  const root = await requireRuntimeWorkspace(rootInput, 'verify a managed candidate in');
  return withManagedProject(root, sessionId, owner.id, async claim => {
    await assertBinding(root, claim);
    let session = await store.get(sessionId, owner);
    assertSession(claim, session);
    if (session.state.status !== 'awaiting-verification' || session.state.candidateDigest !== await workspaceRevision(root)) throw new FoundryError('Managed verification needs an unchanged confirmed candidate');
    const candidateDigest = session.state.candidateDigest;
    session = await send(store, session, supervisor, { type: 'verification.start', executionId: session.state.executionId, candidateDigest, instanceId: supervisor.id, leaseSeconds: 60 });
    if (session.state.status !== 'verifying') throw new FoundryError('Verification was not claimed');
    const lease = leasedFields(session.state);
    const watch = watchVerification(store, session, supervisor);
    let code: number;
    try { code = await verify(root, watch.canceled, (await workContext(root)).snapshot_revision); }
    finally { await watch.close(); }
    session = await store.get(sessionId, owner);
    if (session.state.status === 'stopping' || session.state.status === 'pausing') {
      return send(store, session, supervisor, { type: 'execution.confirm', ...lease, resourcesStopped: true, effectsKnown: true,
        result: session.state.status === 'stopping' ? { kind: 'stopped' } : { kind: 'paused', checkpointId: randomUUID() } });
    }
    const evidence = await coreEvidence(root, candidateDigest);
    if (code === 0) {
      await assertBinding(root, claim);
      if ((await workContext(root)).evidence.status !== 'current' || await workspaceRevision(root) !== candidateDigest) throw new FoundryError('Passing checks are no longer current');
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      session = await store.get(sessionId, owner);
      const fields = session.state.status === 'stopping' || session.state.status === 'pausing'
        ? { type: 'execution.confirm', ...lease, resourcesStopped: true, effectsKnown: true,
          result: session.state.status === 'stopping' ? { kind: 'stopped' } : { kind: 'paused', checkpointId: randomUUID() } }
        : { type: 'verification.record', ...lease, resourcesStopped: true, effectsKnown: true, candidateDigest, evidence, outcome: code === 0 ? 'passed' : 'failed' };
      try { return await send(store, session, supervisor, fields); }
      catch (error) { if ((error as { code?: string }).code !== 'revision_conflict' || attempt === 2) throw error; }
    }
    throw new FoundryError('Verification confirmation needs inspection');
  });
}

export async function publishManagedTask(rootInput: string, store: SessionStore, owner: Owner, inspector: Inspector, sessionId: ManagedSession['id']): Promise<ManagedSession> {
  const root = await requireRuntimeWorkspace(rootInput, 'record verified managed work in');
  return withManagedProject(root, sessionId, owner.id, async claim => {
    await assertBinding(root, claim);
    const session = await store.get(sessionId, owner);
    assertSession(claim, session);
    if (session.state.status === 'stopped') {
      const page = await store.events(sessionId, owner, Math.max(0, session.sequence - 8));
      if (page.events.some(event => event.data.kind === 'task-recorded')) return session;
    }
    if (session.state.status !== 'recording-task') throw new FoundryError('Only core-verified work can record a task');
    const context = await workContext(root);
    const evidence = session.state.evidence;
    if (context.evidence.status !== 'current' || context.evidence.receipt !== evidence.receipt
      || context.evidence.receipt_sha256 !== evidence.receiptDigest || await workspaceRevision(root) !== evidence.inputsDigest) throw new FoundryError('Task recording evidence changed; inspection is required');
    const task = context.plan?.tasks.find(task => task.id === session.assignment.taskId);
    if (task?.status === 'done') {
      if (task.evidence?.receipt !== evidence.receipt || task.evidence.receipt_sha256 !== evidence.receiptDigest) throw new FoundryError('Recorded task has different evidence');
    } else {
      await finishTask(root, session.assignment.taskId, context.snapshot_revision);
    }
    return send(store, session, inspector, { type: 'task.recorded', receiptDigest: evidence.receiptDigest });
  });
}

export async function releaseManagedTask(rootInput: string, store: SessionStore, owner: Owner, sessionId: ManagedSession['id']): Promise<void> {
  const root = await requireRuntimeWorkspace(rootInput, 'release stopped managed work in');
  await withManagedProject(root, sessionId, owner.id, async claim => {
    const session = await store.get(sessionId, owner);
    assertSession(claim, session);
    if (session.state.status !== 'stopped' || (await store.effects(sessionId, owner)).some(effect => !['confirmed', 'canceled'].includes(effect.status))) throw new FoundryError('Managed resources or effects remain unresolved');
    await releaseManagedProject(root, claim);
  });
}
