import { randomUUID } from 'node:crypto';
import {
  SessionError, sessionStateSchema, SESSION_EVENT_LIMIT, SESSION_CONTROL_RESERVE,
  type ManagedSession, type SessionActor, type SessionCommand, type SessionEffect,
  type SessionEvent, type SessionState,
} from './session-contract.js';

export type SessionTransition = {
  session: ManagedSession;
  events: Array<SessionEvent['data']>;
  effects: SessionEffect[];
  priorEffects: 'keep' | 'claim' | 'confirm' | 'cancel' | 'cancel-pause' | 'uncertain';
};

type ActiveState = Extract<SessionState, { status: 'running' | 'pausing' | 'stopping' }>;

export function assertSessionAccess(session: ManagedSession, actor: SessionActor): void {
  if (actor.kind === 'owner' && session.ownerId !== actor.id) throw new SessionError('forbidden');
}

export function transitionSession(
  current: ManagedSession,
  command: Exclude<SessionCommand, { type: 'session.create' }>,
  actor: SessionActor,
  clock: number,
): SessionTransition {
  assertSessionAccess(current, actor);
  const ownerCommand = command.type.startsWith('session.') || command.type === 'message.send';
  const inspectorCommand = command.type === 'execution.expire' || command.type === 'execution.reconcile';
  if (actor.kind !== (ownerCommand ? 'owner' : inspectorCommand ? 'inspector' : 'supervisor')) {
    throw new SessionError('forbidden');
  }
  const observational = command.type === 'execution.heartbeat' || command.type === 'execution.output';
  if (!observational && command.expectedRevision !== current.revision) throw new SessionError('revision_conflict');
  const next = structuredClone(current);
  const effects: SessionEffect[] = [];
  const events: Array<SessionEvent['data']> = [];
  let priorEffects: SessionTransition['priorEffects'] = 'keep';
  const state = current.state;
  const at = new Date(clock).toISOString();

  function active(): ActiveState {
    if (!('lease' in state)) throw new SessionError('invalid_state');
    return state;
  }

  function leased(): ActiveState {
    const running = active();
    if (!('leaseToken' in command) || running.executionId !== command.executionId
      || running.lease.token !== command.leaseToken || running.lease.fence !== command.fence
      || running.lease.instanceId !== actor.id) throw new SessionError('lease_conflict');
    if (Date.parse(running.lease.expiresAt) <= clock) throw new SessionError('recovery_required');
    return running;
  }

  function intent(kind: SessionEffect['kind'], executionId: SessionEffect['executionId'], text: string | null = null): void {
    effects.push({ id: randomUUID(), sessionId: current.id, executionId, kind, status: 'pending', text });
  }

  function queue(text: string | null): void {
    if (current.turnsUsed >= current.maxTurns) throw new SessionError('budget_exhausted');
    const queued = sessionStateSchema.parse({ status: 'queued', executionId: randomUUID() });
    if (queued.status !== 'queued') throw new SessionError('storage_invalid');
    next.state = queued;
    next.turnsUsed++;
    intent('start', queued.executionId, text);
  }

  switch (command.type) {
    case 'message.send':
      if (state.status !== 'idle') throw new SessionError('invalid_state');
      queue(command.text);
      break;
    case 'session.resume':
      if (state.status !== 'paused' || state.checkpointId !== command.checkpointId) throw new SessionError('invalid_state');
      queue(null);
      break;
    case 'session.retry':
      if (state.status !== 'failed' || state.executionId !== command.failedExecutionId) throw new SessionError('invalid_state');
      queue(null);
      break;
    case 'session.pause':
      if (state.status === 'queued') {
        next.state = { status: 'paused', previousExecutionId: state.executionId, checkpointId: randomUUID() };
        priorEffects = 'cancel';
      } else {
        const running = active();
        if (state.status !== 'running') throw new SessionError('invalid_state');
        if (Date.parse(running.lease.expiresAt) <= clock) throw new SessionError('recovery_required');
        next.state = { ...running, status: 'pausing' };
        intent('pause', running.executionId);
      }
      break;
    case 'session.stop':
      if (state.status === 'recovery-required') throw new SessionError('recovery_required');
      if (state.status === 'stopped' || state.status === 'stopping') throw new SessionError('invalid_state');
      if ('lease' in state) {
        if (Date.parse(state.lease.expiresAt) <= clock) throw new SessionError('recovery_required');
        next.state = { ...state, status: 'stopping' };
        priorEffects = 'cancel-pause';
        intent('stop', state.executionId);
      } else {
        next.state = { status: 'stopped' };
        priorEffects = 'cancel';
      }
      break;
    case 'execution.claim': {
      if (state.status !== 'queued' || actor.id !== command.instanceId) throw new SessionError('invalid_state');
      next.fence++;
      next.state = {
        status: 'running', executionId: state.executionId,
        lease: { instanceId: actor.id, token: randomUUID(), fence: next.fence, expiresAt: new Date(clock + command.leaseSeconds * 1000).toISOString() },
      };
      priorEffects = 'claim';
      break;
    }
    case 'execution.heartbeat': {
      const running = leased();
      next.state = { ...running, lease: { ...running.lease, expiresAt: new Date(clock + command.leaseSeconds * 1000).toISOString() } };
      events.push({ kind: 'heartbeat', executionId: running.executionId, expiresAt: next.state.lease.expiresAt });
      break;
    }
    case 'execution.output': {
      const running = leased();
      const bytes = new TextEncoder().encode(command.text).byteLength;
      if (current.outputBytes + bytes > 2_097_152) throw new SessionError('budget_exhausted');
      next.outputBytes += bytes;
      events.push({ kind: 'output', executionId: running.executionId, text: command.text });
      break;
    }
    case 'execution.confirm': {
      const running = leased();
      const result = command.result;
      if (running.status === 'stopping' ? result.kind !== 'stopped'
        : running.status === 'pausing' ? result.kind !== 'paused'
          : !['failed', 'candidate'].includes(result.kind)) throw new SessionError('invalid_state');
      switch (result.kind) {
        case 'stopped': next.state = { status: 'stopped' }; break;
        case 'paused': next.state = { status: 'paused', checkpointId: result.checkpointId, previousExecutionId: running.executionId }; break;
        case 'failed': next.state = { status: 'failed', executionId: running.executionId, evidenceDigest: result.evidenceDigest }; break;
        case 'candidate': next.state = { status: 'awaiting-verification', executionId: running.executionId, candidateDigest: result.candidateDigest }; break;
      }
      priorEffects = 'confirm';
      break;
    }
    case 'execution.unknown': {
      const running = leased();
      next.state = { status: 'recovery-required', executionId: running.executionId, reason: 'outcome-unknown' };
      priorEffects = 'uncertain';
      break;
    }
    case 'execution.expire': {
      const running = active();
      if (running.executionId !== command.executionId || Date.parse(running.lease.expiresAt) > clock) throw new SessionError('invalid_state');
      next.state = { status: 'recovery-required', executionId: running.executionId, reason: 'lease-expired' };
      priorEffects = 'uncertain';
      break;
    }
    case 'execution.reconcile':
      if (state.status !== 'recovery-required' || state.executionId !== command.executionId) throw new SessionError('invalid_state');
      next.state = { status: 'failed', executionId: state.executionId, evidenceDigest: command.inspectionDigest };
      events.push({ kind: 'inspection', executionId: state.executionId, digest: command.inspectionDigest });
      priorEffects = 'confirm';
      break;
  }
  if (!observational) {
    next.revision++;
    events.push({ kind: 'state', state: next.state });
  }
  next.sequence += events.length;
  const control = ['session.stop', 'execution.confirm', 'execution.unknown', 'execution.expire', 'execution.reconcile'].includes(command.type);
  const eventLimit = SESSION_EVENT_LIMIT + (control ? SESSION_CONTROL_RESERVE : 0);
  if (next.sequence > eventLimit || next.revision > Number.MAX_SAFE_INTEGER || next.fence > Number.MAX_SAFE_INTEGER) {
    throw new SessionError('budget_exhausted');
  }
  next.updatedAt = at;
  return { session: next, events, effects, priorEffects };
}
