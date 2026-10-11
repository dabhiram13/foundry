import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { approveScope, complete, recover, reviewScope, start, status, verify, workContext } from '../../src/core/lifecycle.js';
import { digest, withProcessLock } from '../../src/core/fs.js';
import { ProjectService } from '../../src/core/projects.js';
import { renderScopeReview, renderWorkContext } from '../../src/cli/output.js';

const contract = { schema_version: 1, criteria: [{ id: 'SCOPE-001', requirement: 'The change passes its required check.', checks: ['behavior'] }] };
async function project(t: TestContext, command = 'process.exit(0)'): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: '2026-01-01', source_pin: 'a'.repeat(64),
  }));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'fixture', checks: [{
    name: 'behavior', command: [process.execPath, '-e', command], inputs: ['spec.md'], required: true,
  }] }));
  await writeFile(path.join(root, 'spec.md'), '# Scope\nMake the agreed change.\n');
  await writeFile(path.join(root, 'source.ts'), 'Original source');
  await writeFile(path.join(root, 'scope.json'), JSON.stringify(contract));
  return root;
}
async function begin(root: string) {
  return start(root, 'scope', 'spec.md', 'scope.json');
}
async function approve(root: string) {
  return approveScope(root, (await reviewScope(root)).revision);
}
async function snapshot(root: string) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return Object.fromEntries(await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => {
    const file = path.join(entry.parentPath, entry.name);
    return [path.relative(root, file), digest(await readFile(file))];
  })));
}
async function receipt(root: string) {
  return path.join(root, String(((await status(root)).active as Record<string, unknown>).verification));
}

test('opt-in approval, required check coverage and completion are separate decisions', async t => {
  const root = await project(t);
  const state = await begin(root);
  const before = await snapshot(root);
  const [one, two] = await Promise.all([reviewScope(root), reviewScope(root)]);
  assert.deepEqual(one, two);
  assert.deepEqual(await snapshot(root), before);
  assert.equal(one.approval.status, 'pending');
  assert.match(renderScopeReview(one), /Make the agreed change/);
  assert.match(renderScopeReview(one), /SCOPE-001/);
  assert.match(renderScopeReview(one), /process.exit/);
  await assert.rejects(verify(root), /approve/);
  await assert.rejects(complete(root), /approve|fresh/);
  const pending = await workContext(root);
  assert.equal(pending.scope_approval, 'pending');
  assert.equal(pending.requirements_coverage, 'mapped');
  assert.equal(pending.next_action.kind, 'review');
  assert.deepEqual(await snapshot(root), before);
  const approved = await approveScope(root, one.revision);
  assert.equal(approved.approval.status, 'current');
  assert.equal(approved.approval.method, 'manual_cli');
  assert.equal((await workContext(root)).next_action.kind, 'verify');
  assert.equal(await verify(root), 0);
  const current = await workContext(root);
  assert.equal(current.evidence.status, 'current');
  assert.equal(current.requirements_coverage, 'checks_passed');
  assert.equal(current.scope?.criteria[0]?.status, 'checks_passed');
  assert.equal(current.next_action.kind, 'complete');
  assert.doesNotMatch(renderWorkContext(current), /[a-f0-9]{64}|process.exit/);
  assert.ok(renderWorkContext(current).split('\n').length <= 9);
  assert.equal(JSON.parse(await readFile(await receipt(root), 'utf8')).scope_revision, one.revision);
  assert.equal(await complete(root), 0);
  const historical = await workContext(root);
  assert.equal(historical.run?.id, state.run_id);
  assert.equal(historical.run?.historical, true);
  assert.equal(historical.scope_approval, 'current');
  assert.equal(historical.next_action.kind, 'none');
});

