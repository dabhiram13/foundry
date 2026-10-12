import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { install } from '../../src/core/install.js';
import { projectConfig, setupChecks, start } from '../../src/core/lifecycle.js';

async function project(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-check-setup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({ schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: '2026-01-01', source_pin: 'a'.repeat(64) }));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'fixture', checks: [], owner: { keep: true } }));
  return root;
}
async function scripts(root: string, packageManager?: string) {
  await writeFile(path.join(root, 'package.json'), JSON.stringify({
    ...(packageManager ? { packageManager } : {}),
    scripts: { test: 'node --test app.test.mjs', build: 'node build.mjs', lint: 'node lint.mjs' },
  }));
  await writeFile(path.join(root, 'app.test.mjs'), "import { test } from 'node:test'; test('example', () => {});\n");
}

test('empty projects initialize without src/test folders and never invent passing checks', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-setup-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await install(path.resolve('.'), root);
  const before = await readFile(path.join(root, '.foundry/project.json'), 'utf8');
  const proposal = await setupChecks(root, 'dry-run');
  assert.equal(proposal.status, 'needs_scripts');
  assert.deepEqual(proposal.checks, []);
  assert.deepEqual(await readdir(root), ['.foundry']);
  await assert.rejects(setupChecks(root, 'apply', proposal.revision), /real test or build scripts/);
  assert.equal(await readFile(path.join(root, '.foundry/project.json'), 'utf8'), before);
});

test('preview is read-only and apply saves only existing inputs and preserves owner settings', async t => {
  const root = await project(t);
  await scripts(root);
  await mkdir(path.join(root, 'lib'));
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "require(\'fs\').writeFileSync(\'executed\', \'yes\')"', build: 'node build.mjs' } }));
  const before = await readFile(path.join(root, '.foundry/project.json'), 'utf8');
  const directories = await readdir(root);
  const proposal = await setupChecks(root, 'dry-run');
  assert.equal(proposal.status, 'proposed');
  assert.equal(await readFile(path.join(root, '.foundry/project.json'), 'utf8'), before);
  assert.deepEqual(await readdir(root), directories);
  assert.deepEqual(proposal.checks.map(check => check.name), ['test', 'build']);
  assert.deepEqual(proposal.checks[0]?.inputs, ['app.test.mjs', 'lib', 'package.json']);
  assert.equal((await setupChecks(root, 'apply', proposal.revision)).applied, true);
  const config = await projectConfig(root);
  assert.deepEqual(config.owner, { keep: true });
  assert.deepEqual(config.checks, proposal.checks);
  await assert.rejects(readFile(path.join(root, 'executed')), { code: 'ENOENT' });
});

test('setup honors supported package managers and lockfile selection', async t => {
  for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) {
    const root = await project(t);
    await scripts(root, `${manager}@1.0.0`);
    assert.deepEqual((await setupChecks(root, 'dry-run')).checks[0]?.command, [manager, 'run', 'test']);
  }
  for (const [file, manager] of [['package-lock.json', 'npm'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun']]) {
    const root = await project(t);
    await scripts(root);
    await writeFile(path.join(root, file!), 'fixture');
    assert.equal((await setupChecks(root, 'dry-run')).checks[0]?.command[0], manager);
  }
});

test('ambiguous or unsupported managers and placeholder scripts do not produce checks', async t => {
  const root = await project(t);
  await scripts(root);
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'fixture');
  await writeFile(path.join(root, 'yarn.lock'), 'fixture');
  let proposal = await setupChecks(root, 'dry-run');
  assert.equal(proposal.status, 'needs_scripts');
  await assert.rejects(setupChecks(root, 'apply', proposal.revision), /Multiple package managers/);
  await scripts(root, 'unknown@1.0.0');
  assert.equal((await setupChecks(root, 'dry-run')).status, 'needs_scripts');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'npm@11', scripts: { test: 'echo "Error: no test specified" && exit 1', lint: 'node lint.mjs' } }));
  assert.equal((await setupChecks(root, 'dry-run')).status, 'needs_scripts');
  for (const command of ['true', 'exit 0', 'echo fine']) {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: command } }));
    assert.equal((await setupChecks(root, 'dry-run')).status, 'needs_scripts');
  }
});

test('existing owner check configuration is preserved byte-for-byte', async t => {
  const root = await project(t);
  const saved = '{\n "name": "owner", "checks": [{"name":"custom","command":["owner-tool"],"inputs":["owned"]}]\n}\n';
  await writeFile(path.join(root, '.foundry/project.json'), saved);
  const proposal = await setupChecks(root, 'dry-run');
  assert.equal(proposal.status, 'existing');
  assert.equal((await setupChecks(root, 'apply', proposal.revision)).applied, false);
  assert.equal(await readFile(path.join(root, '.foundry/project.json'), 'utf8'), saved);
});

test('changed package scripts, inputs or settings reject stale proposals without writes', async t => {
  for (const change of ['package', 'inputs', 'settings']) {
    const root = await project(t);
    await scripts(root);
    const proposal = await setupChecks(root, 'dry-run');
    if (change === 'package') await scripts(root, 'pnpm@10');
    if (change === 'inputs') await mkdir(path.join(root, 'src'));
    if (change === 'settings') await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'changed', checks: [] }));
    const before = await readFile(path.join(root, '.foundry/project.json'), 'utf8');
    await assert.rejects(setupChecks(root, 'apply', proposal.revision), /stale/);
    assert.equal(await readFile(path.join(root, '.foundry/project.json'), 'utf8'), before);
  }
});

test('setup refuses symlinked inputs and malformed manifests', async t => {
  const root = await project(t);
  await scripts(root);
  await symlink('app.test.mjs', path.join(root, 'linked'));
  await assert.rejects(setupChecks(root, 'dry-run'), /Symlink/);
  await rm(path.join(root, 'linked'));
  await writeFile(path.join(root, 'package.json'), '{invalid');
  await assert.rejects(setupChecks(root, 'dry-run'));
  assert.deepEqual((await projectConfig(root)).checks, []);
});

test('active scoped work prevents setup from altering checks', async t => {
  const root = await project(t);
  await scripts(root);
  const proposal = await setupChecks(root, 'dry-run');
  await setupChecks(root, 'apply', proposal.revision);
  await writeFile(path.join(root, 'spec.md'), '# Change\n');
  await start(root, 'fixture', 'spec.md');
  const existing = await setupChecks(root, 'dry-run');
  const before = await readFile(path.join(root, '.foundry/project.json'), 'utf8');
  await assert.rejects(setupChecks(root, 'apply', existing.revision), /during active work/);
  assert.equal(await readFile(path.join(root, '.foundry/project.json'), 'utf8'), before);
});

test('CLI requires an explicit mode and preview revision before applying setup', async t => {
  const root = await project(t);
  await scripts(root);
  const executable = path.resolve('dist/runtime/foundry.cjs');
  const run = (...args: string[]) => spawnSync(process.execPath, [executable, 'setup', '--project', root, ...args], { encoding: 'utf8' });
  const preview = run('--dry-run', '--json');
  assert.equal(preview.status, 0, preview.stderr);
  const proposal = JSON.parse(preview.stdout) as { revision: string };
  for (const args of [[], ['--apply'], ['--apply', '--dry-run'], ['--dry-run', '--revision', proposal.revision]]) {
    assert.equal(run(...args).status, 2);
  }
  const applied = run('--apply', '--revision', proposal.revision, '--json');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).applied, true);
});
