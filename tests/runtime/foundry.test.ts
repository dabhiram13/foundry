import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { digest } from '../../src/core/fs.js';
import { ProjectService } from '../../src/core/projects.js';
import { readFactoryState, writeFactoryState } from '../../src/core/factory-contract.js';
import { runCommand } from '../../src/cli/foundry.js';

const sourceRoot = path.resolve('.');
const executable = path.join(sourceRoot, 'dist/runtime/foundry.cjs');

function runCli(arguments_: string[], home: string) {
  return spawnSync(process.execPath, [executable, ...arguments_], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, FOUNDRY_SOURCE_ROOT: sourceRoot },
  });
}

test('CLI review prints the exact revision and document, JSON stays clean, and stale approval is refused', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-cli-review-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const products = path.join(base, 'products');
  const service = new ProjectService(sourceRoot, products);
  const created = await service.create({
    name: 'Review Fixture',
    idea: 'A local fixture for exact review output.',
    adapter: 'codex',
  });
  const project = String(created.path);
  const planPath = path.join(project, 'docs/specs/product.md');
  const plan = '# Review plan\n\n## Acceptance criteria\n- [AC-001] Show exact review text.\n';
  await mkdir(path.dirname(planPath), { recursive: true });
  await writeFile(planPath, plan);
  const controller = await readFactoryState(project);
  assert.ok(controller);
  controller.stage = 'scope';
  controller.status = 'awaiting_approval';
  controller.documents.plan = digest(Buffer.from(plan));
  await writeFactoryState(project, controller);

  const human = runCli(['review', '--project', project], base);
  assert.equal(human.status, 0, human.stderr);
  const revision = digest(Buffer.from(plan));
  assert.equal(
    human.stdout,
    `Plan — docs/specs/product.md\nRevision: ${revision}\n\n${plan}\n`,
  );

  const json = runCli(['review', '--project', project, '--json'], base);
  assert.equal(json.status, 0, json.stderr);
  assert.equal(json.stderr, '');
  assert.deepEqual(JSON.parse(json.stdout), {
    stage: 'plan',
    label: 'Plan',
    path: 'docs/specs/product.md',
    revision,
    criteria: [{ id: 'AC-001', expected: 'Show exact review text.' }],
    text: plan,
  });

  await writeFile(planPath, `${plan}\nOwner edit after review.\n`);
  const staleApproval = runCli([
    'approve', '--project', project, '--revision', revision,
  ], base);
  assert.equal(staleApproval.status, 2);
  assert.match(staleApproval.stderr, /document changed; reopen factory review/);
  const persisted = await readFile(planPath, 'utf8');
  assert.match(persisted, /Owner edit after review/);
});

test('terminal approval requires the exact revision displayed in that terminal', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-terminal-review-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const products = path.join(base, 'products');
  const service = new ProjectService(sourceRoot, products);
  const created = await service.create({
    name: 'Terminal Review Fixture',
    idea: 'Bind terminal approval to the displayed revision.',
    adapter: 'codex',
  });
  const project = String(created.path);
  const identifier = String(created.id);
  const planPath = path.join(project, 'docs/specs/product.md');
  const plan = '# Terminal review\n\n## Acceptance criteria\n- [AC-001] Bind approval to the reviewed document.\n';
  await mkdir(path.dirname(planPath), { recursive: true });
  await writeFile(planPath, plan);
  const controller = await readFactoryState(project);
  assert.ok(controller);
  controller.stage = 'scope';
  controller.status = 'awaiting_approval';
  controller.documents.plan = digest(Buffer.from(plan));
  await writeFactoryState(project, controller);
  const revision = digest(Buffer.from(plan));

  assert.equal(await runCommand(['review', identifier, '--products-dir', products], true), 0);
  await assert.rejects(
    runCommand(['approve', identifier, '--revision', 'f'.repeat(64), '--products-dir', products], true),
    /Approval must match the revision displayed in this terminal/,
  );
  assert.equal(await runCommand(['approve', identifier, '--revision', revision, '--products-dir', products], true), 0);
});

test('init installs into an existing repository without changing Git history or owner documents', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-cli-init-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const project = path.join(base, 'owner-repository');
  const readme = '# Existing owner project\n';
  await mkdir(path.join(project, '.git'), { recursive: true });
  await mkdir(path.join(project, 'docs'), { recursive: true });
  await writeFile(path.join(project, 'README.md'), readme);

  const initialized = runCli(['init', '--project', project, '--json'], base);

  assert.equal(initialized.status, 0, initialized.stderr);
  assert.equal(JSON.parse(initialized.stdout).target, project);
  assert.equal(await readFile(path.join(project, 'README.md'), 'utf8'), readme);
  assert.deepEqual(await readdir(path.join(project, '.git')), []);
  assert.equal(JSON.parse(await readFile(path.join(project, '.foundry/project.json'), 'utf8')).name, 'owner-repository');
  assert.equal(JSON.parse(await readFile(path.join(project, '.foundry/runtime.json'), 'utf8')).runtime, 'typescript');

  const recovery = runCli(['migrate', '--project', project, '--apply', '--recover', '--json'], base);
  assert.equal(recovery.status, 2);
  assert.match(recovery.stderr, /No interrupted migration journal is present/);
});

