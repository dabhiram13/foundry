import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
