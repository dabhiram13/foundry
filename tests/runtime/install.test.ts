import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, chown, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { install, installWorkspace, sharedInstallGuardPath } from '../../src/core/install.js';
import { migrateWorkspace } from '../../src/core/migrate.js';
import { readRuntimeMarker } from '../../src/core/lifecycle.js';

test('installed runtime is copied and usable without Python', async (t) => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-install-'));
  const source = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-install-source-'));
  t.after(async () => {
    await Promise.all([rm(source, { recursive: true, force: true }), rm(target, { recursive: true, force: true })]);
  });
  for (const file of ['dist/runtime/foundry.cjs', 'dist/runtime/foundry-worker.cjs', '.foundry/roles.json']) {
    await mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await copyFile(path.resolve(file), path.join(source, file));
  }
  const result = await install(source, target);
  assert.equal(result.target, target);
  assert.equal((await readRuntimeMarker(target))?.runtime, 'typescript');
  const project = JSON.parse(await readFile(path.join(target, '.foundry/project.json'), 'utf8')) as { name: string };
  assert.equal(project.name, path.basename(target));
  const runtime = await readFile(path.join(target, '.foundry/runtime/foundry.cjs'), 'utf8');
  assert.equal(runtime, await readFile(path.join(source, 'dist/runtime/foundry.cjs'), 'utf8'));
  assert.match(runtime, /Foundry - plan, build and check work with your coding tool/);
  assert.deepEqual((await readdir(path.join(target, '.foundry/runtime'))).sort(), ['foundry-worker.cjs', 'foundry.cjs'].sort());
  const child = spawnSync(process.execPath, [path.join(target, '.foundry/runtime/foundry.cjs'), '--help'], {
    encoding: 'utf8',
    env: { PATH: path.dirname(process.execPath), HOME: os.tmpdir() },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /foundry work start\|status\|context\|review\|approve\|verify\|complete\|pause\|resume\|recover/);
  const guidance = spawnSync(process.execPath, [path.join(target, '.foundry/runtime/foundry.cjs'), 'work', 'workflow', 'guide'], {
    cwd: target,
    encoding: 'utf8',
    env: { PATH: path.dirname(process.execPath), HOME: os.tmpdir() },
  });
  assert.equal(guidance.status, 0, guidance.stderr);
  assert.match(guidance.stdout, /scope/);
  const noConsent = spawnSync(process.execPath, [
    path.join(target, '.foundry/runtime/foundry.cjs'),
    'provider', 'run', '--adapter', 'codex', '--prompt', 'test', '--billing', 'api',
  ], {
    cwd: target,
    encoding: 'utf8',
    env: { PATH: path.dirname(process.execPath), HOME: os.tmpdir() },
  });
  assert.equal(noConsent.status, 2, noConsent.stderr);
  assert.match(noConsent.stderr, /API billing requires explicit consent/);
  await writeFile(path.join(target, '.foundry/provider-request.json'), JSON.stringify({
    adapter: 'codex',
    prompt: 'test',
    billing: { mode: 'api', allow_api: true },
  }));
  const requestFile = spawnSync(process.execPath, [
    path.join(target, '.foundry/runtime/foundry.cjs'),
    'provider', 'run', '--request', '.foundry/provider-request.json',
  ], {
    cwd: target,
    encoding: 'utf8',
    env: { PATH: path.dirname(process.execPath), HOME: os.tmpdir() },
  });
  assert.equal(requestFile.status, 2, requestFile.stderr);
  assert.match(requestFile.stderr, /API billing requires explicit consent/);
  const savedProject = '{\n  "name": "owner project",\n  "checks": []\n}\n';
  await writeFile(path.join(target, '.foundry/project.json'), savedProject);
  await install(source, target, true);
  assert.equal(await readFile(path.join(target, '.foundry/project.json'), 'utf8'), savedProject);
});

test('installer refuses to claim an unmarked legacy workspace', async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-legacy-'));
  await mkdir(path.join(target, '.foundry'), { recursive: true });
  const projectPath = path.join(target, '.foundry/project.json');
  const savedProject = '{"name":"legacy","checks":[]}\n';
  await writeFile(projectPath, savedProject);
  await assert.rejects(install(path.resolve('.'), target), /unmarked or legacy workspace/);
  assert.equal(await readFile(projectPath, 'utf8'), savedProject);
});

test('installer preserves unclaimed files at managed target paths', async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-conflict-'));
  await mkdir(path.join(target, '.foundry'), { recursive: true });
  const rolesPath = path.join(target, '.foundry/roles.json');
  const savedRoles = '{"roles":"owner-authored"}\n';
  await writeFile(rolesPath, savedRoles);
  await assert.rejects(install(path.resolve('.'), target), /Managed target conflict/);
  assert.equal(await readFile(rolesPath, 'utf8'), savedRoles);
});