test('init --recover resumes a pending install without legacy migration permission', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-cli-init-recover-'));
  const project = path.join(base, 'owner-repository');
  const runtimeDirectory = path.join(project, '.foundry/runtime');
  t.after(async () => {
    await chmod(runtimeDirectory, 0o700).catch(() => {});
    await rm(base, { recursive: true, force: true });
  });
  await mkdir(project);
  const initialized = runCli(['init', '--project', project], base);
  assert.equal(initialized.status, 0, initialized.stderr);

  await chmod(runtimeDirectory, 0o500);
  const interrupted = runCli(['init', '--project', project, '--update'], base);
  assert.notEqual(interrupted.status, 0);
  await chmod(runtimeDirectory, 0o700);
  assert.equal(existsSync(path.join(project, '.foundry/install-pending.json')), true);

  const recovered = runCli(['init', '--project', project, '--recover', '--update', '--json'], base);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(JSON.parse(recovered.stdout).recovered, true);
  assert.equal(existsSync(path.join(project, '.foundry/install-pending.json')), false);
});

test('init refuses unmarked Foundry data and command options are validated before mutation', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-cli-validation-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const legacy = path.join(base, 'legacy-repository');
  await mkdir(path.join(legacy, '.foundry'), { recursive: true });
  await writeFile(path.join(legacy, '.foundry/project.json'), '{"schema_version":1}\n');

  const init = runCli(['init', '--project', legacy], base);
  assert.equal(init.status, 2);
  assert.match(init.stderr, /unmarked Foundry workspace/);
  assert.equal(existsSync(path.join(legacy, '.foundry/runtime.json')), false);

  const products = path.join(base, 'products');
  const ignoredFlag = runCli([
    'new', 'Must Not Exist', '--idea', 'Parser errors must precede service mutation.',
    '--products-dir', products, '--confirmed',
  ], base);
  assert.equal(ignoredFlag.status, 2);
  assert.match(ignoredFlag.stderr, /--confirmed is not valid for new/);
  assert.equal(existsSync(products), false);

  const extraPosition = runCli(['status', 'one', 'two', '--products-dir', products], base);
  assert.equal(extraPosition.status, 2);
  assert.match(extraPosition.stderr, /accepts at most 1 positional argument/);
  assert.equal(existsSync(products), false);
});

test('work verify and complete return one useful JSON result on runtime errors', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-cli-json-work-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const project = path.join(base, 'unmarked');
  await mkdir(path.join(project, '.foundry'), { recursive: true });
  await writeFile(path.join(project, '.foundry/project.json'), '{"name":"Legacy fixture","checks":[]}\n');

  for (const command of ['verify', 'complete']) {
    const result = runCli(['work', command, '--project', project, '--json'], base);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      command,
      status: 'failed',
      exit_code: 2,
      error: `Cannot ${command} an unmarked or legacy workspace. Inspect it with foundry migrate --project PATH --dry-run before applying an explicit migration.`,
    });
  }
});

test('work verify and complete return saved nested status in successful JSON results', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-cli-json-success-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const project = path.join(base, 'typed-workspace');
  await mkdir(project);
  const initialized = runCli(['init', '--project', project], base);
  assert.equal(initialized.status, 0, initialized.stderr);
  const specPath = path.join(project, 'docs/specs/product.md');
  await mkdir(path.dirname(specPath), { recursive: true });
  await writeFile(specPath, '# Local work\n');
  await writeFile(path.join(project, '.foundry/project.json'), JSON.stringify({
    name: 'Typed Workspace',
    checks: [{
      name: 'behavior',
      command: [process.execPath, '-e', 'process.stdout.write("ok")'],
      inputs: ['docs/specs/product.md'],
      timeout: 10,
      required: true,
    }],
  }));

  const started = runCli([
    'work', 'start', 'local-fix', '--spec', 'docs/specs/product.md', '--project', project, '--json',
  ], base);
  assert.equal(started.status, 0, started.stderr);
  assert.equal(JSON.parse(started.stdout).status, 'building');

  const verified = runCli(['work', 'verify', '--project', project, '--json'], base);
  assert.equal(verified.status, 0, verified.stderr);
  const verifyResult = JSON.parse(verified.stdout);
  assert.equal(verifyResult.command, 'verify');
  assert.equal(verifyResult.status, 'verified');
  assert.equal(verifyResult.exit_code, 0);
  assert.equal(verifyResult.result.active.status, 'verified');
  assert.ok(verifyResult.result.active.verification);

  const completed = runCli(['work', 'complete', '--project', project, '--json'], base);
  assert.equal(completed.status, 0, completed.stderr);
  const completeResult = JSON.parse(completed.stdout);
  assert.equal(completeResult.command, 'complete');
  assert.equal(completeResult.status, 'completed');
  assert.equal(completeResult.exit_code, 0);
  assert.ok(completeResult.completed_run_id);
  assert.deepEqual(completeResult.result.active, { status: 'idle' });
});

test('work and provider subcommands reuse the scoped Node contracts without starting provider work', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-cli-scoped-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const service = new ProjectService(sourceRoot, path.join(base, 'products'));
  const created = await service.create({
    name: 'Scoped Fixture',
    idea: 'Exercise safe scoped commands.',
    adapter: 'codex',
  });
  const project = String(created.path);

  const work = runCli(['work', 'status', '--project', project, '--json'], base);
  assert.equal(work.status, 0, work.stderr);
  assert.deepEqual(JSON.parse(work.stdout), {
    runtime_owner: 'typescript',
    active: { status: 'idle' },
  });

  const providers = runCli(['provider', '--project', project, '--json'], base);
  assert.equal(providers.status, 0, providers.stderr);
  assert.ok(JSON.parse(providers.stdout).codex);

  const tasks = runCli(['provider', 'status', '--project', project, '--json'], base);
  assert.equal(tasks.status, 0, tasks.stderr);
  assert.deepEqual(JSON.parse(tasks.stdout), []);
});
