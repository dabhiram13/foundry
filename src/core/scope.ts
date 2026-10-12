import { z } from 'zod';
import { atomicJson, atomicWrite, canonicalJson, digest, exists, FoundryError, now } from './fs.js';
import { readBoundedText } from './factory-contract.js';
import type { CheckConfig, RunState } from './lifecycle.js';
import { planPolicies, taskPlanSchema, type TaskPlan } from './work-plan.js';

const documentPath = z.string().min(1).max(1024).refine(
  value => !value.startsWith('/') && !value.includes('\\') && !value.includes('\0')
    && !value.split('/').some(part => !part || ['.', '..', '.git'].includes(part))
    && !value.startsWith('.foundry/state/'),
  'Use a project-relative document outside private runtime state',
);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const scopedBindingSchema = z.object({ contract: documentPath, approval_sha256: sha256.optional() }).strict();
export const contractSchema = z.object({
  schema_version: z.literal(1),
  criteria: z.array(z.object({
    id: z.string().regex(/^[A-Z][A-Z0-9_-]{1,63}$/),
    requirement: z.string().trim().min(1).max(10_000),
    checks: z.array(z.string().regex(/^[A-Za-z0-9_-]+$/)).max(20),
  }).strict()).min(1).max(200),
  plan: taskPlanSchema.optional(),
}).strict().superRefine((value, context) => {
  if (new Set(value.criteria.map(item => item.id)).size !== value.criteria.length) {
    context.addIssue({ code: 'custom', message: 'Acceptance IDs must be unique' });
  }
  if (value.criteria.some(item => new Set(item.checks).size !== item.checks.length)) {
    context.addIssue({ code: 'custom', message: 'A criterion cannot repeat a check' });
  }
  if (value.plan) {
    const ids = new Set(value.criteria.map(criterion => criterion.id));
    const covered = new Set(value.plan.tasks.flatMap(task => task.criteria));
    if ([...covered].some(criterion => !ids.has(criterion)) || [...ids].some(criterion => !covered.has(criterion))) {
      context.addIssue({ code: 'custom', message: 'Tasks must cover all acceptance criteria and reference only known criteria' });
    }
  }
});
const enrollmentSchema = z.object({
  schema_version: z.literal(1), run_id: z.string().uuid(), spec: documentPath, contract: documentPath,
}).strict();
const approvalSchema = enrollmentSchema.extend({
  revision: sha256, approved_at: z.string().datetime(), method: z.literal('manual_cli'),
}).strict();

export type ScopeApprovalStatus = 'pending' | 'current' | 'stale' | 'invalid';
export interface ScopeReview {
  schema_version: 1;
  kind: 'scope_review';
  run_id: string;
  revision: string;
  spec: { path: string; sha256: string; text: string };
  contract: { path: string; sha256: string };
  criteria: Array<{ id: string; requirement: string; checks: string[]; mapped: boolean }>;
  checks: CheckConfig[];
  plan?: TaskPlan;
  specialists?: Awaited<ReturnType<typeof planPolicies>>;
  approval: { status: ScopeApprovalStatus; revision: string | null; approved_at: string | null; method: 'manual_cli' | null; sha256: string | null };
  blockers: string[];
}

function enrollmentPath(state: RunState): string {
  return `.foundry/state/runs/${state.run_id}/scope.json`;
}
function approvalPath(state: RunState): string {
  return `.foundry/state/runs/${state.run_id}/scope-approval.json`;
}

export async function readScopeContract(root: string, relative: string) {
  documentPath.parse(relative);
  const document = await readBoundedText(root, relative, 256 * 1024);
  try {
    return { ...document, value: contractSchema.parse(JSON.parse(document.text)) };
  } catch (error) {
    throw new FoundryError(`Invalid scope contract: ${(error as Error).message}`, { cause: error });
  }
}

export async function enrollScope(root: string, state: RunState): Promise<void> {
  if (!state.scope) return;
  await atomicJson(root, enrollmentPath(state), enrollmentSchema.parse({
    schema_version: 1, run_id: state.run_id, spec: state.spec, contract: state.scope.contract,
  }));
}

