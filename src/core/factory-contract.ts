import { lstat, readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  atomicJson, digest, exists, FoundryError, within,
} from './fs.js';
import { approvedCriteria, reviewSchema, validateReview } from './review.js';

export const FACTORY_STATE = '.foundry/state/factory/controller.json';
export const FACTORY_LOCK = '.foundry/state/factory/controller.lock';
export const FACTORY_CANCEL = '.foundry/state/factory/cancel.json';
export const FACTORY_CANCEL_LOCK = '.foundry/state/factory/cancel.lock';
const MAX_CONTROLLER_BYTES = 4 * 1024 * 1024;

export const FACTORY_STAGES = ['research', 'scope', 'design', 'build', 'verify', 'release'] as const;
export type FactoryStage = typeof FACTORY_STAGES[number];

export const FACTORY_STAGE_LABELS: Record<FactoryStage, string> = {
  research: 'Research',
  scope: 'Plan',
  design: 'Design',
  build: 'Build',
  verify: 'Test',
  release: 'Ship',
};

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const projectPathSchema = z.string().min(1).max(1024).refine(
  (value) => !value.startsWith('/') && !value.includes('\\') && !value.includes('\0')
    && !value.split('/').some((part) => !part || part === '.' || part === '..')
    && !value.split('/').includes('.git'),
  'Expected a safe project-relative path',
);
const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  status: z.enum(['pending', 'working', 'done', 'failed']),
  repair_attempts: z.number().int().min(0).max(3),
  checkpoint: z.string().regex(/^[a-f0-9]{40,64}$/).nullable(),
}).strict();
const approvalSchema = z.object({
  revision: sha256Schema,
  approved_at: z.string().min(1).max(64),
  criteria: z.array(z.object({
    id: z.string().regex(/^[A-Z][A-Z0-9_-]{1,63}$/),
    expected: z.string().trim().min(1).max(10_000),
  }).strict()).max(200),
}).strict();
const evidenceDigestSchema = z.object({
  path: projectPathSchema,
  sha256: sha256Schema,
}).strict();
const workflowCriterionSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/),
  expected: z.string().trim().min(1).max(10_000),
  check_name: z.string().min(1).max(128),
  command: z.array(z.string().min(1).max(1024)).min(1).max(128),
  inputs: z.array(projectPathSchema).max(100),
  fingerprint: sha256Schema,
}).strict();
const reviewBindingSchema = z.object({
  provider_task_id: z.string().uuid(),
  provider_status: z.literal('completed'),
  receipt_path: projectPathSchema,
  plan_revision: sha256Schema,
  workspace_revision: sha256Schema,
  reviewed_at: z.string().min(1).max(64),
  evidence: z.array(evidenceDigestSchema).max(200),
  result: reviewSchema,
}).strict();
const roleSelectionsSchema = z.object({
  research: z.string().min(1).max(128),
  scope: z.string().min(1).max(128),
  design: z.string().min(1).max(128),
  build: z.string().min(1).max(128),
  verify: z.string().min(1).max(128),
  release: z.string().min(1).max(128),
}).strict();
const billingSchema = z.object({
  mode: z.enum(['local', 'subscription']),
  confirmed: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.mode === 'subscription' && !value.confirmed) {
    context.addIssue({ code: 'custom', message: 'Subscription billing requires explicit confirmation' });
  }
});
const factoryStatusSchema = z.enum([
  'ready', 'awaiting_approval', 'running', 'interrupted', 'failed',
  'reviewed', 'shipping', 'completed', 'recovery_required',
]);
const controllerSchema = z.object({
  schema_version: z.literal(1),
  workspace_id: z.string().uuid(),
  created_at: z.string().min(1).max(64),
  updated_at: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  status: factoryStatusSchema,
  stage: z.enum(FACTORY_STAGES),
  completed_stages: z.array(z.enum(FACTORY_STAGES)).max(FACTORY_STAGES.length)
    .refine((items) => new Set(items).size === items.length),
  adapter: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  kind: z.literal('agent-runtime'),
  model: z.string().trim().min(1).max(120).nullable(),
  reasoning: z.string().trim().min(1).max(120).nullable(),
  billing: billingSchema,
  roles: roleSelectionsSchema,
  lifecycle_run_id: z.string().uuid().nullable(),
  provider_task_id: z.string().uuid().nullable(),
  provider_stage: z.enum(FACTORY_STAGES).nullable(),
  approvals: z.object({
    plan: approvalSchema.nullable(),
    design: approvalSchema.nullable(),
  }).strict(),
  documents: z.object({
    idea: sha256Schema,
    research: sha256Schema.nullable(),
    plan: sha256Schema.nullable(),
    design: sha256Schema.nullable(),
    tasks: sha256Schema.nullable(),
  }).strict(),
  workflow_criteria: z.array(workflowCriterionSchema).max(200),
  build_tasks: z.array(taskSchema).max(12),
  verification_receipt: projectPathSchema.nullable(),
  review: reviewBindingSchema.nullable(),
  ship: z.object({
    path: projectPathSchema,
    sha256: sha256Schema,
  }).strict().nullable(),
  failure: z.object({
    stage: z.enum(FACTORY_STAGES),
    code: z.enum(['provider', 'artifact', 'check', 'review', 'canceled', 'recovery']),
    message: z.string().min(1).max(300),
    at: z.string().min(1).max(64),
  }).strict().nullable(),
}).strict();

