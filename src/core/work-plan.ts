import { z } from 'zod';
import { digest, FoundryError } from './fs.js';
import { readBoundedText } from './factory-contract.js';
import { loadRoles, type RolePolicy } from './roles.js';
import type { RunState } from './lifecycle.js';
import type { ScopeReview } from './scope.js';
import { inspectVisualReview, validateVisualReview, visualReviewSchema } from './work-visual.js';

const id = z.string().regex(/^[A-Z][A-Z0-9_-]{1,63}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const role = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
export const taskPlanSchema = z.object({
  planner_role: role.default('planner'),
  reviewer_role: role.default('quality-gate'),
  ui_builder_role: role.optional(),
  tasks: z.array(z.object({
    id, title: z.string().trim().min(1).max(300),
    instructions: z.string().trim().min(1).max(4000),
    role, criteria: z.array(id).min(1).max(200),
    depends_on: z.array(id).max(12),
  }).strict()).min(1).max(12),
}).strict().superRefine((plan, context) => {
  const seen = new Set<string>();
  for (const task of plan.tasks) {
    if (seen.has(task.id) || task.depends_on.some(dependency => !seen.has(dependency))
      || new Set(task.depends_on).size !== task.depends_on.length
      || new Set(task.criteria).size !== task.criteria.length) {
      context.addIssue({ code: 'custom', message: 'Use unique task IDs and criteria, with dependencies on earlier tasks only' });
    }
    seen.add(task.id);
  }
});
export type TaskPlan = z.infer<typeof taskPlanSchema>;

export const workReviewSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  visual: visualReviewSchema.optional(),
  criteria: z.array(z.object({
    id, assessment: z.enum(['met', 'gap', 'unverified']),
    observation: z.string().trim().min(1).max(2000),
  }).strict()).min(1).max(200),
  findings: z.array(z.object({
    criterion_id: id, message: z.string().trim().min(1).max(2000), blocking: z.boolean(),
  }).strict()).max(50),
}).strict().superRefine((report, context) => {
  if (new Set(report.criteria.map(criterion => criterion.id)).size !== report.criteria.length) {
    context.addIssue({ code: 'custom', message: 'Review criterion IDs must be unique' });
  }
  if (Buffer.byteLength(JSON.stringify(report)) > 128 * 1024) {
    context.addIssue({ code: 'custom', message: 'Review exceeds 128 KiB' });
  }
});
export type WorkReview = z.infer<typeof workReviewSchema>;

export const taskProgressSchema = z.object({
  scope_revision: hash,
  completed: z.array(z.object({
    id, receipt: z.string().min(1).max(1024), receipt_sha256: hash,
    completed_at: z.string().datetime(),
  }).strict()).max(12),
  review: z.object({
    path: z.string().regex(/^\.foundry\/state\/runs\/[a-f0-9-]{36}\/reviews\/[a-f0-9-]{36}\.json$/),
    sha256: hash, inputs_revision: hash, receipt_sha256: hash, approval_sha256: hash,
  }).strict().optional(),
}).strict().superRefine((progress, context) => {
  if (new Set(progress.completed.map(task => task.id)).size !== progress.completed.length) {
    context.addIssue({ code: 'custom', message: 'Completed task IDs must be unique' });
  }
});
export type TaskProgress = z.infer<typeof taskProgressSchema>;

export async function planPolicies(root: string, plan: TaskPlan): Promise<RolePolicy[]> {
  const roles = await loadRoles(root);
  const names = [...new Set([plan.planner_role, plan.reviewer_role, ...(plan.ui_builder_role ? [plan.ui_builder_role] : []), ...plan.tasks.map(task => task.role)])];
  const policies = names.map(name => {
    const policy = roles.find(candidate => candidate.name === name);
    if (!policy) throw new FoundryError(`Unknown specialist role: ${name}`);
    return policy;
  });
  if (policies.find(policy => policy.name === plan.reviewer_role)?.sandbox !== 'read-only') {
    throw new FoundryError('The reviewer role must be read-only');
  }
  if (plan.ui_builder_role && (policies.find(policy => policy.name === plan.ui_builder_role)?.sandbox !== 'workspace-write'
    || !plan.tasks.some(task => task.role === plan.ui_builder_role))) {
    throw new FoundryError('Assign UI work to the selected writable UI specialist');
  }
  for (const task of plan.tasks) {
    if (policies.find(policy => policy.name === task.role)?.sandbox !== 'workspace-write') {
      throw new FoundryError(`Builder ${task.role} must have workspace-write policy`);
    }
  }
  return policies;
}

export function validateReview(report: WorkReview, scope: ScopeReview): void {
  validateVisualReview(report.visual, scope.preparation?.design.report?.preview, scope.preparation?.design.record?.sha256);
  const ids = new Set(scope.criteria.map(criterion => criterion.id));
  if (report.criteria.length !== ids.size || report.criteria.some(criterion => !ids.has(criterion.id))
    || report.findings.some(finding => !ids.has(finding.criterion_id))) {
    throw new FoundryError('Review every approved criterion exactly once; findings must name approved criteria');
  }
}

