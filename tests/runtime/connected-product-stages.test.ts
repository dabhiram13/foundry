import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { crc32 } from 'node:zlib';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { approveScope, captureWorkSources, complete, finishTask, pauseOrResume, prepareAssignment,
  recordWorkDesign, recordWorkResearch, recordWorkReview, reviewScope, saveTaskPlan, start, verify,
  workContext, type WorkContext } from '../../src/core/lifecycle.js';
import { designReportSchema, type DesignReport } from '../../src/core/work-preparation.js';
import { type TaskPlan } from '../../src/core/work-plan.js';
import { renderScopeReview } from '../../src/cli/output.js';
import { imageHash, pngFixture, previewFixture, visualFixture } from './visual-fixtures.js';
import { previewSchema } from '../../src/core/work-visual.js';

const executable = path.resolve('dist/runtime/foundry.cjs');
const quote = 'Members can reserve one class at a time.';
const selection = { sources: [{ kind: 'local', location: 'README.md' }] };
const research = { summary: 'Project notes describe a bounded booking flow.', findings: [{
  claim: 'The project requests one booking at a time, not verified market demand.', source: 'S1', quote,
}], limitations: ['Local product notes, not customer interviews.'] };
const plan: TaskPlan = { planner_role: 'planner', reviewer_role: 'quality-gate', ui_builder_role: 'designer', tasks: [
  { id: 'TASK-01', title: 'Booking service', instructions: 'Implement the booking service.', role: 'backend', criteria: ['CS-01'], depends_on: [] },
  { id: 'TASK-02', title: 'Booking form', instructions: 'Implement the approved form using the service.', role: 'designer', criteria: ['CS-02'], depends_on: ['TASK-01'] },
] };
const design: DesignReport = { kind: 'interface', summary: 'A short booking flow with an explicit confirmation.',
  criteria: ['CS-01', 'CS-02'].map(id => ({ id, approach: 'Select a class and confirm a single reservation.',
    primary_states: 'Choose, confirm, success.', failure_states: 'Full class, expired session and retryable failure.',
    responsive: 'Single column on narrow screens.', accessibility: 'Label controls and announce confirmation/errors.' })),
  ux: { user_journey: 'Choose class -> review -> confirm.', information_architecture: 'Classes and booking confirmation.',
    wireframes: 'Class list above a selected-class summary and confirm action.', visual_rules: 'Use existing project type and spacing.',
    component_states: 'Buttons: idle, focus, pending, disabled; form: validation and network errors.',
    validation_plan: 'Exercise keyboard booking, full-class and server-error paths.' },
  assumptions: ['Availability comes from the existing service.'],
  preview: previewFixture,
};

async function project(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-product-stages-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({ schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: 'fixture', source_pin: 'a'.repeat(64) }));
  await writeFile(path.join(root, '.foundry/roles.json'), await readFile('.foundry/roles.json'));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'fixture', checks: [{
    name: 'behavior', command: [process.execPath, '-e', "process.exit(require('node:fs').readFileSync('source.ts','utf8').includes('broken') ? 1 : 0)"],
    inputs: ['source.ts'], required: true,
  }] }));
  await writeFile(path.join(root, 'source.ts'), 'fixture');
  for (const image of previewFixture.screenshots) await writeFile(path.join(root, image.path), pngFixture(image.width, image.height));
  await writeFile(path.join(root, 'README.md'), `# Local product notes\n\n${quote}\n`);
  await writeFile(path.join(root, 'spec.md'), '# Booking\nOne reservation and an accessible form.');
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ schema_version: 1, preparation: {}, criteria: [
    { id: 'CS-01', requirement: 'Reserve one class', checks: ['behavior'] },
    { id: 'CS-02', requirement: 'An accessible booking form', checks: ['behavior'] },
  ] }));
  await start(root, 'booking', 'spec.md', 'scope.json');
  return root;
}
async function snapshot(root: string) { return (await workContext(root)).snapshot_revision; }
async function approve(root: string) { await approveScope(root, (await reviewScope(root)).revision); }
async function researched(root: string) {
  await captureWorkSources(root, selection, await snapshot(root));
  await recordWorkResearch(root, research, await snapshot(root));
}
async function designed(root: string) {
  await researched(root);
  await saveTaskPlan(root, plan, await snapshot(root));
  await approve(root);
  await recordWorkDesign(root, design, await snapshot(root));
  await approve(root);
}

