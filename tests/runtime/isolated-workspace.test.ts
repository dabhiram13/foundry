import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { link, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { ManagedSession } from '../../src/core/session-contract.js';
import { IsolatedWorkspace } from '../../src/runtime/isolated-workspace.js';
import { ManagedService } from '../../src/runtime/managed-service.js';
import { executableDigest } from '../../src/runtime/opencode.js';
import { approveScope, reviewScope, saveTaskPlan, start, workContext } from '../../src/core/lifecycle.js';

const image = process.env.FOUNDRY_WORKSPACE_QUALIFY_IMAGE;
if (process.env.FOUNDRY_WORKSPACE_QUALIFICATION === 'required' && !image) throw new Error('Docker workspace qualification needs a digest-pinned image');

async function setup(t: TestContext) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-isolated-'));
  const root = path.join(base, 'project');
  const storage = path.join(base, 'storage');
  await mkdir(root);
  await mkdir(storage, { mode: 0o700 });
  await writeFile(path.join(root, 'source.js'), 'console.log("old")\n');
  await writeFile(path.join(root, '.env'), 'SECRET=not-for-container\n');
  for (const name of ['.env.local', '.npmrc', '.netrc', 'private.pem', 'private.key', 'private.p12', 'private.pfx']) {
    await writeFile(path.join(root, name), 'private-not-for-container\n');
  }
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry', 'approval.json'), 'private project authority\n');
  const git = (args: string[]) => {
    const result = spawnSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git(['init', '-q']);
  git(['add', 'source.js', '.env', '.foundry/approval.json']);
  const session = { id: randomUUID(), state: { status: 'queued' } } as ManagedSession;
  const workspace = await IsolatedWorkspace.bind(root, storage, session);
  const cleanup: Array<() => Promise<void>> = [];
  t.after(async () => {
    try { await workspace.stop(); } catch { /* no resource was created, or status needs manual inspection */ }
    for (const close of cleanup) await close();
    await rm(base, { recursive: true, force: true });
  });
  return { root, storage, session, workspace, git, cleanup };
}

test('owner workspace needs a stopped or queued approved session and a local pinned image', async t => {
  const fixture = await setup(t);
  await assert.rejects(IsolatedWorkspace.bind(fixture.root, fixture.storage,
    { ...fixture.session, state: { status: 'running' } } as ManagedSession), /Pause and confirm/);
  for (const selection of ['node:24-bookworm-slim', 'node@sha256:123', 'node@sha256:' + 'f'.repeat(64) + '\n']) {
    await assert.rejects(fixture.workspace.open(selection));
  }
  await assert.rejects(lstat(path.join(fixture.storage, 'workspaces', fixture.session.id)), { code: 'ENOENT' });
});

test('inspection before open does not reserve an empty workspace directory', async t => {
  const fixture = await setup(t);
  for (const action of ['status', 'diff', 'stop', 'resume'] as const) {
    await assert.rejects(fixture.workspace[action]());
    await assert.rejects(lstat(path.join(fixture.storage, 'workspaces', fixture.session.id)), { code: 'ENOENT' });
  }
  if (image) assert.equal((await fixture.workspace.open(image)).phase, 'ready');
});

test('snapshot omits tracked working-tree deletions', { skip: !image }, async t => {
  const fixture = await setup(t);
  await writeFile(path.join(fixture.root, 'deleted.js'), 'deleted before the snapshot\n');
  fixture.git(['add', 'deleted.js']);
  await rm(path.join(fixture.root, 'deleted.js'));
  assert.equal((await fixture.workspace.open(image!)).files, 1);
  const result = await fixture.workspace.exec(['node', '-e', `const f=require('node:fs');
    if(f.existsSync('/workspace/deleted.js')) process.exit(2);
    process.stdout.write(f.readFileSync('/workspace/source.js','utf8'));`]);
  assert.equal(result.exitCode, 0, result.output);
  assert.equal(result.output, 'console.log("old")\n');
  await fixture.workspace.stop();
  assert.deepEqual(await fixture.workspace.diff(), []);
});

test('snapshot refuses a tracked symlink before creating a Docker resource', { skip: !image }, async t => {
  const fixture = await setup(t);
  await symlink('/etc/passwd', path.join(fixture.root, 'unsafe'));
  fixture.git(['add', 'unsafe']);
  await assert.rejects(fixture.workspace.open(image!), /symbolic|symlink|invalid-profile/i);
  const status = await fixture.workspace.status();
  assert.equal(status.record.phase, 'failed');
  assert.equal(status.containerPresent, false);
});

for (const kind of ['hardlink', 'oversized']) test(`snapshot refuses ${kind} files`, { skip: !image }, async t => {
  const fixture = await setup(t);
  if (kind === 'hardlink') await link(path.join(fixture.root, 'source.js'), path.join(fixture.root, 'unsafe'));
  else await writeFile(path.join(fixture.root, 'unsafe'), Buffer.alloc(1024 * 1024 + 1));
  await assert.rejects(fixture.workspace.open(image!), /small regular files/);
  assert.equal((await fixture.workspace.status()).containerPresent, false);
});

test('real container has no host authority, produces diff, preserves owner edits and confirms stop', { skip: !image }, async t => {
  const fixture = await setup(t);
  const sentinel = process.env.FOUNDRY_WORKSPACE_SENTINEL;
  process.env.FOUNDRY_WORKSPACE_SENTINEL = 'private-host-sentinel';
  t.after(() => { if (sentinel === undefined) delete process.env.FOUNDRY_WORKSPACE_SENTINEL; else process.env.FOUNDRY_WORKSPACE_SENTINEL = sentinel; });
  const record = await fixture.workspace.open(image!);
  assert.equal(record.phase, 'ready');
  assert.equal(record.files, 1);
  const inspected = spawnSync('/usr/bin/docker', ['inspect', '--format', '{{json .}}', `foundry-ws-${fixture.session.id}`], { encoding: 'utf8' });
  assert.equal(inspected.status, 0, inspected.stderr);
  const container = JSON.parse(inspected.stdout);
  assert.equal(container.Config.User, `${process.getuid!()}:${process.getgid!()}`);
  assert.deepEqual(container.Config.Entrypoint, ['node']);
  assert.deepEqual(container.Config.Cmd, ['-e', 'setInterval(() => {}, 60000)']);
  assert.equal(container.HostConfig.NetworkMode, 'none');
  assert.equal(container.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(container.HostConfig.CapDrop, ['ALL']);
  assert.ok(container.HostConfig.SecurityOpt.includes('no-new-privileges'));
  assert.equal(container.HostConfig.PidsLimit, 128);
  assert.equal(container.HostConfig.Memory, 512 * 1024 * 1024);
  assert.equal(container.HostConfig.NanoCpus, 1_000_000_000);
  assert.equal(container.Mounts.length, 1);
  assert.equal(container.Mounts[0].Destination, '/workspace');
  assert.notEqual(container.Mounts[0].Source, fixture.root);
  await assert.rejects(fixture.workspace.assertNotActive(), /Stop and inspect/);
  const blocked = await fixture.workspace.exec(['node', '-e', `const f=require('node:fs');
    for(const name of ['/workspace/.env','/workspace/.foundry/approval.json','/var/run/docker.sock', '/home/ubuntu/.ssh', '/host.txt'])
      {if(f.existsSync(name)) process.exit(2)}
    if(process.env.FOUNDRY_WORKSPACE_SENTINEL || process.getuid() === 0) process.exit(3);
    f.writeFileSync('/workspace/source.js','console.log("new")\\n');
    f.writeFileSync('/workspace/new.txt','new file\\n');`]);
  assert.equal(blocked.exitCode, 0, blocked.output);
  const network = await fixture.workspace.exec(['node', '-e', `const s=require('node:net').connect(443,'192.0.2.1');
    s.on('connect',()=>process.exit(2));s.on('error',e=>{console.log(e.code);process.exit(0)});setTimeout(()=>process.exit(3),1000);`]);
  assert.equal(network.exitCode, 0, network.output);
  assert.match(network.output, /ENETUNREACH/);
  assert.equal(await readFile(path.join(fixture.root, 'source.js'), 'utf8'), 'console.log("old")\n');
  await writeFile(path.join(fixture.root, 'source.js'), 'console.log("owner change")\n');
  await assert.rejects(fixture.workspace.diff(), /Confirm workspace stop/);
  await fixture.workspace.stop();
  const changes = await fixture.workspace.diff();
  assert.deepEqual(changes.map(change => [change.path, change.status]), [['new.txt', 'added'], ['source.js', 'modified']]);
  assert.match(changes[1]!.patch, /\+console.log\("new"\)/);
  assert.equal(await readFile(path.join(fixture.root, 'source.js'), 'utf8'), 'console.log("owner change")\n');
  assert.equal((await fixture.workspace.stop()).phase, 'stopped');
  assert.equal((await fixture.workspace.status()).containerPresent, false);
  await fixture.workspace.assertNotActive();
  assert.deepEqual((await fixture.workspace.diff()).map(change => change.path), ['new.txt', 'source.js']);
  assert.equal((await fixture.workspace.resume()).phase, 'ready');
  assert.equal((await fixture.workspace.exec(['node', '-e', `process.stdout.write(require('node:fs').readFileSync('/workspace/new.txt','utf8'))`])).output, 'new file\n');
});

test('bounded output and timeout stop all container work instead of returning a successful command', { skip: !image }, async t => {
  const fixture = await setup(t);
  await fixture.workspace.open(image!);
  await assert.rejects(fixture.workspace.exec(['node', '-e', 'process.stdout.write("x".repeat(100000))']), /output exceeded/);
  assert.equal((await fixture.workspace.status()).record.phase, 'stopped');
  assert.equal((await fixture.workspace.status()).containerPresent, false);
  await fixture.workspace.resume();
  await assert.rejects(fixture.workspace.exec(['node', '-e', 'setInterval(() => {},1000)'], 300), /timed out/);
  assert.equal((await fixture.workspace.status()).record.phase, 'stopped');
  assert.equal((await fixture.workspace.status()).containerPresent, false);
});

test('new symlink is never read or rendered in the diff', { skip: !image }, async t => {
  const fixture = await setup(t);
  await fixture.workspace.open(image!);
  const result = await fixture.workspace.exec(['node', '-e', `require('node:fs').symlinkSync('/etc/passwd','/workspace/unsafe')`]);
  assert.equal(result.exitCode, 0, result.output);
  await fixture.workspace.stop();
  await assert.rejects(fixture.workspace.diff(), /unsupported file/);
});

test('owner Stop interrupts an active terminal command and confirms resource removal', { skip: !image }, async t => {
  const fixture = await setup(t);
  await fixture.workspace.open(image!);
  const execution = fixture.workspace.exec(['node', '-e', 'setInterval(() => {},1000)']);
  const deadline = Date.now() + 5000;
  while ((await fixture.workspace.status()).record.phase !== 'executing') {
    assert.ok(Date.now() < deadline);
    await delay(20);
  }
  assert.equal((await fixture.workspace.stop()).phase, 'stopped');
  assert.notEqual((await execution).exitCode, 0);
  assert.equal((await fixture.workspace.status()).containerPresent, false);
});

for (const interruption of ['owner-stop', 'host-crash']) test(`approved managed owner CLI handles ${interruption} without replaying work`, { skip: !image }, async t => {
  const fixture = await setup(t);
  const runtime = path.resolve(process.env.FOUNDRY_MANAGED_TEST_RUNTIME ?? 'dist/runtime');
  await writeFile(path.join(fixture.root, '.foundry/runtime.json'), JSON.stringify({ schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: 'fixture', source_pin: 'a'.repeat(64) }));
  await writeFile(path.join(fixture.root, '.foundry/roles.json'), await readFile('.foundry/roles.json'));
  await writeFile(path.join(fixture.root, '.foundry/project.json'), JSON.stringify({ name: 'Isolated owner test', checks: [{ name: 'behavior', command: ['./check.cjs'], inputs: ['source.js', 'check.cjs'] }] }));
  await writeFile(path.join(fixture.root, 'check.cjs'), `#!${process.execPath}\nconsole.log('checked');\n`, { mode: 0o700 });
  await writeFile(path.join(fixture.root, 'spec.md'), '# Workspace\nExercise isolated owner terminal.');
  await writeFile(path.join(fixture.root, 'scope.json'), JSON.stringify({ schema_version: 1, criteria: [{ id: 'ISO-01', requirement: 'Owner terminal is isolated', checks: ['behavior'] }] }));
  await start(fixture.root, 'isolation', 'spec.md', 'scope.json');
  await saveTaskPlan(fixture.root, { planner_role: 'planner', reviewer_role: 'quality-gate', tasks: [
    { id: 'ISO', title: 'Owner workspace', instructions: 'Preserve owner files.', role: 'ts-expert', criteria: ['ISO-01'], depends_on: [] },
  ] }, (await workContext(fixture.root)).snapshot_revision);
  const service = await ManagedService.open(fixture.root, fixture.storage, runtime);
  fixture.cleanup.push(() => service.close());
  const profile = { schemaVersion: 1, id: randomUUID(), consentRef: randomUUID(), boundary: 'trusted-local-disposable', inference: 'local-test-only',
    binary: process.execPath, binaryDigest: await executableDigest(process.execPath), provider: { id: 'local-test', model: 'test-model', baseURL: 'http://127.0.0.1:12345/v1' },
    permissions: 'read-edit-shell', maxTurns: 2, maxSteps: 4, deadlineMs: 5000 };
  await assert.rejects(service.start(profile, randomUUID()), /approv/);
  await approveScope(fixture.root, (await reviewScope(fixture.root)).revision);
  const session = await service.start(profile, randomUUID());
  const workspace = await IsolatedWorkspace.bind(fixture.root, fixture.storage, session);
  fixture.cleanup.unshift(async () => { await workspace.stop(); });
  const cli = (...args: string[]) => [path.join(runtime, 'foundry.cjs'), 'workspace', ...args, '--project', fixture.root, '--storage', fixture.storage, '--json'];
  const opened = spawnSync(process.execPath, cli('open', '--image', image!), { encoding: 'utf8' });
  assert.equal(opened.status, 0, opened.stderr);
  await assert.rejects(service.run(profile), /Stop and inspect/);
  const child = spawn(process.execPath, [...cli('exec'), '--', 'node', '-e', 'setInterval(() => {},1000)'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  t.after(() => { child.kill('SIGKILL'); });
  let error = '';
  child.stderr.on('data', chunk => { error += String(chunk); });
  const deadline = Date.now() + 10_000;
  while ((await workspace.status()).record.phase !== 'executing') {
    assert.ok(Date.now() < deadline, error);
    await delay(25);
  }
  if (interruption === 'host-crash') {
    child.kill('SIGKILL');
    await exited;
    assert.equal((await workspace.status()).record.phase, 'executing');
    assert.equal((await workspace.status()).containerPresent, true);
    await assert.rejects(workspace.exec(['node', '--version']), /not ready/);
  } else {
    const status = spawnSync(process.execPath, cli('status'), { encoding: 'utf8', timeout: 5000 });
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).record.phase, 'executing');
  }
  const stopped = spawnSync(process.execPath, cli('stop'), { encoding: 'utf8' });
  assert.equal(stopped.status, 0, stopped.stderr);
  await exited;
  assert.equal(JSON.parse(stopped.stdout).phase, 'stopped');
  assert.equal((await workspace.status()).containerPresent, false);
  assert.equal((await service.status()).state.status, 'queued');
  assert.equal(await readFile(path.join(fixture.root, 'source.js'), 'utf8'), 'console.log("old")\n');
});