export function progressFor(state: RunState, scope: ScopeReview): TaskProgress {
  const progress = state.task_progress;
  if (!progress || progress.scope_revision !== scope.revision) {
    return { scope_revision: scope.revision, completed: [] };
  }
  if (progress.completed.some(task => !scope.plan?.tasks.some(candidate => candidate.id === task.id))) {
    throw new FoundryError('Saved task progress does not match the approved plan');
  }
  const done = new Set(progress.completed.map(task => task.id));
  if (scope.plan?.tasks.some(task => done.has(task.id) && task.depends_on.some(dependency => !done.has(dependency)))) {
    throw new FoundryError('Saved task dependencies are not satisfied');
  }
  return progress;
}

export async function plannedWork(root: string, state: RunState, scope: ScopeReview | null,
  inputsRevision: string, receiptSha256: string | null, evidenceCurrent: boolean) {
  if (!scope?.plan) return null;
  const progress = progressFor(state, scope);
  const tasks = scope.plan.tasks.map(task => ({
    ...task, status: progress.completed.some(done => done.id === task.id) ? 'done' as const : 'pending' as const,
    evidence: progress.completed.find(done => done.id === task.id) ?? null,
  }));
  const nextTask = tasks.find(task => task.status === 'pending'
    && task.depends_on.every(dependency => tasks.some(prior => prior.id === dependency && prior.status === 'done')));
  let report: WorkReview | null = null;
  let reviewStatus: 'missing' | 'invalid' | 'stale' | 'blocked' | 'current' = 'missing';
  if (progress.review) {
    try {
      if (!progress.review.path.startsWith(`.foundry/state/runs/${state.run_id}/reviews/`)) {
        throw new FoundryError('Review belongs to another run');
      }
      const bytes = await readBoundedText(root, progress.review.path, 128 * 1024);
      if (digest(bytes.bytes) !== progress.review.sha256) throw new FoundryError('Review record changed');
      report = workReviewSchema.parse(JSON.parse(bytes.text));
      validateReview(report, scope);
      if (report.visual) await inspectVisualReview(root, progress.review.path.slice(0, -'.json'.length), report.visual);
      reviewStatus = !evidenceCurrent || scope.approval.status !== 'current'
        || progress.review.approval_sha256 !== scope.approval.sha256
        || progress.review.inputs_revision !== inputsRevision || progress.review.receipt_sha256 !== receiptSha256
        || tasks.some(task => task.status !== 'done') ? 'stale'
        : report.criteria.some(criterion => criterion.assessment !== 'met') || report.findings.some(finding => finding.blocking)
          || report.visual?.comparisons.some(comparison => comparison.assessment !== 'met')
          ? 'blocked' : 'current';
    } catch { reviewStatus = 'invalid'; }
  }
  return { revision: scope.revision, planner_role: scope.plan.planner_role, reviewer_role: scope.plan.reviewer_role,
    ui_builder_role: scope.plan.ui_builder_role ?? null,
    tasks, next_task: nextTask?.id ?? null, review: { status: reviewStatus, report, record: progress.review?.path ?? null,
      attribution: 'host_reported' as const } };
}

export type PlannedWork = Awaited<ReturnType<typeof plannedWork>>;

export function assertPlanComplete(plan: PlannedWork): void {
  if (!plan) return;
  if (plan.tasks.some(task => task.status !== 'done')) throw new FoundryError('Finish every approved task before completion');
  if (plan.review.status !== 'current') throw new FoundryError(`Completion needs a current nonblocking specialist review (${plan.review.status})`);
}

export function renderPlanHandoff(plan: PlannedWork): string {
  if (!plan) return '';
  const visual = plan.review.report?.visual;
  return `\n## Tasks\n\n${plan.tasks.map(task => `- ${task.id}: ${task.title} (${task.role}; ${task.criteria.join(', ')})`).join('\n')}\n\n## Host-reported specialist review\n\n${plan.review.report?.summary ?? 'Not recorded'}\n\n${plan.review.report?.criteria.map(criterion => `- ${criterion.id}: ${criterion.assessment} — ${criterion.observation}`).join('\n')}\n\n${plan.review.report?.findings.map(finding => `- ${finding.criterion_id}: ${finding.message} (${finding.blocking ? 'blocking' : 'nonblocking'})`).join('\n')}\n\nReview record: ${plan.review.record}\n${visual ? `\n### Visual comparison\n\nDesign: ${visual.design_sha256}\n\n${visual.summary}\n\n${visual.comparisons.map(image => `- ${image.screen}/${image.state} ${image.width}x${image.height}: ${image.assessment} - ${image.observation}; ${image.path} (sha256 ${image.sha256})`).join('\n')}\n` : ''}`;
}