test('Research selection and synthesis are read-only host assignments with captured, bounded context', async t => {
  const root = await project(t);
  assert.equal((await workContext(root)).next_action.kind, 'research');
  const initial = await snapshot(root);
  const assignment = await prepareAssignment(root, 'research');
  assert.equal(assignment.phase, 'select_sources');
  assert.equal(assignment.role.name, 'market-researcher');
  assert.equal(assignment.execution, 'host_client');
  assert.equal(assignment.requested_permissions, 'read-only');
  assert.ok(assignment.instructions.includes(assignment.role.instructions));
  assert.equal(await snapshot(root), initial);
  await assert.rejects(prepareAssignment(root, 'planner'), /Research/);
  await assert.rejects(saveTaskPlan(root, plan), /Research/);
  await assert.rejects(approve(root), /Research/);
  await captureWorkSources(root, selection, initial);
  const synthesis = await prepareAssignment(root, 'research');
  assert.equal(synthesis.phase, 'synthesize');
  assert.match(synthesis.scope.preparation!.sources.collection!.sources[0]!.excerpt, /Members/);
  await recordWorkResearch(root, research, synthesis.snapshot_revision);
  const context = await workContext(root);
  assert.equal(context.next_action.kind, 'plan');
  assert.equal(context.preparation?.research.status, 'current');
  const planner = await prepareAssignment(root, 'planner');
  assert.match(planner.scope.preparation!.research.text!, /Local documents only/);
  assert.match(planner.scope.preparation!.research.text!, /not that the source or the interpretation is correct/);
});

test('unavailable sources, fabricated quotes, unknown sources and malformed reports cannot unlock planning', async t => {
  const root = await project(t);
  const initial = await snapshot(root);
  await assert.rejects(captureWorkSources(root, { sources: [{ kind: 'https', location: 'https://127.0.0.1/private' }] }, initial), /readable source/);
  assert.equal(await snapshot(root), initial);
  await assert.rejects(captureWorkSources(root, { sources: [{ kind: 'local', location: '.foundry/runtime.json' }] }, initial), /readable source/);
  await captureWorkSources(root, { sources: [...selection.sources, { kind: 'local', location: 'docs/missing.md' }] }, initial);
  const captured = await snapshot(root);
  for (const report of [
    { ...research, findings: [{ ...research.findings[0]!, quote: 'An invented quotation that was not captured.' }] },
    { ...research, findings: [{ ...research.findings[0]!, source: 'S2' }] },
    { ...research, findings: [] }, { ...research, unknown: 'reject' },
  ]) await assert.rejects(recordWorkResearch(root, report, captured));
  assert.equal(await snapshot(root), captured);
  await recordWorkResearch(root, research, captured);
  assert.match((await workContext(root)).preparation!.research.text!, /S2: Source unavailable/);
});