export async function inspectScope(root: string, state: RunState, checks: CheckConfig[]): Promise<ScopeReview | null> {
  const enrolled = await exists(root, enrollmentPath(state));
  if (!state.scope && !enrolled) return null;
  if (!state.scope || !enrolled) throw new FoundryError('Scoped contract enrollment is missing or mismatched');
  const enrollmentBytes = await readBoundedText(root, enrollmentPath(state), 16 * 1024);
  const enrollment = enrollmentSchema.parse(JSON.parse(enrollmentBytes.text));
  if (enrollment.run_id !== state.run_id || enrollment.spec !== state.spec || enrollment.contract !== state.scope.contract) {
    throw new FoundryError('Scoped contract enrollment does not match its run');
  }
  const specification = await readBoundedText(root, state.spec);
  const contract = await readScopeContract(root, state.scope.contract);
  const spec = { path: state.spec, sha256: digest(specification.bytes) };
  const contractRef = { path: state.scope.contract, sha256: digest(contract.bytes) };
  const settings = checks.map(({ name, command, cwd, timeout, required, inputs, environment, test_report }) => ({
    name, command, cwd, timeout, required, inputs, environment, ...(test_report === undefined ? {} : { test_report }),
  }));
  const specialists = contract.value.plan ? await planPolicies(root, contract.value.plan) : undefined;
  const revision = digest(canonicalJson({ schema_version: 1, run_id: state.run_id, spec, contract: contractRef, checks: settings,
    ...(specialists ? { specialists } : {}) }));
  const blockers: string[] = [];
  const configured = new Map(checks.map(check => [check.name, check]));
  const criteria = contract.value.criteria.map(criterion => {
    const mapped = criterion.checks.length > 0 && criterion.checks.every(name => configured.get(name)?.required === true);
    if (!mapped) blockers.push(`${criterion.id}: map this criterion to configured required checks.`);
    return { ...criterion, mapped };
  });
  const approval: ScopeReview['approval'] = { status: 'pending', revision: null, approved_at: null, method: null, sha256: null };
  if (await exists(root, approvalPath(state))) {
    try {
      const bytes = await readBoundedText(root, approvalPath(state), 16 * 1024);
      approval.sha256 = digest(bytes.bytes);
      const record = approvalSchema.parse(JSON.parse(bytes.text));
      approval.revision = record.revision;
      approval.approved_at = record.approved_at;
      approval.method = record.method;
      approval.status = approval.sha256 !== state.scope.approval_sha256
        || record.run_id !== state.run_id || record.spec !== state.spec || record.contract !== state.scope.contract
        ? 'invalid' : record.revision === revision ? 'current' : 'stale';
    } catch {
      approval.status = 'invalid';
    }
  }
  if (approval.status !== 'current') {
    blockers.push(approval.status === 'pending' ? 'Review and approve this scope before verification.'
      : approval.status === 'stale' ? 'The specification, criteria or check settings changed. Review and approve the new scope.'
        : 'The scope approval is invalid. Inspect the scope and explicitly approve its current revision.');
  }
  return {
    schema_version: 1, kind: 'scope_review', run_id: state.run_id, revision,
    ...(contract.value.plan ? { plan: contract.value.plan, specialists } : {}),
    spec: { ...spec, text: specification.text }, contract: contractRef, criteria, checks: settings, approval, blockers,
  };
}

export function assertScopeReady(scope: ScopeReview | null): void {
  if (scope?.blockers.length) throw new FoundryError(scope.blockers.join(' '));
}

export async function recordScopeApproval(root: string, state: RunState, scope: ScopeReview): Promise<string> {
  const record = approvalSchema.parse({
    schema_version: 1, run_id: state.run_id, spec: state.spec, contract: scope.contract.path,
    revision: scope.revision, approved_at: now(), method: 'manual_cli',
  });
  const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`);
  await atomicWrite(root, approvalPath(state), bytes);
  return digest(bytes);
}
