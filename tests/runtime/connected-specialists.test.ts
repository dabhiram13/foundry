import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { approveScope, complete, finishTask, pauseOrResume, prepareAssignment, recordWorkReview,
  recover, reviewScope, saveTaskPlan, start, verify, workContext, type WorkContext } from '../../src/core/lifecycle.js';
import { taskPlanSchema, type TaskPlan, type WorkReview } from '../../src/core/work-plan.js';
import { atomicJson, digest } from '../../src/core/fs.js';
import { renderScopeReview } from '../../src/cli/output.js';

const executable = path.resolve('dist/runtime/foundry.cjs');
const plan: TaskPlan = { planner_role: 'planner', reviewer_role: 'quality-gate', tasks: [
  { id: 'TASK-01', title: 'Build service', instructions: 'Implement the bounded service.', role: 'backend', criteria: ['CS-01'], depends_on: [] },
  { id: 'TASK-02', title: 'Build interface', instructions: 'Use the service in the interface.', role: 'ts-expert', criteria: ['CS-02'], depends_on: ['TASK-01'] },
] };
const report: WorkReview = { summary: 'Compared the implementation with both requirements.', criteria: [
  { id: 'CS-01', assessment: 'met', observation: 'Service behavior exercised by the fixture.' },
  { id: 'CS-02', assessment: 'met', observation: 'Interface behavior exercised by the fixture.' },
], findings: [] };

async function project(t: TestContext, begin = true): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-specialists-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({ schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: 'fixture', source_pin: 'a'.repeat(64) }));
  await writeFile(path.join(root, '.foundry/roles.json'), await readFile('.foundry/roles.json'));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'fixture', checks: [{ name: 'behavior', command: [process.execPath, '-e', "process.exit(require('node:fs').readFileSync('source.ts','utf8').includes('broken') ? 1 : 0)"], inputs: ['source.ts'], required: true }] }));
  await writeFile(path.join(root, 'source.ts'), 'initial');
  await writeFile(path.join(root, 'spec.md'), '# Scope\nService and interface.');
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ schema_version: 1, criteria: [
    { id: 'CS-01', requirement: 'Service works', checks: ['behavior'] },
    { id: 'CS-02', requirement: 'Interface works', checks: ['behavior'] },
  ] }));
  if (begin) await start(root, 'feature', 'spec.md', 'scope.json');
  return root;
}
async function approve(root: string) { await approveScope(root, (await reviewScope(root)).revision); }
async function setup(t: TestContext) {
  const root = await project(t);
  await saveTaskPlan(root, plan, (await workContext(root)).snapshot_revision);
  await approve(root);
  return root;
}
async function done(root: string) {
  for (const task of plan.tasks) {
    await writeFile(path.join(root, 'source.ts'), task.id);
    assert.equal(await verify(root), 0);
    await finishTask(root, task.id, (await workContext(root)).snapshot_revision);
  }
}
async function files(root: string) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return Object.fromEntries(await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => {
    const full = path.join(entry.parentPath, entry.name);
    return [path.relative(root, full), digest(await readFile(full))];
  })));
}

test('planner assignment is read-only, provider-neutral and uses actual catalog instructions', async t => {
  const root = await project(t);
  const before = await files(root);
  const assignment = await prepareAssignment(root, 'planner');
  assert.equal(assignment.execution, 'host_client');
  assert.equal(assignment.requested_permissions, 'read-only');
  assert.equal(assignment.role.name, 'planner');
  assert.match(assignment.instructions, /bounded ordered task plan/);
  assert.ok(assignment.instructions.includes(assignment.role.instructions));
  assert.ok(assignment.output_schema);
  assert.deepEqual(await files(root), before);
  await assert.rejects(prepareAssignment(root, 'builder'), /approve/);
  await saveTaskPlan(root, plan, assignment.snapshot_revision);
  assert.equal((await workContext(root)).plan?.tasks[0]?.id, 'TASK-01');
  const review = renderScopeReview(await reviewScope(root));
  assert.match(review, /TASK-02/);
  assert.match(review, /Selected specialist policies/);
});