test('Plan approval precedes complete Design handoffs, renewed approval precedes every build operation', async t => {
  const root = await project(t);
  await researched(root);
  await saveTaskPlan(root, plan);
  await assert.rejects(prepareAssignment(root, 'designer'), /approve/);
  await assert.rejects(recordWorkDesign(root, design), /approve/);
  await approve(root);
  assert.equal((await workContext(root)).next_action.kind, 'design');
  const assignment = await prepareAssignment(root, 'designer');
  assert.equal(assignment.role.name, 'designer');
  assert.equal(assignment.requested_permissions, 'workspace-write');
  assert.equal(assignment.scope.plan!.tasks.length, 2);
  for (const action of [() => prepareAssignment(root, 'builder'), () => verify(root), () => finishTask(root, 'TASK-01'),
    () => recordWorkReview(root, {}), () => complete(root)]) await assert.rejects(action());
  for (const invalid of [
    { ...design, ux: undefined }, { ...design, criteria: [design.criteria[0]!] },
    { ...design, criteria: [design.criteria[0]!, design.criteria[0]!] },
    { ...design, criteria: [{ ...design.criteria[0]!, id: 'UNKNOWN' }, design.criteria[1]!] },
    { ...design, criteria: [{ ...design.criteria[0]!, accessibility: '' }, design.criteria[1]!] },
  ]) await assert.rejects(recordWorkDesign(root, invalid));
  const previous = await reviewScope(root);
  await recordWorkDesign(root, design, await snapshot(root));
  const saved = await workContext(root);
  assert.equal(saved.preparation?.design.status, 'current');
  assert.equal(saved.scope_approval, 'stale');
  assert.equal(saved.next_action.kind, 'review');
  await assert.rejects(approveScope(root, previous.revision), /changed/);
  await assert.rejects(prepareAssignment(root, 'builder'), /approve/);
  await assert.rejects(verify(root), /approve/);
  assert.match(renderScopeReview(await reviewScope(root)), /validation_plan/);
  await approve(root);
  assert.equal((await prepareAssignment(root, 'builder')).task?.id, 'TASK-01');
  assert.equal(await verify(root), 0);
  await finishTask(root, 'TASK-01');
  await writeFile(path.join(root, 'source.ts'), 'broken');
  assert.equal(await verify(root), 1);
  await assert.rejects(finishTask(root, 'TASK-02'), /passing checks/);
});

test('Design size, duplicate fields and missing UX artifacts fail bounded validation', () => {
  assert.equal(designReportSchema.safeParse({ ...design, criteria: [...design.criteria, design.criteria[0]!] }).success, false);
  assert.equal(designReportSchema.safeParse({ ...design, ux: { ...design.ux, extra: 'reject' } }).success, false);
  assert.equal(designReportSchema.safeParse({ ...design, assumptions: Array(21).fill('assumption') }).success, false);
  const criteria = Array.from({ length: 200 }, (_, index) => ({ ...design.criteria[0]!, id: `CS-${index}`, approach: 'x'.repeat(4000) }));
  assert.equal(designReportSchema.safeParse({ ...design, criteria }).success, false);
  assert.equal(designReportSchema.safeParse({ ...design, kind: 'service', ux: undefined, preview: undefined }).success, true);
});

test('interface preview requires a real component map, screen states, mobile/desktop views and safe URLs', () => {
  assert.equal(designReportSchema.safeParse({ ...design, preview: undefined }).success, false);
  for (const preview of [
    { ...previewFixture, components: [] },
    { ...previewFixture, components: [{ ...previewFixture.components[0]!, states: ['missing-focus'] }] },
    { ...previewFixture, screenshots: [previewFixture.screenshots[0]!] },
    { ...previewFixture, screenshots: [previewFixture.screenshots[0]!, previewFixture.screenshots[0]!] },
    { ...previewFixture, screens: [{ ...previewFixture.screens[0]!, states: ['default', 'error'] }] },
    { ...previewFixture, screenshots: previewFixture.screenshots.map(image => ({ ...image, state: 'invented' })) },
    { ...previewFixture, url: 'http://example.com' }, { ...previewFixture, url: 'file:///tmp/index.html' },
    { ...previewFixture, url: 'https://owner:secret@example.com' }, { ...previewFixture, url: 'not a URL' },
  ]) assert.equal(previewSchema.safeParse(preview).success, false);
});