export type FactoryState = z.infer<typeof controllerSchema>;
export type FactoryApproval = z.infer<typeof approvalSchema>;
export type FactoryReviewBinding = z.infer<typeof reviewBindingSchema>;

export const factoryShipSchema = z.object({
  schema_version: z.literal(1),
  run_id: z.string().uuid(),
  created_at: z.string().min(1).max(64),
  plan_revision: sha256Schema,
  workspace_revision: sha256Schema,
  verification_receipt: projectPathSchema,
  review_sha256: sha256Schema,
  summary: z.string().min(1).max(20_000),
  publication: z.literal('not_authorized'),
}).strict();

export async function readFactoryState(root: string): Promise<FactoryState | null> {
  if (!(await exists(root, FACTORY_STATE))) return null;
  try {
    const bytes = await readBoundedBytes(root, FACTORY_STATE, MAX_CONTROLLER_BYTES);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return controllerSchema.parse(JSON.parse(text));
  } catch (error) {
    throw new FoundryError(`Invalid factory controller state: ${(error as Error).message}`, { cause: error });
  }
}

export async function writeFactoryState(root: string, state: FactoryState): Promise<void> {
  const parsed = controllerSchema.parse(state);
  if (Buffer.byteLength(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8') > MAX_CONTROLLER_BYTES) {
    throw new FoundryError('Factory controller state exceeds the bounded size limit');
  }
  await atomicJson(root, FACTORY_STATE, parsed);
}

export async function readBoundedBytes(root: string, relative: string, limit = 8 * 1024 * 1024): Promise<Buffer> {
  const absolute = within(root, relative);
  let info;
  try {
    info = await lstat(absolute);
  } catch (error) {
    throw new FoundryError(`Required document is unavailable: ${relative}`, { cause: error });
  }
  if (!info.isFile() || info.isSymbolicLink()) throw new FoundryError(`Required document is not a regular file: ${relative}`);
  if (info.size > limit) throw new FoundryError(`Document exceeds the bounded read limit: ${relative}`);
  const bytes = await readFile(absolute);
  if (bytes.length > limit) throw new FoundryError(`Document exceeds the bounded read limit: ${relative}`);
  return bytes;
}

export async function readBoundedText(root: string, relative: string, limit = 8 * 1024 * 1024): Promise<{
  bytes: Buffer;
  text: string;
}> {
  const bytes = await readBoundedBytes(root, relative, limit);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new FoundryError(`Document is not valid UTF-8: ${relative}`, { cause: error });
  }
  return { bytes, text };
}

export async function reviewEvidenceDigests(
  root: string,
  input: unknown,
): Promise<{ digests: Map<string, string>; entries: Array<{ path: string; sha256: string }> }> {
  const review = reviewSchema.parse(input);
  const paths = [...new Set(review.criteria.flatMap((criterion) => criterion.evidence.map((evidence) => evidence.path)))].sort();
  if (paths.length > 200) throw new FoundryError('Review references more than 200 unique evidence files');
  const digests = new Map<string, string>();
  let total = 0;
  for (const relative of paths) {
    const bytes = await readBoundedBytes(root, relative, 8 * 1024 * 1024);
    total += bytes.length;
    if (total > 64 * 1024 * 1024) throw new FoundryError('Review evidence exceeds the 64 MiB total limit');
    digests.set(relative, digest(bytes));
  }
  return {
    digests,
    entries: [...digests].map(([file, sha256]) => ({ path: file, sha256 })),
  };
}