test('plan schemas reject duplicates, unknown criteria, roles, permissions, cycles and oversized tasks without writes', async t => {
  const root = await project(t);
  const variants = [
    { ...plan, tasks: [plan.tasks[0]!, plan.tasks[0]!] },
    { ...plan, tasks: [{ ...plan.tasks[0]!, depends_on: ['TASK-02'] }, plan.tasks[1]!] },
    { ...plan, tasks: [{ ...plan.tasks[0]!, criteria: ['UNKNOWN'] }, plan.tasks[1]!] },
    { ...plan, tasks: [plan.tasks[0]!] },
    { ...plan, tasks: [{ ...plan.tasks[0]!, role: 'unknown' }, plan.tasks[1]!] },
    { ...plan, reviewer_role: 'backend' },
    { ...plan, tasks: [{ ...plan.tasks[0]!, role: 'quality-gate' }, plan.tasks[1]!] },
    { ...plan, tasks: [{ ...plan.tasks[0]!, instructions: 'x'.repeat(4001) }, plan.tasks[1]!] },
    { ...plan, approve: true },
    { ...plan, tasks: Array.from({ length: 13 }, (_, index) => ({ ...plan.tasks[0]!, id: `TASK-${index + 1}` })) },
  ];
  const before = await files(root);
  for (const invalid of variants) {
    await assert.rejects(saveTaskPlan(root, invalid, (await workContext(root)).snapshot_revision));
    assert.deepEqual(await files(root), before);
  }
  assert.equal(taskPlanSchema.safeParse({ ...plan, tasks: [] }).success, false);
});

test('a contract with unknown or unsafe specialist roles cannot enroll a new run', async t => {
  const root = await project(t, false);
  const scope = JSON.parse(await readFile(path.join(root, 'scope.json'), 'utf8')) as Record<string, unknown>;
  for (const invalid of [{ ...plan, reviewer_role: 'backend' }, { ...plan, planner_role: 'missing-role' }]) {
    await writeFile(path.join(root, 'scope.json'), JSON.stringify({ ...scope, plan: invalid }));
    const before = await files(root);
    await assert.rejects(start(root, 'invalid', 'spec.md', 'scope.json'));
    assert.deepEqual(await files(root), before);
  }
  assert.equal((await workContext(root)).run, null);
});

test('plan and selected role edits invalidate exact approval, progress and client snapshots', async t => {
  const root = await setup(t);
  const old = await workContext(root);
  await writeFile(path.join(root, 'source.ts'), 'changed');
  await assert.rejects(saveTaskPlan(root, plan, old.snapshot_revision), /stale/);
  await assert.rejects(finishTask(root, 'TASK-01', old.snapshot_revision), /stale/);
  assert.equal(await verify(root), 0);
  await finishTask(root, 'TASK-01');
  const rolesPath = path.join(root, '.foundry/roles.json');
  const roles = JSON.parse(await readFile(rolesPath, 'utf8')) as { roles: Array<{ name: string; instructions: string }> };
  roles.roles.find(role => role.name === 'backend')!.instructions += '\nNew bounded policy.';
  await writeFile(rolesPath, JSON.stringify(roles));
  const changed = await workContext(root);
  assert.equal(changed.scope_approval, 'stale');
  assert.equal(changed.plan?.tasks[0]?.status, 'pending');
  await assert.rejects(verify(root), /approve/);
  await approve(root);
  const previous = await reviewScope(root);
  await saveTaskPlan(root, { ...plan, tasks: [{ ...plan.tasks[0]!, title: 'Revised service' }, plan.tasks[1]!] });
  assert.equal((await workContext(root)).scope_approval, 'stale');
  await assert.rejects(approveScope(root, previous.revision), /changed/);
});