test('installer rejects symlinked managed source ancestors during preflight', async () => {
  for (const ancestor of ['dist', '.foundry']) {
    const source = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-source-link-'));
    const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-source-link-target-'));
    if (ancestor === 'dist') {
      const realDist = path.join(source, 'real-dist');
      await mkdir(path.join(source, '.foundry'), { recursive: true });
      await mkdir(path.join(realDist, 'runtime'), { recursive: true });
      await writeFile(path.join(source, '.foundry/roles.json'), '{}\n');
      await writeFile(path.join(realDist, 'runtime/foundry.cjs'), '#!/usr/bin/env node\n');
      await writeFile(path.join(realDist, 'runtime/foundry-worker.cjs'), '#!/usr/bin/env node\n');
      await symlink(realDist, path.join(source, 'dist'), 'dir');
    } else {
      const realFoundry = path.join(source, 'real-foundry');
      await mkdir(path.join(source, 'dist/runtime'), { recursive: true });
      await mkdir(realFoundry, { recursive: true });
      await writeFile(path.join(source, 'dist/runtime/foundry.cjs'), '#!/usr/bin/env node\n');
      await writeFile(path.join(source, 'dist/runtime/foundry-worker.cjs'), '#!/usr/bin/env node\n');
      await writeFile(path.join(realFoundry, 'roles.json'), '{}\n');
      await symlink(realFoundry, path.join(source, '.foundry'), 'dir');
    }
    await assert.rejects(install(source, target), /symlink/i);
    assert.deepEqual(await readdir(target), []);
  }
});

test('an interrupted installation refuses ordinary retries and finishes under explicit recovery', async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-pending-'));
  const source = path.resolve('.');
  await install(source, target);
  const manifest = JSON.parse(await readFile(path.join(target, '.foundry/install.json'), 'utf8')) as {
    source_pin: string; files: Record<string, string>;
  };
  const marker = JSON.parse(await readFile(path.join(target, '.foundry/runtime.json'), 'utf8')) as { installed_at: string };
  await writeFile(path.join(target, '.foundry/install-pending.json'), JSON.stringify({
    schema_version: 1,
    runtime: 'typescript',
    runtime_version: '1',
    started_at: new Date().toISOString(),
    installed_at: marker.installed_at,
    source_pin: manifest.source_pin,
    incoming: manifest.files,
    previous: {},
    update: false,
  }));
  const copiedRuntime = path.join(target, '.foundry/runtime/foundry.cjs');
  const savedRuntime = await readFile(copiedRuntime, 'utf8');
  await rm(copiedRuntime);
  await assert.rejects(install(source, target, true), /interrupted installation blocks this target/);
  await assert.rejects(readFile(copiedRuntime, 'utf8'));
  const recovered = await installWorkspace(source, target, true, true);
  assert.equal(recovered.recovered, true);
  assert.equal(await readFile(copiedRuntime, 'utf8'), savedRuntime);
  await assert.rejects(readFile(path.join(target, '.foundry/install-pending.json'), 'utf8'));
});

test('recovery refuses owner-modified managed bytes and preserves them', async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-recover-conflict-'));
  const source = path.resolve('.');
  await install(source, target);
  const manifest = JSON.parse(await readFile(path.join(target, '.foundry/install.json'), 'utf8')) as {
    source_pin: string; files: Record<string, string>;
  };
  const marker = JSON.parse(await readFile(path.join(target, '.foundry/runtime.json'), 'utf8')) as { installed_at: string };
  const rolesPath = path.join(target, '.foundry/roles.json');
  const ownerBytes = '{"roles":"owner-edited"}\n';
  await writeFile(rolesPath, ownerBytes);
  await writeFile(path.join(target, '.foundry/install-pending.json'), JSON.stringify({
    schema_version: 1,
    runtime: 'typescript',
    runtime_version: '1',
    started_at: new Date().toISOString(),
    installed_at: marker.installed_at,
    source_pin: manifest.source_pin,
    incoming: manifest.files,
    previous: {},
    update: false,
  }));
  await assert.rejects(installWorkspace(source, target, true, true), /refuses modified bytes/);
  assert.equal(await readFile(rolesPath, 'utf8'), ownerBytes);
});

test('recovery refuses an owner-deleted previously managed file', async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-recover-deletion-'));
  const source = path.resolve('.');
  await install(source, target);
  const manifest = JSON.parse(await readFile(path.join(target, '.foundry/install.json'), 'utf8')) as {
    source_pin: string; files: Record<string, string>;
  };
  const marker = JSON.parse(await readFile(path.join(target, '.foundry/runtime.json'), 'utf8')) as { installed_at: string };
  const rolesPath = path.join(target, '.foundry/roles.json');
  await rm(rolesPath);
  await writeFile(path.join(target, '.foundry/install-pending.json'), JSON.stringify({
    schema_version: 1,
    runtime: 'typescript',
    runtime_version: '1',
    started_at: new Date().toISOString(),
    installed_at: marker.installed_at,
    source_pin: manifest.source_pin,
    incoming: manifest.files,
    previous: manifest.files,
    update: true,
  }));
  await assert.rejects(installWorkspace(source, target, true, true), /missing previously managed file/);
  await assert.rejects(readFile(rolesPath, 'utf8'));
});