export async function assertFactoryShipGate(
  root: string,
  runId: string,
  verificationPath: string,
  workspaceRevision: string,
  allowMissingSummary = false,
): Promise<void> {
  const state = await readFactoryState(root);
  if (!state) return;
  const preparingShip = allowMissingSummary
    && (state.status === 'reviewed' || state.status === 'running')
    && state.ship === null;
  if ((!preparingShip && state.status !== 'shipping') || state.stage !== 'release' || state.lifecycle_run_id !== runId) {
    throw new FoundryError('Factory Ship review gate is not ready for this lifecycle run');
  }
  const planApproval = state.approvals.plan;
  const designApproval = state.approvals.design;
  const review = state.review;
  const ship = state.ship;
  if (!planApproval || !designApproval || !review || (!ship && !allowMissingSummary)) {
    throw new FoundryError('Factory Ship needs current Plan, Design and Test review evidence');
  }
  const plan = await readBoundedText(root, 'docs/specs/product.md');
  const design = await readBoundedText(root, 'docs/product/design.md');
  if (digest(plan.bytes) !== planApproval.revision || digest(design.bytes) !== designApproval.revision) {
    throw new FoundryError('Factory approval documents changed; fresh owner approval is required');
  }
  const approved = approvedCriteria(plan.text);
  if (JSON.stringify(approved) !== JSON.stringify(planApproval.criteria)) {
    throw new FoundryError('Factory approved Plan criteria no longer match the frozen approval');
  }
  if (review.receipt_path !== verificationPath
    || review.plan_revision !== planApproval.revision
    || review.workspace_revision !== workspaceRevision) {
    throw new FoundryError('Factory review does not match the current verified Plan and workspace');
  }
  const receiptBytes = await readBoundedText(root, verificationPath);
  let receipt: Record<string, unknown>;
  try {
    const parsed = JSON.parse(receiptBytes.text) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    receipt = parsed as Record<string, unknown>;
  } catch (error) {
    throw new FoundryError('Factory final verification receipt is malformed', { cause: error });
  }
  if (receipt.run_id !== runId || receipt.passed !== true
    || receipt.inputs_before !== workspaceRevision || receipt.inputs_after !== workspaceRevision) {
    throw new FoundryError('Factory final verification receipt is stale or unsuccessful');
  }
  const actualEvidence = await reviewEvidenceDigests(root, review.result);
  if (JSON.stringify(actualEvidence.entries) !== JSON.stringify(review.evidence)) {
    throw new FoundryError('Factory review evidence changed after review');
  }
  try {
    validateReview(review.result, {
      plan_revision: planApproval.revision,
      workspace_revision: workspaceRevision,
      criteria: planApproval.criteria,
    }, actualEvidence.digests);
  } catch (error) {
    throw new FoundryError(`Factory review is invalid: ${(error as Error).message}`, { cause: error });
  }
  if (ship) {
    if (ship.path !== '.foundry/state/factory/ship.json') {
      throw new FoundryError('Factory Ship summary path is invalid');
    }
    const shipBytes = await readBoundedText(root, ship.path);
    if (digest(shipBytes.bytes) !== ship.sha256) throw new FoundryError('Factory Ship summary changed after validation');
    let summary: unknown;
    try {
      summary = JSON.parse(shipBytes.text) as unknown;
    } catch (error) {
      throw new FoundryError('Factory Ship summary is malformed', { cause: error });
    }
    try {
      const parsed = factoryShipSchema.parse(summary);
      if (parsed.run_id !== runId || parsed.plan_revision !== planApproval.revision
        || parsed.workspace_revision !== workspaceRevision || parsed.verification_receipt !== verificationPath
        || parsed.review_sha256 !== digest(JSON.stringify(review.result))) {
        throw new FoundryError('Factory Ship summary does not match its review evidence');
      }
    } catch (error) {
      if (error instanceof FoundryError) throw error;
      throw new FoundryError(`Factory Ship summary is invalid: ${(error as Error).message}`, { cause: error });
    }
  } else if (!preparingShip) {
    throw new FoundryError('Factory Ship summary is missing');
  }
  const { gate } = await import('./workflow.js');
  const workflow = await gate(root, 'verify');
  if (workflow.status !== 'pass') throw new FoundryError('Factory Ship workflow verification gate is not passing');
}
