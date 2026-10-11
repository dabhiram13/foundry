import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { complete, pauseOrResume, start, status, verify, workContext } from '../../src/core/lifecycle.js';
import { digest, withProcessLock } from '../../src/core/fs.js';
import { renderWorkContext } from '../../src/cli/output.js';
import { ProjectService } from '../../src/core/projects.js';

async function project(t: TestContext, exitCode = 0): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({
    name: 'fixture', checks: [{
      name: 'behavior', command: [process.execPath, '-e', `process.exit(${exitCode})`],
      inputs: ['spec.md'], environment: ['FOUNDRY_CONTEXT_FIXTURE'], required: true,
    }],
  }));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1, runtime: 'typescript', runtime_version: '1',
    installed_at: '2026-01-01', source_pin: 'a'.repeat(64),
  }));
  await writeFile(path.join(root, 'spec.md'), '# Acceptance\n');
  return root;
}

async function files(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const file = path.join(entry.parentPath, entry.name);
      result[path.relative(root, file)] = digest(await readFile(file));
    }
  }
  return result;
}

async function receiptPath(root: string): Promise<string> {
  const current = await status(root);
  return path.join(root, String((current.active as Record<string, unknown>).verification));
}

test('context is read-only, stable across independent readers and explicit about its authority', async (t) => {
  const root = await project(t);
  await start(root, 'context', 'spec.md');
  assert.equal(await verify(root), 0);
  const before = await files(root);
  const [one, two] = await Promise.all([workContext(root), workContext(root)]);
  assert.deepEqual(one, two);
  assert.deepEqual(await files(root), before);
  assert.equal(one.schema_version, 2);
  assert.match(one.snapshot_revision, /^[a-f0-9]{64}$/);
  assert.equal(one.run?.saved_status, 'verified');
  assert.equal(one.evidence.status, 'current');
  assert.equal(one.evidence.checks[0]?.status, 'passed');
  assert.equal(one.next_action.kind, 'complete');
  assert.equal(one.scope_approval, 'not_recorded');
  assert.equal(one.requirements_coverage, 'not_assessed');
  assert.doesNotMatch(JSON.stringify(one), /process.exit|FOUNDRY_CONTEXT_FIXTURE/);
  assert.match(renderWorkContext(one), /Required checks passed/);
  assert.doesNotMatch(renderWorkContext(one), /sha256|snapshot_revision|[a-f0-9]{64}/);
});

test('optional check outcomes are not promoted to validated requirements', async (t) => {
  const root = await project(t);
  const file = path.join(root, '.foundry/project.json');
  const config = JSON.parse(await readFile(file, 'utf8'));
  config.checks.push({ name: 'optional', command: [process.execPath, '-e', 'process.exit(7)'], inputs: ['spec.md'], required: false });
  await writeFile(file, JSON.stringify(config));
  await start(root, 'optional', 'spec.md');
  assert.equal(await verify(root), 0);
  const context = await workContext(root);
  assert.equal(context.evidence.status, 'current');
  assert.deepEqual(context.evidence.checks, [
    { name: 'behavior', required: true, status: 'passed' },
    { name: 'optional', required: false, status: 'not_assessed' },
  ]);
});

test('context separates saved verification from changed spec, source, config and environment', async (t) => {
  for (const change of ['spec', 'source', 'config', 'environment']) {
    await t.test(change, async (child) => {
      const root = await project(child);
      await start(root, 'changed', 'spec.md');
      assert.equal(await verify(root), 0);
      const before = await workContext(root);
      const previousEnv = process.env.FOUNDRY_CONTEXT_FIXTURE;
      try {
        if (change === 'environment') process.env.FOUNDRY_CONTEXT_FIXTURE = 'different-value';
        else if (change === 'config') {
          const file = path.join(root, '.foundry/project.json');
          const config = JSON.parse(await readFile(file, 'utf8'));
          config.checks[0].timeout = 17;
          await writeFile(file, JSON.stringify(config));
        } else await writeFile(path.join(root, change === 'spec' ? 'spec.md' : 'code.ts'), '# Changed\n');
        const after = await workContext(root);
        assert.equal(after.evidence.status, 'stale');
        assert.equal(after.run?.saved_status, 'verified');
        assert.equal(after.next_action.kind, 'verify');
        assert.notEqual(after.snapshot_revision, before.snapshot_revision);
        assert.doesNotMatch(JSON.stringify(after), /different-value/);
        await assert.rejects(complete(root), /stale|mismatch/);
      } finally {
        if (previousEnv === undefined) delete process.env.FOUNDRY_CONTEXT_FIXTURE;
        else process.env.FOUNDRY_CONTEXT_FIXTURE = previousEnv;
      }
    });
  }
});