test('builder tasks require fresh passing checks and dependencies; final handoff requires reviewer findings', async t => {
  const root = await setup(t);
  const builder = await prepareAssignment(root, 'builder');
  assert.equal(builder.role.name, 'backend');
  assert.equal(builder.task?.id, 'TASK-01');
  assert.equal(builder.scope.approval.status, 'current');
  await assert.rejects(finishTask(root, 'TASK-01'), /passing checks/);
  await writeFile(path.join(root, 'source.ts'), 'broken');
  assert.equal(await verify(root), 1);
  assert.equal((await workContext(root)).evidence.status, 'failed');
  await assert.rejects(finishTask(root, 'TASK-01'), /passing checks/);
  await writeFile(path.join(root, 'source.ts'), 'fixed');
  assert.equal(await verify(root), 0);
  await assert.rejects(finishTask(root, 'TASK-02'), /dependency/);
  await finishTask(root, 'TASK-01');
  assert.equal((await prepareAssignment(root, 'builder')).role.name, 'ts-expert');
  await assert.rejects(complete(root), /every approved task/);
  await assert.rejects(prepareAssignment(root, 'reviewer'), /every task done/);
  await writeFile(path.join(root, 'source.ts'), 'interface');
  await assert.rejects(finishTask(root, 'TASK-02'), /passing checks/);
  assert.equal(await verify(root), 0);
  await finishTask(root, 'TASK-02');
  await assert.rejects(complete(root), /specialist review/);
  const reviewAssignment = await prepareAssignment(root, 'reviewer');
  assert.equal(reviewAssignment.role.name, 'quality-gate');
  assert.equal(reviewAssignment.requested_permissions, 'read-only');
  assert.equal(reviewAssignment.plan?.tasks[0]?.evidence?.receipt_sha256.length, 64);
  const before = await files(root);
  await assert.rejects(recordWorkReview(root, { ...report, criteria: [report.criteria[0]!] }), /every approved criterion/);
  await assert.rejects(recordWorkReview(root, { ...report, criteria: [report.criteria[0]!, report.criteria[0]!] }), /unique/);
  await assert.rejects(recordWorkReview(root, { ...report, findings: [{ criterion_id: 'UNKNOWN', message: 'Unknown requirement', blocking: true }] }), /approved criteria/);
  assert.deepEqual(await files(root), before);
  const failed: WorkReview = { ...report, criteria: [{ ...report.criteria[0]!, assessment: 'unverified' }, report.criteria[1]!] };
  await recordWorkReview(root, failed);
  const failedRecord = (await workContext(root)).plan!.review.record!;
  assert.equal((await workContext(root)).plan?.review.status, 'blocked');
  await assert.rejects(complete(root), /blocked/);
  await recordWorkReview(root, { ...report, findings: [{ criterion_id: 'CS-02', message: 'Missing error handling', blocking: true }] });
  await assert.rejects(complete(root), /blocked/);
  await recordWorkReview(root, report);
  assert.match(await readFile(path.join(root, failedRecord), 'utf8'), /unverified/);
  assert.equal((await workContext(root)).plan?.review.status, 'current');
  assert.equal(await complete(root), 0);
  const completed = await workContext(root);
  assert.equal(completed.run?.historical, true);
  assert.equal(completed.next_action.kind, 'none');
  const pointer = JSON.parse(await readFile(path.join(root, '.foundry/state/last-completed.json'), 'utf8')) as { state: string };
  const state = JSON.parse(await readFile(path.join(root, pointer.state), 'utf8')) as { completion: { path: string } };
  const handoff = await readFile(path.join(root, state.completion.path), 'utf8');
  assert.match(handoff, /TASK-02/);
  assert.match(handoff, /Host-reported specialist review/);
});

test('source changes, new receipts, renewed approval and altered review records invalidate final review', async t => {
  const root = await setup(t);
  await done(root);
  await recordWorkReview(root, report);
  const before = await workContext(root);
  await writeFile(path.join(root, 'source.ts'), 'later change');
  await assert.rejects(recordWorkReview(root, report, before.snapshot_revision), /stale/);
  assert.equal((await workContext(root)).plan?.review.status, 'stale');
  assert.equal(await verify(root), 0);
  await assert.rejects(complete(root), /stale/);
  await recordWorkReview(root, report);
  assert.equal(await verify(root), 0);
  assert.equal((await workContext(root)).plan?.review.status, 'stale');
  await recordWorkReview(root, report);
  await approve(root);
  assert.equal((await workContext(root)).plan?.review.status, 'stale');
  await recordWorkReview(root, report);
  const record = (await workContext(root)).plan!.review.record!;
  await writeFile(path.join(root, record), JSON.stringify({ ...report, summary: 'Tampered' }));
  assert.equal((await workContext(root)).plan?.review.status, 'invalid');
  await assert.rejects(complete(root), /invalid/);
});

test('pause, resume and interrupted check recovery preserve task history but never manufacture evidence', async t => {
  const root = await setup(t);
  assert.equal(await verify(root), 0);
  await finishTask(root, 'TASK-01');
  const original = await workContext(root);
  await pauseOrResume(root, true);
  await assert.rejects(prepareAssignment(root, 'builder'), /Resume/);
  await pauseOrResume(root, false);
  assert.equal((await workContext(root)).plan?.tasks[0]?.status, 'done');
  await assert.rejects(finishTask(root, 'TASK-02'), /passing checks/);
  assert.equal(await verify(root), 0);
  const statePath = `.foundry/state/runs/${original.run!.id}/state.json`;
  const state = JSON.parse(await readFile(path.join(root, statePath), 'utf8')) as Record<string, unknown>;
  await atomicJson(root, statePath, { ...state, status: 'verifying' });
  await recover(root);
  const recovered = await workContext(root);
  assert.equal(recovered.run?.saved_status, 'paused');
  assert.equal(recovered.plan?.tasks[0]?.status, 'done');
  assert.equal(recovered.evidence.status, 'invalid');
  await pauseOrResume(root, false);
  await assert.rejects(finishTask(root, 'TASK-02'), /passing checks/);
  assert.equal(await verify(root), 0);
  await finishTask(root, 'TASK-02');
});

