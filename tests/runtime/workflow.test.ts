import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { digest } from '../../src/core/fs.js';
import { context, gate, guide, record } from '../../src/core/workflow.js';

async function project(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-workflow-'));
  await mkdir(path.join(root, '.foundry'), { recursive: true });
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'fixture', checks: [] }));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1, runtime: 'typescript', runtime_version: '1',
    installed_at: new Date().toISOString(), source_pin: 'b'.repeat(64),
  }));
  await writeFile(path.join(root, 'input.txt'), 'input\n');
  await writeFile(path.join(root, 'log.txt'), 'passed\n');
  const inputRevision = digest(await readFile(path.join(root, 'input.txt')));
  const receipt = {
    command: ['node', 'fixture'], status: 'passed', exit_code: 0,
    input_revisions: { 'input.txt': inputRevision }, input_revisions_after: { 'input.txt': inputRevision },
    log: 'log.txt', log_sha256: digest(await readFile(path.join(root, 'log.txt'))),
  };
  await writeFile(path.join(root, 'receipt.json'), JSON.stringify(receipt));
  return root;
}

function source(): Record<string, unknown> {
  return { kind: 'owner', ref: 'owner', observed_at: new Date().toISOString() };
}

test('workflow gate requires exact fresh command evidence', async () => {
  const root = await project();
  await record(root, {
    id: 'criterion-1', kind: 'criterion', title: 'Behavior', source: source(),
    basis: 'observed', status: 'accepted', stage: 'verify', required: true,
    expected: 'passes', method: 'command', command: ['node', 'fixture'], inputs: ['input.txt'],
  });
  await record(root, {
    id: 'evidence-1', kind: 'evidence', title: 'Observed behavior', source: source(),
    basis: 'observed', status: 'accepted', claim: 'Behavior passed', artifact: 'receipt.json',
    method: 'command', outcome: 'pass', observed: 'fixture', criteria: ['criterion-1'],
  });
  assert.equal((await gate(root, 'verify')).status, 'pass');
  await writeFile(path.join(root, 'receipt.json'), '{"changed":true}\n');
  assert.equal((await gate(root, 'verify')).status, 'unverified');
});

test('workflow record refuses stale references', async () => {
  const root = await project();
  await record(root, {
    id: 'criterion-1', kind: 'criterion', title: 'Input behavior', source: source(),
    basis: 'observed', status: 'accepted', stage: 'verify', required: true,
    expected: 'input is current', method: 'manual', inputs: ['input.txt'],
  });
  await record(root, {
    id: 'artifact-1', kind: 'artifact', title: 'Input contract', source: source(),
    basis: 'observed', status: 'accepted', path: 'input.txt', stage: 'verify',
    owner: 'owner', next_action: 'reconcile', criteria: ['criterion-1'],
  });
  await writeFile(path.join(root, 'input.txt'), 'changed\n');
  await assert.rejects(record(root, {
    id: 'decision-1', kind: 'decision', title: 'Refresh decision', source: source(),
    basis: 'observed', status: 'accepted', accepted_by: 'owner', acceptance_ref: 'fixture',
    rationale: 'The referenced artifact must be refreshed',
    references: ['artifact-1'],
  }), /Reference artifact-1 is stale; refresh it first/);
});

test('workflow gate requires receipts to cover declared contract revisions', async () => {
  const root = await project();
  await record(root, {
    id: 'criterion-1', kind: 'criterion', title: 'Behavior', source: source(),
    basis: 'observed', status: 'accepted', stage: 'verify', required: true,
    expected: 'passes', method: 'command', command: ['node', 'fixture'], inputs: ['input.txt'],
  });
  await writeFile(path.join(root, 'receipt.json'), JSON.stringify({
    command: ['node', 'fixture'], status: 'passed', exit_code: 0,
    input_revisions: {}, input_revisions_after: {}, log: 'log.txt',
    log_sha256: digest(await readFile(path.join(root, 'log.txt'))),
  }));
  await record(root, {
    id: 'evidence-1', kind: 'evidence', title: 'Observed behavior', source: source(),
    basis: 'observed', status: 'accepted', claim: 'Behavior passed', artifact: 'receipt.json',
    method: 'command', outcome: 'pass', observed: 'fixture', criteria: ['criterion-1'],
  });
  const result = await gate(root, 'verify');
  assert.equal(result.status, 'unverified');
});