test('interface criteria need an explicitly selected writable UI specialist; service Design stays image-free', async t => {
  const root = await project(t);
  await researched(root);
  await assert.rejects(saveTaskPlan(root, { ...plan, ui_builder_role: 'quality-gate' }), /writable UI/);
  const { ui_builder_role: _uiRole, ...plainPlan } = plan;
  await saveTaskPlan(root, plainPlan);
  await approve(root);
  await assert.rejects(recordWorkDesign(root, design), /UI specialist/);
  await saveTaskPlan(root, plan);
  await approve(root);
  await assert.rejects(recordWorkDesign(root, { ...design, preview: { ...previewFixture,
    screens: [{ ...previewFixture.screens[0]!, criteria: ['CS-01'] }] } }), /UI specialist/);
  await assert.rejects(recordWorkDesign(root, { ...design, preview: { ...previewFixture,
    screens: [{ ...previewFixture.screens[0]!, criteria: ['UNKNOWN'] }] } }), /approved criteria/);
  await recordWorkDesign(root, { ...design, kind: 'service', ux: undefined, preview: undefined });
  await approve(root);
  assert.equal((await workContext(root)).preparation?.design.status, 'current');
});

test('preview capture rejects unsafe, changed, oversized, malformed and wrong-size local evidence without accepting Design', async t => {
  const root = await project(t);
  await researched(root); await saveTaskPlan(root, plan); await approve(root);
  const first = previewFixture.screenshots[0]!;
  const check = async (image: typeof first, pattern: RegExp) => {
    await assert.rejects(recordWorkDesign(root, { ...design, preview: { ...previewFixture,
      screenshots: [image, previewFixture.screenshots[1]!] } }), pattern);
    assert.equal((await workContext(root)).preparation?.design.status, 'missing');
  };
  await check({ ...first, sha256: '0'.repeat(64) }, /changed/);
  await check({ ...first, path: 'missing.png' }, /unavailable/);
  for (const unsafe of ['../outside.png', '/outside.png', 'C:/outside.png', 'file.png:stream', '.foundry/state/image.png', '.env']) {
    await assert.rejects(recordWorkDesign(root, { ...design, preview: { ...previewFixture,
      screenshots: [{ ...first, path: unsafe }, previewFixture.screenshots[1]!] } }));
  }
  await symlink(path.join(root, first.path), path.join(root, 'linked.png'));
  await assert.rejects(recordWorkDesign(root, { ...design, preview: { ...previewFixture,
    screenshots: [{ ...first, path: 'linked.png' }, previewFixture.screenshots[1]!] } }), /[Ss]ymlink/);
  await rm(path.join(root, 'linked.png'));
  const invalid = Buffer.from('not a screenshot');
  await writeFile(path.join(root, 'invalid.png'), invalid);
  await check({ ...first, path: 'invalid.png', sha256: imageHash(invalid) }, /PNG/);
  await check({ ...first, width: 400 }, /viewport/);
  const damaged = Buffer.from(pngFixture(first.width, first.height)); damaged[40] = damaged[40]! ^ 1;
  await writeFile(path.join(root, 'invalid.png'), damaged);
  await check({ ...first, path: 'invalid.png', sha256: imageHash(damaged) }, /chunks/);
  const badPixels = Buffer.from(pngFixture(first.width, first.height)); badPixels[41] = 0;
  const dataEnd = 41 + badPixels.readUInt32BE(33);
  badPixels.writeUInt32BE(crc32(badPixels.subarray(37, dataEnd)), dataEnd);
  await writeFile(path.join(root, 'invalid.png'), badPixels);
  await check({ ...first, path: 'invalid.png', sha256: imageHash(badPixels) }, /chunks/);
  const large = Buffer.alloc(8 * 1024 * 1024 + 1);
  await writeFile(path.join(root, 'large.png'), large);
  await check({ ...first, path: 'large.png', sha256: imageHash(large) }, /bounded read/);
  await assert.rejects(recordWorkDesign(root, { ...design, preview: { ...previewFixture,
    components: [{ ...previewFixture.components[0]!, source: 'missing.ts' }] } }), /unavailable/);
  await writeFile(path.join(root, 'source.ts'), 'x'.repeat(256 * 1024 + 1));
  await assert.rejects(recordWorkDesign(root, design), /bounded read/);
  await writeFile(path.join(root, 'source.ts'), 'fixture');
  await recordWorkDesign(root, design);
  assert.equal((await workContext(root)).preparation?.design.status, 'current');
});