test('scope approval changes only with scope, mappings and executable check settings', async t => {
  for (const change of ['spec', 'criteria', 'mapping', 'command', 'required', 'inputs', 'environment', 'timeout', 'source']) {
    await t.test(change, async t => {
      const root = await project(t);
      if (change === 'required') {
        const file = path.join(root, '.foundry/project.json');
        const config = JSON.parse(await readFile(file, 'utf8'));
        config.checks.push({ name: 'fallback', command: [process.execPath, '-e', 'process.exit(0)'], required: true });
        await writeFile(file, JSON.stringify(config));
      }
      await begin(root);
      const original = await approve(root);
      await verify(root);
      if (change === 'spec' || change === 'source') await writeFile(path.join(root, change === 'spec' ? 'spec.md' : 'source.ts'), 'New content');
      else if (change === 'criteria' || change === 'mapping') {
        const updated = structuredClone(contract);
        if (change === 'criteria') updated.criteria[0]!.requirement = 'A new requirement.';
        else updated.criteria[0]!.checks = [];
        await writeFile(path.join(root, 'scope.json'), JSON.stringify(updated));
      } else {
        const file = path.join(root, '.foundry/project.json');
        const config = JSON.parse(await readFile(file, 'utf8'));
        const values: Record<string, unknown> = { command: [process.execPath, '-e', 'process.exit(1)'], required: false, inputs: ['source.ts'], environment: ['SCOPE_FIXTURE'], timeout: 2 };
        config.checks[0][change] = values[change];
        await writeFile(file, JSON.stringify(config));
      }
      const context = await workContext(root);
      assert.equal(context.scope_approval, change === 'source' ? 'current' : 'stale');
      assert.notEqual(context.requirements_coverage, 'checks_passed');
      await assert.rejects(complete(root), /changed|map|stale/);
      if (change !== 'source') await assert.rejects(approveScope(root, original.revision), /changed/);
    });
  }
});

test('incomplete, unknown and optional mappings cannot authorize required criteria', async t => {
  for (const names of [[], ['unknown'], ['optional'], ['behavior', 'optional']]) {
    await t.test(JSON.stringify(names), async t => {
      const root = await project(t);
      const file = path.join(root, '.foundry/project.json');
      const config = JSON.parse(await readFile(file, 'utf8'));
      config.checks.push({ name: 'optional', command: [process.execPath, '-e', 'process.exit(0)'], required: false });
      await writeFile(file, JSON.stringify(config));
      const updated = structuredClone(contract);
      updated.criteria[0]!.checks = names;
      await writeFile(path.join(root, 'scope.json'), JSON.stringify(updated));
      await begin(root);
      const review = await reviewScope(root);
      assert.equal(review.criteria[0]?.mapped, false);
      await assert.rejects(approveScope(root, review.revision), /Every acceptance/);
      assert.equal((await workContext(root)).requirements_coverage, 'unmapped');
    });
  }
});

test('malformed, duplicate, oversized and unsafe contracts cannot enroll', async t => {
  for (const value of ['{', JSON.stringify({ ...contract, unknown: true }), JSON.stringify({ ...contract, criteria: [...contract.criteria, ...contract.criteria] }), JSON.stringify({ ...contract, criteria: [{ ...contract.criteria[0], checks: ['behavior', 'behavior'] }] }), ' '.repeat(256 * 1024 + 1)]) {
    const root = await project(t);
    await writeFile(path.join(root, 'scope.json'), value);
    await assert.rejects(begin(root), /scope contract|limit/i);
    assert.deepEqual((await status(root)).active, { status: 'idle' });
  }
  const root = await project(t);
  for (const relative of ['../scope.json', path.join(root, 'scope.json'), '.foundry/state/approval.json']) {
    await assert.rejects(start(root, 'unsafe', 'spec.md', relative));
  }
});

test('every declared criterion needs coverage, and failed mapped checks stay pending', async t => {
  const root = await project(t, 'process.exit(3)');
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ ...contract, criteria: [
    ...contract.criteria, { id: 'SCOPE-002', requirement: 'The second requirement is checked.', checks: [] },
  ] }));
  await begin(root);
  const review = await reviewScope(root);
  assert.equal(review.criteria[0]?.mapped, true);
  assert.equal(review.criteria[1]?.mapped, false);
  await assert.rejects(approveScope(root, review.revision), /Every acceptance/);
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ ...contract, criteria: [
    ...contract.criteria, { id: 'SCOPE-002', requirement: 'The second requirement is checked.', checks: ['behavior'] },
  ] }));
  await approve(root);
  assert.equal(await verify(root), 1);
  const context = await workContext(root);
  assert.equal(context.scope_approval, 'current');
  assert.equal(context.evidence.status, 'failed');
  assert.equal(context.requirements_coverage, 'mapped');
  assert.ok(context.scope?.criteria.every(criterion => criterion.status === 'pending'));
  await assert.rejects(complete(root), /fresh/);
});

test('an interrupted approval write has no authority until explicitly approved again', async t => {
  const root = await project(t);
  const state = await begin(root);
  await approve(root);
  const file = path.join(root, `.foundry/state/runs/${state.run_id}/state.json`);
  const saved = JSON.parse(await readFile(file, 'utf8'));
  delete saved.scope.approval_sha256;
  await writeFile(file, JSON.stringify(saved));
  assert.equal((await workContext(root)).scope_approval, 'invalid');
  await assert.rejects(verify(root), /invalid/);
  await approve(root);
  assert.equal((await workContext(root)).scope_approval, 'current');
});

