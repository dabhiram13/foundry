import { z } from 'zod';

export const SESSION_EVENT_LIMIT = 100_000;
export const SESSION_CONTROL_RESERVE = 8;

export const sessionIdSchema = z.uuid().brand<'SessionId'>();
const executionIdSchema = z.uuid().brand<'ExecutionId'>();
const requestIdSchema = z.uuid().brand<'RequestId'>();
const identitySchema = z.uuid();
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const counterSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const timeSchema = z.iso.datetime();
const textSchema = z.string().min(1).max(65_536)
  .refine((text) => new TextEncoder().encode(text).byteLength <= 65_536);
const outputSchema = textSchema.max(16_384)
  .refine((text) => new TextEncoder().encode(text).byteLength <= 16_384);

export const actorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('owner'), id: identitySchema }),
  z.strictObject({ kind: z.literal('supervisor'), id: identitySchema }),
  z.strictObject({ kind: z.literal('inspector'), id: identitySchema }),
]);
export type SessionActor = z.infer<typeof actorSchema>;

export const assignmentBindingSchema = z.strictObject({
  projectBindingId: identitySchema,
  runId: identitySchema,
  taskId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/),
  scopeRevision: hashSchema,
  approvalDigest: hashSchema,
  roleDigest: hashSchema,
  checksDigest: hashSchema,
});

const leaseSchema = z.strictObject({
  instanceId: identitySchema,
  token: identitySchema,
  fence: counterSchema.min(1),
  expiresAt: timeSchema,
});
export type ExecutionLease = z.infer<typeof leaseSchema>;

export const verificationEvidenceSchema = z.strictObject({
  receipt: z.string().regex(/^\.foundry\/state\/runs\/[a-f0-9-]{36}\/verification-[a-f0-9-]{36}\/receipts\.json$/),
  receiptDigest: hashSchema,
  inputsDigest: hashSchema,
});

const executorSchema = z.strictObject({ kind: z.enum(['opencode', 'fixture']), profileId: identitySchema, profileDigest: hashSchema.optional() });

export const sessionStateSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('idle') }),
  z.strictObject({ status: z.literal('queued'), executionId: executionIdSchema }),
  z.strictObject({ status: z.literal('running'), executionId: executionIdSchema, lease: leaseSchema }),
  z.strictObject({ status: z.literal('verifying'), executionId: executionIdSchema, candidateDigest: hashSchema, lease: leaseSchema }),
  z.strictObject({ status: z.literal('pausing'), executionId: executionIdSchema, lease: leaseSchema }),
  z.strictObject({ status: z.literal('stopping'), executionId: executionIdSchema, lease: leaseSchema }),
  z.strictObject({ status: z.literal('paused'), checkpointId: identitySchema, previousExecutionId: executionIdSchema }),
  z.strictObject({ status: z.literal('stopped') }),
  z.strictObject({ status: z.literal('failed'), executionId: executionIdSchema, evidenceDigest: hashSchema }),
  z.strictObject({ status: z.literal('awaiting-verification'), executionId: executionIdSchema, candidateDigest: hashSchema }),
  z.strictObject({ status: z.literal('recording-task'), executionId: executionIdSchema, candidateDigest: hashSchema, evidence: verificationEvidenceSchema }),
  z.strictObject({ status: z.literal('recovery-required'), executionId: executionIdSchema, reason: z.enum(['lease-expired', 'outcome-unknown']) }),
]);
export type SessionState = z.infer<typeof sessionStateSchema>;

export const sessionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: sessionIdSchema,
  ownerId: identitySchema,
  assignment: assignmentBindingSchema,
  executor: executorSchema,
  consentRef: identitySchema,
  maxTurns: z.number().int().min(1).max(100),
  turnsUsed: counterSchema,
  outputBytes: counterSchema.max(2_097_152),
  revision: counterSchema,
  sequence: counterSchema.max(SESSION_EVENT_LIMIT + SESSION_CONTROL_RESERVE),
  fence: counterSchema,
  createdAt: timeSchema,
  updatedAt: timeSchema,
  state: sessionStateSchema,
}).superRefine((session, context) => {
  if (session.turnsUsed > session.maxTurns) context.addIssue({ code: 'custom', message: 'Turn budget exceeded' });
  if ('lease' in session.state && session.state.lease.fence !== session.fence) {
    context.addIssue({ code: 'custom', message: 'Lease fence does not match session' });
  }
});
export type ManagedSession = z.infer<typeof sessionSchema>;

const envelope = {
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
  expectedRevision: counterSchema,
};
const executionEnvelope = { ...envelope, executionId: executionIdSchema, leaseToken: identitySchema, fence: counterSchema.min(1) };