test('approved visual baseline retains source and PNG copies while original files change; saved-copy tampering blocks builds', async t => {
  const root = await project(t); await designed(root);
  const baseline = (await workContext(root)).preparation!.design;
  assert.match(baseline.report!.preview!.screenshots[0]!.path, /preparation\/.+\/images\/0.png$/);
  assert.equal(await readFile(path.join(root, baseline.preview_sources[0]!.snapshot), 'utf8'), 'fixture');
  await writeFile(path.join(root, 'source.ts'), 'implemented integration');
  await rm(path.join(root, 'mobile.png'));
  assert.equal((await workContext(root)).preparation?.design.status, 'current');
  assert.equal((await workContext(root)).scope_approval, 'current');
  await writeFile(path.join(root, baseline.preview_sources[0]!.snapshot), 'changed source snapshot');
  assert.equal((await workContext(root)).preparation?.design.status, 'invalid');
  await writeFile(path.join(root, baseline.preview_sources[0]!.snapshot), 'fixture');
  assert.equal((await workContext(root)).preparation?.design.status, 'current');
  await writeFile(path.join(root, baseline.report!.preview!.screenshots[0]!.path), 'altered snapshot');
  assert.equal((await workContext(root)).preparation?.design.status, 'invalid');
  await assert.rejects(prepareAssignment(root, 'builder'), /Design/);
  await assert.rejects(verify(root), /Design/);
});

test('visual review requires exact Design and view coverage; gaps and changed snapshots cannot complete', async t => {
  const root = await project(t); await designed(root);
  for (const task of plan.tasks) { assert.equal(await verify(root), 0); await finishTask(root, task.id); }
  const current = await workContext(root);
  const base = { summary: 'Protocol comparison only.', findings: [],
    criteria: ['CS-01', 'CS-02'].map(id => ({ id, assessment: 'met' as const, observation: 'Fixture checked.' })) };
  const visual = visualFixture(current.preparation!.design.record!.sha256);
  await assert.rejects(recordWorkReview(root, base), /exact approved Design/);
  await assert.rejects(recordWorkReview(root, { ...base, visual: { ...visual, design_sha256: '0'.repeat(64) } }), /exact approved Design/);
  await assert.rejects(recordWorkReview(root, { ...base, visual: { ...visual,
    comparisons: [visual.comparisons[0]!, visual.comparisons[0]!] } }), /every approved/);
  for (const assessment of ['gap', 'unverified'] as const) {
    await recordWorkReview(root, { ...base, visual: { ...visual,
      comparisons: visual.comparisons.map(image => ({ ...image, assessment })) } });
    assert.equal((await workContext(root)).plan!.review.status, 'blocked');
    await assert.rejects(complete(root), /specialist review/);
  }
  await recordWorkReview(root, { ...base, visual });
  const reviewed = await workContext(root);
  assert.equal(reviewed.plan!.review.status, 'current');
  const image = reviewed.plan!.review.report!.visual!.comparisons[0]!;
  await writeFile(path.join(root, image.path), 'changed final evidence');
  assert.equal((await workContext(root)).plan!.review.status, 'invalid');
  await assert.rejects(complete(root), /specialist review/);
  await recordWorkReview(root, { ...base, visual });
  assert.equal(await complete(root), 0);
});