async function connection(t: TestContext, root: string) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [executable, 'mcp', '--project', root], stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += String(chunk); });
  const client = new Client({ name: 'specialist-fixture', version: '1' });
  await client.connect(transport);
  t.after(async () => { await client.close(); assert.equal(stderr, ''); });
  return client;
}
async function call(client: Client, name: string, input: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: input });
  assert.equal(result.isError, false, JSON.stringify(result));
  return result.structuredContent as unknown as WorkContext;
}

test('real stdio clients continue specialist tasks with terminal approval and no model tools', async t => {
  const root = await project(t);
  const first = await connection(t, root);
  const roles = await first.callTool({ name: 'foundry_specialists', arguments: {} });
  assert.equal((roles.structuredContent as { roles: unknown[] }).roles.length, 28);
  const assignment = await first.callTool({ name: 'foundry_assignment', arguments: { stage: 'planner' } });
  assert.equal(assignment.isError, false);
  const initial = await call(first, 'foundry_context');
  await call(first, 'foundry_save_plan', { plan, snapshot_revision: initial.snapshot_revision });
  const revision = (await reviewScope(root)).revision;
  const approved = spawnSync(process.execPath, [executable, 'work', 'approve', '--revision', revision, '--project', root, '--json'], { encoding: 'utf8' });
  assert.equal(approved.status, 0, approved.stderr);
  await call(first, 'foundry_assignment', { stage: 'builder' });
  await call(first, 'foundry_verify', { snapshot_revision: (await call(first, 'foundry_context')).snapshot_revision });
  await call(first, 'foundry_task_done', { task_id: 'TASK-01', snapshot_revision: (await call(first, 'foundry_context')).snapshot_revision });
  await first.close();
  const second = await connection(t, root);
  const continued = await call(second, 'foundry_context');
  assert.equal(continued.run?.id, initial.run?.id);
  assert.equal(continued.plan?.next_task, 'TASK-02');
  await writeFile(path.join(root, 'source.ts'), 'second task');
  const stale = await second.callTool({ name: 'foundry_task_done', arguments: { task_id: 'TASK-02', snapshot_revision: continued.snapshot_revision } });
  assert.equal(stale.isError, true);
  await call(second, 'foundry_verify', { snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  await call(second, 'foundry_task_done', { task_id: 'TASK-02', snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  await call(second, 'foundry_assignment', { stage: 'reviewer' });
  await call(second, 'foundry_record_review', { report, snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  await call(second, 'foundry_complete', { snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  const tools = await second.listTools();
  assert.equal(tools.tools.length, 13);
  assert.ok(tools.tools.every(tool => !/approve|provider|model/.test(tool.name)));
});

test('CLI prepares assignments, saves plans and records review with explicit snapshots', async t => {
  const root = await project(t);
  await writeFile(path.join(root, 'plan.json'), JSON.stringify(plan));
  await writeFile(path.join(root, 'report.json'), JSON.stringify(report));
  const cli = (...args: string[]) => spawnSync(process.execPath, [executable, 'work', ...args, '--project', root, '--json'], { encoding: 'utf8' });
  const assignment = cli('assignment', 'planner');
  assert.equal(assignment.status, 0, assignment.stderr);
  assert.equal(JSON.parse(assignment.stdout).execution, 'host_client');
  assert.notEqual(cli('save-plan', '--file', 'plan.json').status, 0);
  assert.equal(cli('save-plan', '--file', 'plan.json', '--snapshot', (await workContext(root)).snapshot_revision).status, 0);
  await approve(root);
  for (const task of plan.tasks) {
    assert.equal(await verify(root), 0);
    const recorded = cli('task-done', task.id, '--snapshot', (await workContext(root)).snapshot_revision);
    assert.equal(recorded.status, 0, recorded.stderr);
  }
  const reviewed = cli('record-review', '--file', 'report.json', '--snapshot', (await workContext(root)).snapshot_revision);
  assert.equal(reviewed.status, 0, reviewed.stderr);
  assert.equal(JSON.parse(reviewed.stdout).plan.review.status, 'current');
  assert.equal(await complete(root), 0);
});
