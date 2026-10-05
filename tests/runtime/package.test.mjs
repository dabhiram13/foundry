import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120_000, ...options });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function hostExecutable(name) {
  const found = process.env.PATH?.split(path.delimiter)
    .map((directory) => path.join(directory, name))
    .find((candidate) => existsSync(candidate));
  assert.ok(found, `Required executable ${name} is unavailable`);
  return found;
}

test('linked CLI runs by name outside the checkout and can be unlinked', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-link-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const prefix = path.join(base, 'prefix');
  const home = path.join(base, 'home');
  await Promise.all([mkdir(prefix), mkdir(home)]);
  const env = {
    HOME: home,
    PATH: `${path.join(prefix, 'bin')}${path.delimiter}${path.dirname(process.execPath)}`,
    npm_config_prefix: prefix,
    npm_config_cache: path.join(base, 'cache'),
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_ignore_scripts: 'false',
  };
  run('npm', ['link'], { cwd: root, env });
  const help = run('foundry', ['--help'], { cwd: home, env });
  assert.match(help.stdout, /Foundry terminal-first runtime/);
  assert.ok(run('foundry', ['roles'], { cwd: home, env }).stdout.trim());
  run('npm', ['unlink', '-g', '@dabhiram13/foundry'], { cwd: home, env });
  assert.equal(existsSync(path.join(prefix, 'bin/foundry')), false);
  assert.ok(existsSync(path.join(root, 'dist/runtime/foundry.cjs')));
});

test('npm tarball exposes one public Node bin and installs globally without Python', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-pack-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const prefix = path.join(base, 'prefix');
  const home = path.join(base, 'home');
  const bin = path.join(base, 'bin');
  const cache = path.join(base, 'cache');
  await Promise.all([
    mkdir(prefix),
    mkdir(home),
    mkdir(bin),
    mkdir(cache),
  ]);
  const git = hostExecutable('git');
  const shell = hostExecutable('sh');
  await symlink(git, path.join(bin, 'git'));
  await symlink(shell, path.join(bin, 'sh'));
  const env = {
    HOME: home,
    PATH: `${path.join(prefix, 'bin')}${path.delimiter}${path.dirname(process.execPath)}${path.delimiter}${bin}`,
    npm_config_cache: cache,
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_ignore_scripts: 'false',
  };
  for (const executable of ['python', 'python3']) {
    assert.equal(
      spawnSync(executable, ['--version'], { encoding: 'utf8', env }).error?.code,
      'ENOENT',
      `${executable} must be unavailable during the isolated package test`,
    );
  }

  const packed = run('npm', [
    'pack',
    '--json',
    '--pack-destination',
    base,
  ], { cwd: root, env });
  const packRecord = JSON.parse(packed.stdout)[0];
  const packedFiles = packRecord.files.map(({ path: file }) => file).sort();
  assert.deepEqual(packedFiles, [
    '.foundry/LICENSE-framework',
    '.foundry/THIRD_PARTY_NOTICES.md',
    '.foundry/roles.json',
    'LICENSE',
    'README.md',
    'THIRD_PARTY_NOTICES.md',
    'dist/runtime/foundry-worker.cjs',
    'dist/runtime/foundry.cjs',
    'licenses/Zod-MIT.txt',
    'package.json',
  ]);
  assert.doesNotMatch(packedFiles.join('\n'), /\b(?:app|server|mcp|python|state|tests|scripts)\b/i);

  const tarball = path.join(base, packRecord.filename);
  run('npm', [
    'install',
    '-g',
    '--no-audit',
    '--no-fund',
    '--prefix',
    prefix,
    tarball,
  ], { cwd: prefix, env });
  const installedRoot = path.join(prefix, 'lib/node_modules/@dabhiram13/foundry');
  const metadata = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'));
  assert.notEqual(metadata.private, true);
  assert.equal(metadata.license, 'MIT');
  assert.deepEqual(metadata.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org/' });
  assert.equal(metadata.repository.url, 'git+https://github.com/dabhiram13/foundry.git');
  assert.equal(metadata.scripts.prepack, 'npm run build:runtime');
  assert.equal(metadata.scripts.prepublishOnly, 'npm test');
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
    assert.equal(metadata.scripts[hook], undefined, `${hook} must not be needed to install`);
  }
  assert.deepEqual(metadata.bin, { foundry: 'dist/runtime/foundry.cjs' });
  assert.deepEqual(Object.keys(metadata.bin), ['foundry']);
  assert.deepEqual(metadata.dependencies ?? {}, {});
  assert.doesNotMatch(JSON.stringify(metadata), /@modelcontextprotocol|@openai\/mcp|python|mcp\.cjs/i);
  assert.deepEqual((await readdir(path.join(installedRoot, '.foundry'))).sort(), [
    'LICENSE-framework',
    'THIRD_PARTY_NOTICES.md',
    'roles.json',
  ]);
  const zodLicense = await readFile(path.join(installedRoot, 'licenses/Zod-MIT.txt'), 'utf8');
  assert.match(zodLicense, /Copyright \(c\) 2025 Colin McDonnell/);
  assert.match(zodLicense, /Permission is hereby granted, free of charge/);
  assert.match(zodLicense, /THE SOFTWARE IS PROVIDED "AS IS"/);
  await assert.rejects(readFile(path.join(installedRoot, 'dist/runtime/project.cjs')));
  await assert.rejects(readFile(path.join(installedRoot, 'dist/runtime/assets/roles.json')));

  const executable = 'foundry';
  assert.equal(run(executable, ['--version'], { cwd: home, env }).stdout.trim(), metadata.version);
  assert.equal(run(executable, ['-v'], { cwd: home, env }).stdout.trim(), metadata.version);
  const versionWithExtra = spawnSync(executable, ['--version', 'extra'], {
    cwd: home,
    env,
    encoding: 'utf8',
  });
  assert.equal(versionWithExtra.status, 2);
  assert.match(versionWithExtra.stderr, /Version does not accept additional arguments/);
  const help = run(executable, ['--help'], { cwd: prefix, env });
  assert.match(help.stdout, /Foundry terminal-first runtime/);
  assert.doesNotMatch(help.stdout, /\b(?:typed|mcp|http|python)\b/i);
  assert.ok(run(executable, ['roles'], { cwd: prefix, env }).stdout.trim());

  const created = run(executable, [
    'new',
    'Tarball Fixture',
    '--idea',
    'Create one local workspace without starting a provider.',
    '--adapter',
    'codex',
    '--json',
  ], { cwd: prefix, env });
  const project = JSON.parse(created.stdout);
  assert.equal(project.runtime, 'typescript');
  assert.equal(project.status, 'ready');
  assert.equal(project.billing_mode, 'subscription');
  assert.equal(project.subscription_confirmed, false);
  assert.equal(project.path, path.join(home, '.foundry/products/tarball-fixture'));
  const providerTasksPath = path.join(project.path, '.foundry/state/providers/tasks');
  const providerTasks = await readdir(providerTasksPath).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  assert.deepEqual(providerTasks, []);
  assert.equal(await readFile(path.join(project.path, 'docs/product/idea.md'), 'utf8')
    .then((content) => content.includes('Create one local workspace')), true);
  assert.equal(await readFile(path.join(project.path, '.foundry/runtime.json'), 'utf8')
    .then((content) => JSON.parse(content).runtime), 'typescript');
  run('npm', ['uninstall', '-g', '--prefix', prefix, metadata.name], { cwd: home, env });
  assert.equal(existsSync(path.join(prefix, 'bin/foundry')), false);
  assert.ok(existsSync(path.join(project.path, 'docs/product/idea.md')));
});
