import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvedCriteria, validateReview, type ReviewContext } from '../../src/core/review.js';

const context: ReviewContext = {
  plan_revision: '1'.repeat(64),
  workspace_revision: '2'.repeat(64),
  criteria: [
    { id: 'AC-001', expected: 'The local command completes' },
    { id: 'AC-002', expected: 'The saved result is readable' },
  ],
};
const evidence = new Map([
  ['tests/one.txt', 'a'.repeat(64)],
  ['tests/two.txt', 'b'.repeat(64)],
]);

test('approved plans have one acceptance section with distinct explicit criteria', () => {
  const criteria = '## Acceptance criteria\n- [AC-001] The command completes';
  assert.deepEqual(approvedCriteria(criteria), [{ id: 'AC-001', expected: 'The command completes' }]);
  assert.throws(() => approvedCriteria('## Acceptance criteria\n## Notes\nText\n' + criteria), /multiple acceptance sections/);
  assert.throws(() => approvedCriteria(criteria + '\n- [AC-001] Another requirement'), /Duplicate criterion/);
  assert.throws(() => approvedCriteria('## Acceptance criteria\n- Unnumbered requirement'), /one - \[AC-001\]/);
  assert.throws(() => approvedCriteria('## Acceptance criteria\n## Notes'), /1 to 200/);
});

function result(): Record<string, unknown> {
  return {
    schema_version: 1,
    plan_revision: context.plan_revision,
    workspace_revision: context.workspace_revision,
    criteria: context.criteria.map((criterion, index) => ({
      id: criterion.id,
      status: 'pass',
      observation: `Observed ${criterion.id}`,
      evidence: [{ path: index === 0 ? 'tests/one.txt' : 'tests/two.txt', sha256: index === 0 ? 'a'.repeat(64) : 'b'.repeat(64) }],
    })),
    blockers: [],
  };
}

test('review gate accepts exact fresh coverage and rejects unverified outcomes, coverage errors, stale evidence and blockers', () => {
  assert.equal(validateReview(result(), context, evidence).criteria.length, 2);
  const failed = result() as { criteria: Array<Record<string, unknown>> };
  failed.criteria[0] = { ...failed.criteria[0], status: 'fail' };
  assert.throws(() => validateReview(failed, context, evidence), /Criterion AC-001 is fail/);
  const unverified = result() as { criteria: Array<Record<string, unknown>> };
  unverified.criteria[0] = { ...unverified.criteria[0], status: 'unverified' };
  assert.throws(() => validateReview(unverified, context, evidence), /Criterion AC-001 is unverified/);
  const missing = result() as { criteria: Array<Record<string, unknown>> };
  missing.criteria.pop();
  assert.throws(() => validateReview(missing, context, evidence), /exactly once/);
  const duplicate = result() as { criteria: Array<Record<string, unknown>> };
  duplicate.criteria[1] = duplicate.criteria[0]!;
  assert.throws(() => validateReview(duplicate, context, evidence), /exactly once/);
  const stale = result() as { plan_revision: string };
  stale.plan_revision = '3'.repeat(64);
  assert.throws(() => validateReview(stale, context, evidence), /does not match/);
  const changed = result() as { criteria: Array<{ evidence: Array<{ path: string; sha256: string }> }> };
  changed.criteria[0]!.evidence[0]!.sha256 = 'f'.repeat(64);
  assert.throws(() => validateReview(changed, context, evidence), /Missing or changed/);
  const unsafe = result() as { criteria: Array<{ evidence: Array<{ path: string; sha256: string }> }> };
  unsafe.criteria[0]!.evidence[0]!.path = '../secret.txt';
  assert.throws(() => validateReview(unsafe, context, evidence), /safe project-relative/);
  const blocked = result() as { blockers: string[] };
  blocked.blockers.push('A blocking issue remains');
  assert.throws(() => validateReview(blocked, context, evidence), /blocking findings/);
});