test('context does not promote missing, failed, interrupted or tampered evidence', async (t) => {
  for (const scenario of ['no-verify', 'failed', 'missing', 'malformed', 'wrong-run', 'interrupted', 'log', 'missing-log', 'check']) {
    await t.test(scenario, async (child) => {
      const root = await project(child, scenario === 'failed' ? 7 : 0);
      await start(root, 'invalid', 'spec.md');
      if (scenario !== 'no-verify') {
        await verify(root);
        const file = await receiptPath(root);
        const receipt = JSON.parse(await readFile(file, 'utf8'));
        if (scenario === 'missing') await rm(file);
        else if (scenario === 'malformed') await writeFile(file, 'not JSON');
        else if (scenario === 'log') await writeFile(path.join(root, receipt.checks[0].log), 'changed log');
        else if (scenario === 'missing-log') await rm(path.join(root, receipt.checks[0].log));
        else if (['wrong-run', 'interrupted', 'check'].includes(scenario)) {
          if (scenario === 'wrong-run') receipt.run_id = '00000000-0000-4000-8000-000000000000';
          if (scenario === 'interrupted') receipt.status = 'interrupted';
          if (scenario === 'check') receipt.checks[0].exit_code = 12;
          await writeFile(file, JSON.stringify(receipt));
        }
      }
      const before = await files(root);
      const context = await workContext(root);
      assert.equal(context.evidence.status, scenario === 'failed' ? 'failed' : scenario === 'no-verify' ? 'missing' : 'invalid');
      assert.notEqual(context.next_action.kind, 'complete');
      assert.deepEqual(await files(root), before);
    });
  }
});

test('context preserves completed history without promising current verification after edits', async (t) => {
  const root = await project(t);
  await start(root, 'history', 'spec.md');
  assert.equal(await verify(root), 0);
  assert.equal(await complete(root), 0);
  const fresh = await workContext(root);
  assert.equal(fresh.run?.historical, true);
  assert.equal(fresh.evidence.status, 'current');
  assert.equal(fresh.next_action.kind, 'none');
  await writeFile(path.join(root, 'spec.md'), '# Later work\n');
  const before = await files(root);
  const stale = await workContext(root);
  assert.equal(stale.run?.saved_status, 'completed');
  assert.equal(stale.run?.historical, true);
  assert.equal(stale.evidence.status, 'stale');
  assert.equal(stale.next_action.kind, 'start');
  assert.deepEqual(await files(root), before);
});

test('historical context retains an ignored specification in the verification fingerprint', async (t) => {
  const root = await project(t);
  assert.equal(spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' }).status, 0);
  await writeFile(path.join(root, '.gitignore'), 'spec.md\n');
  await start(root, 'ignored-spec', 'spec.md');
  await verify(root);
  await complete(root);
  assert.equal((await workContext(root)).evidence.status, 'current');
  await writeFile(path.join(root, 'spec.md'), '# Changed ignored specification\n');
  assert.equal((await workContext(root)).evidence.status, 'stale');
});

test('idle and paused work give a safe next action', async (t) => {
  const root = await project(t);
  assert.equal((await workContext(root)).next_action.kind, 'start');
  await start(root, 'paused', 'spec.md');
  await verify(root);
  await pauseOrResume(root, true);
  assert.equal((await workContext(root)).next_action.kind, 'resume');
  await pauseOrResume(root, false);
  assert.equal((await workContext(root)).evidence.status, 'missing');
});

test('an idle initialized repository does not need checks configured yet', async (t) => {
  const root = await project(t);
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'empty', checks: [] }));
  const context = await workContext(root);
  assert.equal(context.run, null);
  assert.equal(context.next_action.kind, 'start');
  assert.equal(context.evidence.status, 'missing');
});

test('a retained test report must still match its execution', async (t) => {
  const root = await project(t);
  const file = path.join(root, '.foundry/project.json');
  const config = JSON.parse(await readFile(file, 'utf8'));
  config.checks[0].test_report = '.foundry/state/report.json';
  config.checks[0].command = [process.execPath, '-e', `require('node:fs').writeFileSync(process.env.FOUNDRY_TEST_REPORT, JSON.stringify({run_id:process.env.FOUNDRY_CHECK_ID,tests:{executed:1,passed:1,failed:0,skipped:0}}))`];
  await writeFile(file, JSON.stringify(config));
  await start(root, 'report', 'spec.md');
  assert.equal(await verify(root), 0);
  assert.equal((await workContext(root)).evidence.status, 'current');
  const receipt = JSON.parse(await readFile(await receiptPath(root), 'utf8'));
  await writeFile(path.join(root, receipt.checks[0].test_report), '{}');
  assert.equal((await workContext(root)).evidence.status, 'invalid');
});