test('recovery refuses a source pin different from the interrupted transaction', async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-recover-pin-'));
  const source = path.resolve('.');
  await install(source, target);
  const manifest = JSON.parse(await readFile(path.join(target, '.foundry/install.json'), 'utf8')) as {
    source_pin: string; files: Record<string, string>;
  };
  const marker = JSON.parse(await readFile(path.join(target, '.foundry/runtime.json'), 'utf8')) as { installed_at: string };
  await writeFile(path.join(target, '.foundry/install-pending.json'), JSON.stringify({
    schema_version: 1,
    runtime: 'typescript',
    runtime_version: '1',
    started_at: new Date().toISOString(),
    installed_at: marker.installed_at,
    source_pin: 'f'.repeat(64),
    incoming: manifest.files,
    previous: {},
    update: false,
  }));
  await assert.rejects(installWorkspace(source, target, true, true), /pinned source/);
});

test('install manifests with unsupported formats are refused', async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-manifest-'));
  const source = path.resolve('.');
  await install(source, target);
  const manifestPath = path.join(target, '.foundry/install.json');
  const original = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  const invalidCases = [
    { ...original, schema_version: 2 },
    { ...original, runtime: 'python' },
    { ...original, runtime_version: 'future' },
    { ...original, files: { '.foundry/roles.json': 'not-a-hash' } },
  ];
  for (const invalid of invalidCases) {
    await writeFile(manifestPath, JSON.stringify(invalid));
    await assert.rejects(install(source, target, true), /unsupported format/);
  }
});

test('CLI rejects unknown options, missing values, and boolean values before dispatch', () => {
  const cli = path.resolve('dist/runtime/foundry.cjs');
  for (const args of [
    ['status', '--timeout', '5'],
    ['status', '--project'],
    ['install', '--source', '.', '--target', '/tmp/foundry-cli-unused', '--update', 'false'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
  }
});

async function withHome<T>(action: (home: string) => Promise<T>): Promise<T> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-lock-home-'));
  const saved = process.env.HOME;
  process.env.HOME = home;
  try {
    return await action(home);
  } finally {
    if (saved === undefined) delete process.env.HOME;
    else process.env.HOME = saved;
  }
}

test('install guards live in a private per-user lock directory', async () => {
  await withHome(async (home) => {
    const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-guard-'));
    const guard = sharedInstallGuardPath(target);
    assert.equal(path.dirname(guard), path.join(home, '.foundry/locks'));
    assert.equal(guard.startsWith(`${os.tmpdir()}${path.sep}product-foundry-install-`), false);
    if (process.platform !== 'win32') assert.equal((await stat(path.dirname(guard))).mode & 0o777, 0o700);
    await install(path.resolve('.'), target);
    await assert.rejects(stat(guard), { code: 'ENOENT' });
  });
});

test('install and migrate fail closed on a symlinked guard without deleting its target', async () => {
  await withHome(async () => {
    const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-guard-link-'));
    const victim = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-guard-victim-'));
    await writeFile(path.join(victim, 'keep.txt'), 'keep');
    await writeFile(path.join(victim, 'owner.json'), JSON.stringify({ pid: 2 ** 31 - 1, token: 'dead-owner' }));
    await symlink(victim, sharedInstallGuardPath(target), 'dir');
    await assert.rejects(install(path.resolve('.'), target), /Symlink paths are not allowed/);
    await assert.rejects(migrateWorkspace(target, path.resolve('.'), 'dry-run'), /Symlink paths are not allowed/);
    assert.deepEqual(await readdir(target), []);
    assert.deepEqual((await readdir(victim)).sort(), ['keep.txt', 'owner.json']);
  });
});

test('install refuses a lock directory other users can write', { skip: process.platform === 'win32' }, async () => {
  await withHome(async (home) => {
    const locks = path.join(home, '.foundry/locks');
    await mkdir(locks, { recursive: true });
    await chmod(locks, 0o777);
    const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-guard-shared-'));
    await assert.rejects(install(path.resolve('.'), target), /must be owned by this user and private/);
    assert.deepEqual(await readdir(target), []);
  });
});

test('install fails closed on a foreign-owned dead guard without deleting it', {
  skip: process.getuid?.() !== 0 && 'creating a foreign-owned guard requires root',
}, async () => {
  await withHome(async () => {
    const target = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-guard-foreign-'));
    const guard = sharedInstallGuardPath(target);
    await mkdir(path.join(guard, 'nested'), { recursive: true });
    await writeFile(path.join(guard, 'nested/keep.txt'), 'keep');
    await writeFile(path.join(guard, 'owner.json'), JSON.stringify({ pid: 2 ** 31 - 1, token: 'dead-owner' }));
    for (const entry of [guard, path.join(guard, 'nested'), path.join(guard, 'nested/keep.txt'), path.join(guard, 'owner.json')]) {
      await chown(entry, 65534, 65534);
    }
    await assert.rejects(install(path.resolve('.'), target), /Another process owns this lock/);
    assert.equal(await readFile(path.join(guard, 'nested/keep.txt'), 'utf8'), 'keep');
    assert.deepEqual(await readdir(target), []);
  });
});
