import { z } from 'zod';

export const criterionSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Z0-9_-]{1,63}$/),
  expected: z.string().trim().min(1).max(10_000),
}).strict();
export type ApprovedCriterion = z.infer<typeof criterionSchema>;

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const reviewSchema = z.object({
  schema_version: z.literal(1),
  plan_revision: digest,
  workspace_revision: digest,
  criteria: z.array(z.object({
    id: criterionSchema.shape.id,
    status: z.enum(['pass', 'fail', 'unverified']),
    observation: z.string().trim().min(1).max(10_000),
    evidence: z.array(z.object({
      path: z.string().min(1).max(1024),
      sha256: digest,
    }).strict()).max(100),
  }).strict()).min(1).max(200),
  blockers: z.array(z.string().trim().min(1).max(10_000)).max(100),
}).strict();
export type ReviewResult = z.infer<typeof reviewSchema>;

export interface ReviewContext {
  plan_revision: string;
  workspace_revision: string;
  criteria: readonly ApprovedCriterion[];
}

export function approvedCriteria(plan: string): ApprovedCriterion[] {
  const result: ApprovedCriterion[] = [];
  let inSection = false;
  let sections = 0;
  for (const line of plan.split(/\r?\n/)) {
    if (/^##\s+Acceptance criteria\s*$/i.test(line)) {
      if (++sections > 1) throw new Error('Plan has multiple acceptance sections');
      inSection = true;
      continue;
    }
    if (/^#{1,2}\s/.test(line)) inSection = false;
    if (!inSection || !line.trim()) continue;
    const match = /^- \[([A-Z][A-Z0-9_-]{1,63})\] (.+)$/.exec(line);
    if (!match) throw new Error('Use one - [AC-001] observable criterion per line in Acceptance criteria');
    const item = criterionSchema.parse({ id: match[1], expected: match[2] });
    if (result.some((previous) => previous.id === item.id)) throw new Error(`Duplicate criterion: ${item.id}`);
    result.push(item);
  }
  if (result.length === 0 || result.length > 200) throw new Error('Plan needs 1 to 200 explicit acceptance criteria');
  return result;
}

/** Evidence digests are supplied by the controller after safe filesystem reads. */
export function validateReview(
  input: unknown,
  context: ReviewContext,
  evidenceDigests: ReadonlyMap<string, string>,
): ReviewResult {
  const review = reviewSchema.parse(input);
  const expected = context.criteria.map((criterion) => criterionSchema.parse(criterion).id);
  if (!expected.length || new Set(expected).size !== expected.length) throw new Error('Invalid approved criteria');
  if (review.plan_revision !== context.plan_revision || review.workspace_revision !== context.workspace_revision) {
    throw new Error('Review does not match the approved plan and tested workspace');
  }
  const actual = review.criteria.map((criterion) => criterion.id);
  if (actual.length !== expected.length || new Set(actual).size !== actual.length || actual.some((id) => !expected.includes(id))) {
    throw new Error('Review must cover every approved criterion exactly once');
  }
  for (const criterion of review.criteria) {
    if (criterion.status !== 'pass') throw new Error(`Criterion ${criterion.id} is ${criterion.status}`);
    if (!criterion.evidence.length) throw new Error(`Criterion ${criterion.id} has no evidence`);
    for (const evidence of criterion.evidence) {
      const parts = evidence.path.split('/');
      if (evidence.path.includes('\\') || evidence.path.includes('\0') || parts.some((part) => !part || part === '.' || part === '..')
          || /^[a-zA-Z]:/.test(evidence.path) || parts.includes('.git')) {
        throw new Error('Review evidence must be a safe project-relative file');
      }
      if (evidenceDigests.get(evidence.path) !== evidence.sha256) throw new Error(`Missing or changed review evidence: ${evidence.path}`);
    }
  }
  if (review.blockers.length) throw new Error(`Review has blocking findings: ${review.blockers.join('; ')}`);
  return review;
}