test('Research byte bounds and fresh captures cannot silently preserve earlier findings', async t => {
  const root = await project(t);
  await researched(root);
  const previous = await snapshot(root);
  const oversized = { ...research, findings: Array.from({ length: 20 }, () => ({ ...research.findings[0]!, claim: '界'.repeat(2000) })),
    limitations: Array(20).fill('界'.repeat(1000)) };
  await assert.rejects(recordWorkResearch(root, oversized, previous), /128 KiB/);
  assert.equal(await snapshot(root), previous);
  await writeFile(path.join(root, 'README.md'), 'The new project notes describe a different bounded booking flow.');
  await captureWorkSources(root, selection, await snapshot(root));
  assert.equal((await workContext(root)).preparation?.research.status, 'stale');
  assert.match((await workContext(root)).preparation!.research.text!, /Members/);
  await assert.rejects(saveTaskPlan(root, plan), /Research/);
  await assert.rejects(recordWorkResearch(root, research), /quote/);
});

test('changed spec, plan and selected policies invalidate preparation, approval and task progress', async t => {
  const root = await project(t);
  await designed(root);
  assert.equal(await verify(root), 0);
  await finishTask(root, 'TASK-01');
  const old = await snapshot(root);
  const changedPlan = { ...plan, tasks: [{ ...plan.tasks[0]!, instructions: 'Use a changed service boundary.' }, plan.tasks[1]!] };
  await saveTaskPlan(root, changedPlan, old);
  assert.equal((await workContext(root)).preparation?.design.status, 'missing');
  assert.equal((await workContext(root)).plan!.tasks[0]!.status, 'pending');
  await assert.rejects(recordWorkDesign(root, design, old), /stale/);
  await approve(root);
  await recordWorkDesign(root, design);
  await approve(root);
  const rolesPath = path.join(root, '.foundry/roles.json');
  const roles = JSON.parse(await readFile(rolesPath, 'utf8'));
  roles.roles.find((role: { name: string }) => role.name === 'designer').instructions += '\nKeep errors visible.';
  await writeFile(rolesPath, JSON.stringify(roles));
  assert.equal((await workContext(root)).preparation?.design.status, 'stale');
  await assert.rejects(verify(root), /Design/);
  await approve(root);
  await recordWorkDesign(root, design);
  await approve(root);
  await writeFile(path.join(root, 'spec.md'), '# Changed booking scope');
  assert.equal((await workContext(root)).preparation?.research.status, 'stale');
  assert.equal((await prepareAssignment(root, 'research')).phase, 'select_sources');
  await assert.rejects(saveTaskPlan(root, plan), /Research/);
  await researched(root);
  assert.equal((await workContext(root)).plan, null);
  assert.equal((await workContext(root)).preparation?.design.status, 'missing');
});

test('source snapshots, excerpt metadata and preparation record tampering cannot remain current', async t => {
  const root = await project(t);
  await designed(root);
  const current = await workContext(root);
  const source = current.preparation!.sources.collection!.sources[0]!;
  await writeFile(path.join(root, source.path), 'A different source snapshot.');
  const altered = await workContext(root);
  assert.equal(altered.preparation?.sources.status, 'invalid');
  assert.notEqual(altered.scope!.revision, current.scope!.revision);
  await assert.rejects(saveTaskPlan(root, plan, current.snapshot_revision), /stale/);
  await assert.rejects(prepareAssignment(root, 'builder'), /Research/);
  await researched(root);
  await saveTaskPlan(root, plan);
  await approve(root);
  await recordWorkDesign(root, design);
  await approve(root);
  const designPath = (await workContext(root)).preparation!.design.record!.path;
  await writeFile(path.join(root, designPath), JSON.stringify({ ...design, summary: 'Altered record' }));
  assert.equal((await workContext(root)).preparation?.design.status, 'invalid');
  await assert.rejects(verify(root), /Design/);
  const capture = (await workContext(root)).preparation!.sources.capture!;
  await writeFile(path.join(root, capture.path), '{}');
  assert.equal((await workContext(root)).preparation?.sources.status, 'invalid');
});