export const sessionCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('session.create'), sessionId: sessionIdSchema, requestId: requestIdSchema,
    assignment: assignmentBindingSchema,
    executor: executorSchema,
    consentRef: identitySchema, maxTurns: z.number().int().min(1).max(100),
  }),
  z.strictObject({ ...envelope, type: z.literal('message.send'), text: textSchema }),
  z.strictObject({ ...envelope, type: z.literal('session.pause') }),
  z.strictObject({ ...envelope, type: z.literal('session.stop') }),
  z.strictObject({ ...envelope, type: z.literal('session.resume'), checkpointId: identitySchema }),
  z.strictObject({ ...envelope, type: z.literal('session.retry'), failedExecutionId: executionIdSchema }),
  z.strictObject({ ...envelope, type: z.literal('execution.claim'), instanceId: identitySchema, leaseSeconds: z.number().int().min(1).max(60) }),
  z.strictObject({ ...executionEnvelope, type: z.literal('execution.heartbeat'), leaseSeconds: z.number().int().min(1).max(60) }),
  z.strictObject({ ...executionEnvelope, type: z.literal('execution.output'), text: outputSchema }),
  z.strictObject({
    ...executionEnvelope, type: z.literal('execution.confirm'), resourcesStopped: z.literal(true), effectsKnown: z.literal(true),
    result: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('paused'), checkpointId: identitySchema }),
      z.strictObject({ kind: z.literal('stopped') }),
      z.strictObject({ kind: z.literal('failed'), evidenceDigest: hashSchema }),
      z.strictObject({ kind: z.literal('candidate'), candidateDigest: hashSchema }),
    ]),
  }),
  z.strictObject({ ...executionEnvelope, type: z.literal('execution.unknown') }),
  z.strictObject({
    ...envelope, type: z.literal('verification.start'), executionId: executionIdSchema,
    candidateDigest: hashSchema, instanceId: identitySchema, leaseSeconds: z.number().int().min(1).max(60),
  }),
  z.strictObject({
    ...executionEnvelope, type: z.literal('verification.record'), candidateDigest: hashSchema,
    resourcesStopped: z.literal(true), effectsKnown: z.literal(true),
    outcome: z.enum(['passed', 'failed']), evidence: verificationEvidenceSchema,
  }),
  z.strictObject({ ...envelope, type: z.literal('task.recorded'), receiptDigest: hashSchema }),
  z.strictObject({
    ...envelope, type: z.literal('task.abandon'), inspectionDigest: hashSchema,
    resourcesStopped: z.literal(true), effectsKnown: z.literal(true),
  }),
  z.strictObject({ ...envelope, type: z.literal('execution.expire'), executionId: executionIdSchema }),
  z.strictObject({
    ...envelope, type: z.literal('execution.reconcile'), executionId: executionIdSchema,
    inspectionDigest: hashSchema, resourcesStopped: z.literal(true), effectsKnown: z.literal(true),
  }),
]);
export type SessionCommand = z.infer<typeof sessionCommandSchema>;

export const effectSchema = z.strictObject({
  id: identitySchema,
  sessionId: sessionIdSchema,
  executionId: executionIdSchema,
  kind: z.enum(['start', 'pause', 'stop']),
  status: z.enum(['pending', 'claimed', 'confirmed', 'uncertain', 'canceled']),
  text: textSchema.nullable(),
});
export type SessionEffect = z.infer<typeof effectSchema>;

export const receiptSchema = z.strictObject({
  sessionId: sessionIdSchema, requestId: requestIdSchema,
  acceptedRevision: counterSchema, eventSequence: counterSchema,
  effectIds: z.array(identitySchema).max(2),
});
export type SessionReceipt = z.infer<typeof receiptSchema>;

export const sessionEventSchema = z.strictObject({
  schemaVersion: z.literal(1), sessionId: sessionIdSchema,
  sequence: counterSchema.min(1), revision: counterSchema,
  at: timeSchema, source: z.enum(['owner', 'supervisor', 'inspector']),
  data: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('state'), state: sessionStateSchema }),
    z.strictObject({ kind: z.literal('output'), executionId: executionIdSchema, text: outputSchema }),
    z.strictObject({ kind: z.literal('heartbeat'), executionId: executionIdSchema, expiresAt: timeSchema }),
    z.strictObject({ kind: z.literal('inspection'), executionId: executionIdSchema, digest: hashSchema }),
    z.strictObject({ kind: z.literal('verification'), outcome: z.enum(['passed', 'failed']), candidateDigest: hashSchema, evidence: verificationEvidenceSchema }),
    z.strictObject({ kind: z.literal('task-recorded'), taskId: assignmentBindingSchema.shape.taskId, evidence: verificationEvidenceSchema }),
  ]),
});
export type SessionEvent = z.infer<typeof sessionEventSchema>;

export const sessionErrorCodeSchema = z.enum([
  'invalid_input', 'not_found', 'forbidden', 'revision_conflict', 'idempotency_conflict',
  'invalid_state', 'project_busy', 'lease_conflict', 'recovery_required', 'budget_exhausted',
  'storage_busy', 'storage_invalid', 'worker_unavailable', 'cursor_invalid',
]);
export type SessionErrorCode = z.infer<typeof sessionErrorCodeSchema>;

export class SessionError extends Error {
  constructor(readonly code: SessionErrorCode) {
    super(`Managed session: ${code}`);
    this.name = 'SessionError';
  }
}

export const eventPageSchema = z.strictObject({
  events: z.array(sessionEventSchema).max(200), nextCursor: counterSchema, hasMore: z.boolean(),
});