test('missing or altered approvals block completion without rewriting valid check evidence', async t => {
  for (const change of ['missing', 'malformed', 'wrong-run', 'stale', 'unknown-field', 'wrong-spec', 'timestamp']) {
    await t.test(change, async t => {
      const root = await project(t);
      const state = await begin(root);
      await approve(root);
      await verify(root);
      const file = path.join(root, `.foundry/state/runs/${state.run_id}/scope-approval.json`);
      const record = JSON.parse(await readFile(file, 'utf8'));
      if (change === 'missing') await rm(file);
      else if (change === 'malformed') await writeFile(file, '{');
      else {
        if (change === 'wrong-run') record.run_id = '00000000-0000-4000-8000-000000000000';
        if (change === 'stale') record.revision = 'f'.repeat(64);
        if (change === 'unknown-field') record.actor = 'human';
        if (change === 'wrong-spec') record.spec = 'other.md';
        if (change === 'timestamp') record.approved_at = '2026-01-02T00:00:00.000Z';
        await writeFile(file, JSON.stringify(record));
      }
      const context = await workContext(root);
      assert.equal(context.evidence.status, 'current');
      assert.notEqual(context.scope_approval, 'current');
      if (change === 'timestamp') assert.equal(context.scope_approval, 'invalid');
      assert.equal(context.requirements_coverage, 'mapped');
      assert.equal(context.next_action.kind, 'review');
      await assert.rejects(complete(root), /approve|invalid|changed/);
      await approve(root);
      assert.equal(await complete(root), 0);
    });
  }
});

test('receipt run and scope bindings cannot be omitted or transplanted', async t => {
  for (const change of ['run', 'scope', 'missing']) {
    const root = await project(t);
    await begin(root);
    await approve(root);
    await verify(root);
    const file = await receipt(root);
    const record = JSON.parse(await readFile(file, 'utf8'));
    if (change === 'run') record.run_id = 'another-run';
    else if (change === 'scope') record.scope_revision = 'f'.repeat(64);
    else delete record.scope_revision;
    await writeFile(file, JSON.stringify(record));
    await assert.rejects(complete(root), /match|run|contract/);
    assert.equal((await workContext(root)).evidence.status, 'invalid');
  }
});

test('enrollment cannot silently disappear or change to disable an opted-in gate', async t => {
  for (const change of ['missing', 'different', 'state-field']) {
    const root = await project(t);
    const state = await begin(root);
    await approve(root);
    await verify(root);
    const file = path.join(root, `.foundry/state/runs/${state.run_id}/scope.json`);
    if (change === 'missing') await rm(file);
    else if (change === 'different') {
      const value = JSON.parse(await readFile(file, 'utf8'));
      value.contract = 'other.json';
      await writeFile(file, JSON.stringify(value));
    } else {
      const stateFile = path.join(root, `.foundry/state/runs/${state.run_id}/state.json`);
      const value = JSON.parse(await readFile(stateFile, 'utf8'));
      delete value.scope;
      await writeFile(stateFile, JSON.stringify(value));
    }
    await assert.rejects(complete(root), /enrollment/);
    await assert.rejects(workContext(root), /enrollment/);
  }
});

test('legacy runs stay usable and Factory work cannot acquire scoped approvals', async t => {
  const root = await project(t);
  await start(root, 'legacy', 'spec.md');
  await assert.rejects(reviewScope(root), /no scope contract/);
  await assert.rejects(approveScope(root, 'a'.repeat(64)), /no scope contract/);
  assert.equal(await verify(root), 0);
  assert.equal(await complete(root), 0);
  assert.equal((await workContext(root)).scope_approval, 'not_recorded');
  const service = new ProjectService(path.resolve('.'), path.join(root, 'products'));
  const owned = await service.create({ name: 'Scope Factory Fixture', idea: 'Fixture only.', adapter: 'codex' });
  const product = String(owned.path);
  await writeFile(path.join(product, 'spec.md'), '# Scope');
  await writeFile(path.join(product, 'scope.json'), JSON.stringify(contract));
  await assert.rejects(begin(product), /Factory-owned/);
  await assert.rejects(reviewScope(product), /Factory-owned/);
  await assert.rejects(approveScope(product, 'a'.repeat(64)), /Factory-owned/);
});

test('approval revisions are isolated by project and run identity', async t => {
  const one = await project(t);
  const two = await project(t);
  await begin(one);
  await begin(two);
  const review = await reviewScope(one);
  await assert.rejects(approveScope(two, review.revision), /changed/);
  await approve(one);
  assert.equal((await workContext(two)).scope_approval, 'pending');
});