test('pause/resume and cancellation keep the same run without completing Research', async t => {
  const root = await project(t);
  const run = (await workContext(root)).run!.id;
  await pauseOrResume(root, true);
  await assert.rejects(captureWorkSources(root, selection), /resume or recover/);
  await assert.rejects(prepareAssignment(root, 'research'), /Resume or recover/);
  await pauseOrResume(root, false);
  const initial = await snapshot(root);
  await assert.rejects(captureWorkSources(root, selection, initial, AbortSignal.abort()), /abort/i);
  assert.equal(await snapshot(root), initial);
  const controller = new AbortController();
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (filename?.endsWith('S1.txt')) controller.abort();
  });
  try {
    await assert.rejects(captureWorkSources(root, { sources: [...selection.sources,
      { kind: 'local', location: 'docs/second.md' }] }, initial, controller.signal), /abort/i);
  } finally { watcher.close(); }
  assert.equal((await workContext(root)).preparation?.sources.capture, null);
  await researched(root);
  assert.equal((await workContext(root)).run!.id, run);
});

async function connection(t: TestContext, root: string) {
  const client = new Client({ name: 'product-stages-fixture', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [executable, 'mcp', '--project', root], stderr: 'pipe' });
  let errors = '';
  transport.stderr?.on('data', data => { errors += String(data); });
  await client.connect(transport);
  t.after(async () => { await client.close(); assert.equal(errors, ''); });
  return client;
}
async function call(client: Client, name: string, input: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: input });
  assert.equal(result.isError, false, JSON.stringify(result));
  return result.structuredContent as unknown as WorkContext;
}

test('real MCP capture cancellation does not accept a partial collection and another client can retry', async t => {
  const root = await project(t);
  const first = await connection(t, root);
  const before = await call(first, 'foundry_context');
  const controller = new AbortController();
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (filename?.endsWith('S1.txt')) controller.abort();
  });
  const deadline = setTimeout(() => controller.abort(), 15_000);
  try {
    await assert.rejects(first.callTool({ name: 'foundry_capture_sources', arguments: {
      selection: { sources: [...selection.sources, { kind: 'local', location: 'docs/missing.md' }] },
      snapshot_revision: before.snapshot_revision,
    } }, { signal: controller.signal }), /abort|cancel/i);
  } finally { watcher.close(); clearTimeout(deadline); }
  await first.close();
  const second = await connection(t, root);
  const interrupted = await call(second, 'foundry_context');
  assert.equal(interrupted.run!.id, before.run!.id);
  assert.equal(interrupted.preparation?.sources.capture, null);
  assert.equal(interrupted.preparation?.research.status, 'missing');
  assert.equal(interrupted.scope_approval, 'pending');
  await call(second, 'foundry_capture_sources', { selection, snapshot_revision: interrupted.snapshot_revision });
  assert.equal((await call(second, 'foundry_context')).preparation?.sources.status, 'current');
});