test('workflow rejects missing record IDs, duplicate list entries, and unsafe paths', async () => {
  const root = await project();
  const criterion = {
    id: 'criterion-1', kind: 'criterion', title: 'Behavior', source: source(),
    basis: 'observed', status: 'accepted', stage: 'verify', required: true,
    expected: 'passes', method: 'manual', inputs: ['input.txt'],
  };
  await assert.rejects(record(root, { ...criterion, id: 'criterion-bad', references: ['missing-record'] }), /Unknown reference/);
  await assert.rejects(record(root, { ...criterion, id: 'criterion-duplicate', inputs: ['input.txt', 'input.txt'] }), /unique nonempty strings/);
  await assert.rejects(record(root, { ...criterion, id: 'criterion-unsafe', inputs: ['../outside.txt'] }), /project-relative|traversal|escape|inside the project/i);
  await assert.rejects(record(root, { ...criterion, id: 'criterion-bad-date', source: { ...source(), observed_at: '2025-02-30' } }), /Invalid source\.observed_at/);
});

test('workflow gate returns unverified for missing coverage and stale evidence', async () => {
  const root = await project();
  await record(root, {
    id: 'criterion-1', kind: 'criterion', title: 'Behavior', source: source(),
    basis: 'observed', status: 'accepted', stage: 'verify', required: true,
    expected: 'passes', method: 'manual', inputs: ['input.txt'],
  });
  assert.equal((await gate(root, 'verify')).status, 'unverified');
  await record(root, {
    id: 'evidence-1', kind: 'evidence', title: 'Observed behavior', source: source(),
    basis: 'observed', status: 'accepted', claim: 'Behavior passed', artifact: 'input.txt',
    method: 'manual', outcome: 'pass', observed: 'fixture', criteria: ['criterion-1'],
  });
  assert.equal((await gate(root, 'verify')).status, 'pass');
  await writeFile(path.join(root, 'input.txt'), 'changed\n');
  const result = await gate(root, 'verify');
  assert.equal(result.status, 'unverified');
  const records = (await context(root)).records as Record<string, unknown>[];
  assert.equal(records.find((item) => item.id === 'evidence-1')?.freshness, 'stale');
});

test('a fresh observed failure blocks a passing observation for the same criterion', async () => {
  const root = await project();
  await record(root, {
    id: 'criterion-1', kind: 'criterion', title: 'Behavior', source: source(),
    basis: 'observed', status: 'accepted', stage: 'verify', required: true,
    expected: 'passes', method: 'manual', inputs: ['input.txt'],
  });
  for (const [id, outcome] of [['evidence-fail', 'fail'], ['evidence-pass', 'pass']]) {
    await record(root, {
      id, kind: 'evidence', title: `Observed ${outcome}`, source: source(),
      basis: 'observed', status: 'accepted', claim: 'Behavior observation', artifact: 'input.txt',
      method: 'manual', outcome, observed: outcome, criteria: ['criterion-1'],
    });
  }
  const result = await gate(root, 'verify');
  assert.equal(result.status, 'fail');
  assert.equal((result.criteria as Record<string, unknown>[])[0]?.status, 'fail');
});

test('workflow guide recommends adaptive paths and reports capability blockers', async () => {
  const root = await project();
  const result = await guide(root, 'Build a booking site', 'implement', 'product', 'web', ['browser automation'], []);
  assert.deepEqual((result.path as Record<string, unknown>[]).map((item) => item.stage), [
    'research', 'opportunity', 'scope', 'flows', 'prototype', 'design', 'build', 'verify', 'release', 'learn',
  ]);
  assert.equal((result.next as Record<string, unknown>).stage, 'research');
  assert.equal((result.user_needed as Record<string, unknown>[])[0]?.capability, 'browser automation');
  const defaultGuide = await guide(root);
  assert.equal((defaultGuide.current as Record<string, unknown>).intent, 'plan');
  assert.deepEqual((defaultGuide.path as Record<string, unknown>[]).map((item) => item.stage), ['scope', 'build', 'verify']);
});