test('ignored contracts remain in historical fingerprints and invalidate approval', async t => {
  const root = await project(t);
  assert.equal(spawnSync('git', ['init', '--quiet'], { cwd: root }).status, 0);
  await writeFile(path.join(root, '.gitignore'), 'scope.json\n.foundry/state/\n');
  await begin(root);
  await approve(root);
  await verify(root);
  await complete(root);
  const before = await workContext(root);
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ ...contract, criteria: [{ ...contract.criteria[0], requirement: 'Different requirement.' }] }));
  const after = await workContext(root);
  assert.equal(after.run?.historical, true);
  assert.equal(after.scope_approval, 'stale');
  assert.equal(after.evidence.status, 'stale');
  assert.notEqual(after.snapshot_revision, before.snapshot_revision);
  assert.notEqual(after.next_action.kind, 'none');
});

test('review and approval refuse concurrent writers or scope changes while reading', async t => {
  const root = await project(t);
  await begin(root);
  const review = await reviewScope(root);
  await withProcessLock(path.join(root, '.foundry/state/coordinator.lock'), async () => {
    await assert.rejects(reviewScope(root), /writer/);
    await assert.rejects(workContext(root), /changing/);
    await assert.rejects(approveScope(root, review.revision), /another|locked|operation/i);
  });
  const original = fs.open;
  let changed = false;
  t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args);
    if (!changed && args[0] === path.join(root, 'scope.json')) {
      const close = handle.close.bind(handle);
      t.mock.method(handle, 'close', async () => {
        await close();
        changed = true;
        await writeFile(path.join(root, 'spec.md'), '# Changed while reviewing');
      });
    }
    return handle;
  });
  await assert.rejects(reviewScope(root), /changed/);
  await assert.rejects(approveScope(root, review.revision), /changed/);
});

test('a check deleting approval cannot leave verified or completed work', async t => {
  const root = await project(t, `const fs = require('node:fs'); const run = fs.readdirSync('.foundry/state/runs')[0]; fs.unlinkSync('.foundry/state/runs/' + run + '/scope-approval.json');`);
  await begin(root);
  await approve(root);
  assert.equal(await verify(root), 1);
  const context = await workContext(root);
  assert.equal(context.scope_approval, 'pending');
  assert.equal(context.evidence.status, 'failed');
  assert.match(renderWorkContext(context), /Evidence: The recorded verification did not pass/);
  assert.notEqual(context.run?.saved_status, 'verified');
  await assert.rejects(complete(root), /approve|fresh/);
});

test('completion and recovery cannot finish an intent after approval disappears', async t => {
  const root = await project(t);
  const state = await begin(root);
  await approve(root);
  await verify(root);
  const approval = path.join(root, `.foundry/state/runs/${state.run_id}/scope-approval.json`);
  const original = fs.open;
  let reads = 0;
  t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args);
    if (args[0] === approval && ++reads === 2) {
      const close = handle.close.bind(handle);
      t.mock.method(handle, 'close', async () => { await close(); await rm(approval); });
    }
    return handle;
  });
  await assert.rejects(complete(root), /approve/);
  assert.notEqual(((await status(root)).active as Record<string, unknown>).status, 'completed');
  assert.notEqual((await recover(root))?.status, 'completed');
});

test('source CLI review, approval and context validate options and keep default output small', async t => {
  const root = await project(t);
  const cli = (args: string[]) => spawnSync(process.execPath, ['dist/runtime/foundry.cjs', 'work', ...args, '--project', root], { encoding: 'utf8' });
  assert.equal(cli(['start', 'source-cli', '--spec', 'spec.md', '--contract', 'scope.json']).status, 0);
  const review = cli(['review', '--json']);
  assert.equal(review.status, 0, review.stderr);
  const parsed = JSON.parse(review.stdout);
  for (const args of [['review', '--execute'], ['approve', '--confirmed'], ['approve', '--revision', parsed.revision, '--adapter', 'anything'], ['approve']]) {
    assert.equal(cli(args).status, 2);
  }
  const approval = cli(['approve', '--revision', parsed.revision]);
  assert.equal(approval.status, 0, approval.stderr);
  assert.match(approval.stdout, /Scope approved/);
  assert.doesNotMatch(approval.stdout, /[a-f0-9]{64}/);
  const context = cli(['context']);
  assert.equal(context.status, 0);
  assert.doesNotMatch(context.stdout, /[a-f0-9]{64}|process.exit/);
});