test('two real stdio clients continue Research through approved Design, tasks, review and local handoff', async t => {
  const root = await project(t);
  const first = await connection(t, root);
  const initial = await call(first, 'foundry_context');
  await call(first, 'foundry_assignment', { stage: 'research' });
  await call(first, 'foundry_capture_sources', { selection, snapshot_revision: initial.snapshot_revision });
  await call(first, 'foundry_assignment', { stage: 'research' });
  await call(first, 'foundry_record_research', { report: research, snapshot_revision: (await call(first, 'foundry_context')).snapshot_revision });
  await first.close();
  const second = await connection(t, root);
  assert.equal((await call(second, 'foundry_context')).run!.id, initial.run!.id);
  await call(second, 'foundry_assignment', { stage: 'planner' });
  await call(second, 'foundry_save_plan', { plan, snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  const approveCli = async () => {
    const scope = await reviewScope(root);
    const approved = spawnSync(process.execPath, [executable, 'work', 'approve', '--revision', scope.revision, '--project', root], { encoding: 'utf8' });
    assert.equal(approved.status, 0, approved.stderr);
  };
  await approveCli();
  await call(second, 'foundry_assignment', { stage: 'designer' });
  const missingPreview = await second.callTool({ name: 'foundry_record_design', arguments: {
    report: { ...design, preview: undefined }, snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision,
  } });
  assert.equal(missingPreview.isError, true);
  await call(second, 'foundry_record_design', { report: design, snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  await approveCli();
  for (const task of plan.tasks) {
    await call(second, 'foundry_assignment', { stage: 'builder' });
    await writeFile(path.join(root, 'source.ts'), task.id);
    await call(second, 'foundry_verify', { snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
    await call(second, 'foundry_task_done', { task_id: task.id, snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  }
  await call(second, 'foundry_assignment', { stage: 'reviewer' });
  const missingVisual = await second.callTool({ name: 'foundry_record_review', arguments: {
    report: { summary: 'No comparison is not enough.', findings: [],
      criteria: ['CS-01', 'CS-02'].map(id => ({ id, assessment: 'met', observation: 'Fixture.' })) },
    snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision,
  } });
  assert.equal(missingVisual.isError, true);
  await call(second, 'foundry_record_review', { report: { summary: 'Fixture behavior, not live UI qualification.', findings: [],
    visual: visualFixture((await call(second, 'foundry_context')).preparation!.design.record!.sha256),
    criteria: ['CS-01', 'CS-02'].map(id => ({ id, assessment: 'met', observation: 'Local protocol fixture exercised.' })),
  }, snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  const completed = await call(second, 'foundry_complete', { snapshot_revision: (await call(second, 'foundry_context')).snapshot_revision });
  assert.equal(completed.next_action.kind, 'none');
  assert.equal(completed.run!.historical, true);
  const pointer = JSON.parse(await readFile(path.join(root, '.foundry/state/last-completed.json'), 'utf8'));
  const state = JSON.parse(await readFile(path.join(root, pointer.state), 'utf8'));
  const handoff = await readFile(path.join(root, state.completion.path), 'utf8');
  assert.match(handoff, /Source-backed Research/);
  assert.match(handoff, /Host-reported Design/);
  assert.match(handoff, /validation_plan/);
  assert.match(handoff, /TASK-02/);
  assert.match(handoff, /Visual comparison/);
  assert.match(handoff, /images\/1\.png/);
});

test('CLI captures sources and records the same preparation with explicit snapshots', async t => {
  const root = await project(t);
  for (const [name, value] of Object.entries({ selection, research, design })) {
    await writeFile(path.join(root, `${name}.json`), JSON.stringify(value));
  }
  const cli = (...args: string[]) => spawnSync(process.execPath, [executable, 'work', ...args, '--project', root, '--json'], { encoding: 'utf8' });
  assert.equal(cli('assignment', 'research').status, 0);
  assert.notEqual(cli('capture-sources', '--file', 'selection.json').status, 0);
  for (const [command, file] of [['capture-sources', 'selection'], ['record-research', 'research']]) {
    const result = cli(command!, '--file', `${file}.json`, '--snapshot', await snapshot(root));
    assert.equal(result.status, 0, result.stderr);
  }
  await saveTaskPlan(root, plan);
  await approve(root);
  assert.equal(cli('assignment', 'designer').status, 0);
  const recorded = cli('record-design', '--file', 'design.json', '--snapshot', await snapshot(root));
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.equal(JSON.parse(recorded.stdout).scope_approval, 'stale');
  await approve(root);
  await writeFile(path.join(root, 'review.json'), JSON.stringify({ summary: 'CLI visual protocol fixture, not live UI.',
    findings: [], visual: visualFixture((await workContext(root)).preparation!.design.record!.sha256),
    criteria: ['CS-01', 'CS-02'].map(id => ({ id, assessment: 'met', observation: 'Local fixture.' })) }));
  for (const task of plan.tasks) { assert.equal(await verify(root), 0); await finishTask(root, task.id); }
  const reviewed = cli('record-review', '--file', 'review.json', '--snapshot', await snapshot(root));
  assert.equal(reviewed.status, 0, reviewed.stderr);
  assert.equal(JSON.parse(reviewed.stdout).plan.review.status, 'current');
  const completed = cli('complete');
  assert.equal(completed.status, 0, completed.stderr);
});