test('a second sample catches evidence changed during the first read', async (t) => {
  const root = await project(t);
  await start(root, 'racing-log', 'spec.md');
  await verify(root);
  const receipt = JSON.parse(await readFile(await receiptPath(root), 'utf8'));
  const log = path.join(root, receipt.checks[0].log);
  const original = fs.readFile;
  let changed = false;
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    const result = await original(...args);
    if (!changed && args[0] === log) {
      changed = true;
      await writeFile(log, 'changed during context collection');
    }
    return result;
  });
  const context = await workContext(root);
  assert.equal(changed, true);
  assert.equal(context.evidence.status, 'invalid');
  assert.notEqual(context.next_action.kind, 'complete');
});

test('context does not apply scoped guarantees to Factory or another project', async (t) => {
  const root = await project(t);
  const second = await project(t);
  await start(root, 'first', 'spec.md');
  await start(second, 'second', 'spec.md');
  const firstContext = await workContext(root);
  const secondContext = await workContext(second);
  assert.notEqual(firstContext.run?.id, secondContext.run?.id);
  assert.notEqual(firstContext.snapshot_revision, secondContext.snapshot_revision);
  assert.equal(firstContext.project, root);
  assert.equal(secondContext.project, second);
  const service = new ProjectService(path.resolve('.'), path.join(root, 'products'));
  const product = await service.create({ name: 'Factory Context', idea: 'Fixture only.', adapter: 'codex' });
  await assert.rejects(workContext(String(product.path)), /for scoped work/);
});

test('source changes during collection are rejected instead of returning a mixed snapshot', async (t) => {
  const root = await project(t);
  await start(root, 'racing-source', 'spec.md');
  await verify(root);
  const spec = path.join(root, 'spec.md');
  const original = fs.readFile;
  let changed = false;
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    const result = await original(...args);
    if (!changed && args[0] === spec) {
      changed = true;
      await writeFile(spec, '# Changed while reading\n');
    }
    return result;
  });
  await assert.rejects(workContext(root), /Work changed while reading/);
  assert.equal(changed, true);
});

test('orphaned verification and completion states recommend recovery, not completion', async (t) => {
  const root = await project(t);
  const run = await start(root, 'orphan', 'spec.md');
  await verify(root);
  const file = path.join(root, '.foundry/state/runs', run.run_id, 'state.json');
  const state = JSON.parse(await readFile(file, 'utf8'));
  for (const status of ['verifying', 'completing']) {
    await writeFile(file, JSON.stringify({ ...state, status }));
    assert.equal((await workContext(root)).next_action.kind, 'recover');
  }
  await writeFile(file, '{}');
  await assert.rejects(workContext(root));
});

test('unsafe receipt pointers and mismatched completed history fail closed', async (t) => {
  const root = await project(t);
  const run = await start(root, 'pointer', 'spec.md');
  const statePath = path.join(root, '.foundry/state/runs', run.run_id, 'state.json');
  await writeFile(statePath, JSON.stringify({ ...run, verification: '../outside.json' }));
  await assert.rejects(workContext(root));
  await writeFile(statePath, JSON.stringify(run));
  await verify(root);
  await complete(root);
  await writeFile(path.join(root, '.foundry/state/last-completed.json'), JSON.stringify({
    run_id: run.run_id, state: 'spec.md',
  }));
  await assert.rejects(workContext(root), /Completed pointer/);
});

test('context refuses concurrent writers, legacy roots and malformed run pointers', async (t) => {
  const root = await project(t);
  const run = await start(root, 'guarded', 'spec.md');
  await withProcessLock(path.join(root, '.foundry/state/coordinator.lock'), async () => {
    await assert.rejects(workContext(root), /Work is changing/);
  });
  const pointer = path.join(root, '.foundry/state/active.json');
  await writeFile(pointer, JSON.stringify({ run_id: '../outside', slug: run.slug }));
  await assert.rejects(workContext(root));
  await rm(path.join(root, '.foundry/runtime.json'));
  await assert.rejects(workContext(root), /unmarked or legacy/);
});

test('CLI readers return one JSON value and a concise default without running checks', async (t) => {
  const root = await project(t);
  await start(root, 'cli-context', 'spec.md');
  await verify(root);
  const before = await files(root);
  const executable = path.resolve('dist/runtime/foundry.cjs');
  const cli = (...args: string[]) => spawnSync(process.execPath, [executable, 'work', 'context', '--project', root, ...args], {
    encoding: 'utf8', env: { ...process.env, FOUNDRY_SOURCE_ROOT: path.resolve('.') },
  });
  const one = cli('--json');
  const two = cli('--json');
  assert.equal(one.status, 0, one.stderr);
  assert.equal(two.status, 0, two.stderr);
  assert.equal(one.stdout, two.stdout);
  assert.equal(JSON.parse(one.stdout).evidence.status, 'current');
  const human = cli();
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /cli-context\nSaved progress: verified/);
  assert.doesNotMatch(human.stdout, /receipt_sha256|snapshot_revision|process.exit/);
  assert.equal(cli('--approve').status, 2);
  assert.deepEqual(await files(root), before);
});
