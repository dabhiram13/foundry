import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
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
    npm_config_engine_strict: 'true',
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
    npm_config_engine_strict: 'true',
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
    'licenses/MCP-SDK-LICENSE.txt',
    'licenses/Zod-MIT.txt',
    'licenses/entities-BSD.txt',
    'licenses/jsonc-parser-MIT.txt',
    'licenses/parse5-MIT.txt',
    'package.json',
  ]);
  assert.doesNotMatch(packedFiles.join('\n'), /\b(?:app|server|python|state|tests|scripts)\b/i);

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
  assert.equal(metadata.engines.node, '>=24.0.0');
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
  assert.doesNotMatch(JSON.stringify(metadata.dependencies ?? {}), /@modelcontextprotocol|@openai\/mcp|python|mcp\.cjs/i);
  assert.deepEqual((await readdir(path.join(installedRoot, '.foundry'))).sort(), [
    'LICENSE-framework',
    'THIRD_PARTY_NOTICES.md',
    'roles.json',
  ]);
  const zodLicense = await readFile(path.join(installedRoot, 'licenses/Zod-MIT.txt'), 'utf8');
  assert.match(zodLicense, /Copyright \(c\) 2025 Colin McDonnell/);
  assert.match(zodLicense, /Permission is hereby granted, free of charge/);
  const bundled = await readFile(path.join(installedRoot, 'dist/runtime/foundry.cjs'), 'utf8');
  for (const name of ['Zod-MIT.txt', 'parse5-MIT.txt', 'entities-BSD.txt', 'MCP-SDK-LICENSE.txt', 'jsonc-parser-MIT.txt']) {
    const license = await readFile(path.join(installedRoot, 'licenses', name), 'utf8');
    assert.ok(bundled.includes(license), `${name} must travel with installed workspace runtimes`);
  }
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
  assert.doesNotMatch(help.stdout, /\b(?:typed|http|python)\b/i);
  assert.ok(run(executable, ['roles'], { cwd: prefix, env }).stdout.trim());

  const registryFile = path.join(home, 'providers.json');
  await writeFile(registryFile, JSON.stringify({ adapters: [{
    name: 'package-agent', kind: 'agent-runtime', protocol: 'foundry-jsonl-v1',
    command: [process.execPath, '-e', 'throw new Error("Setup must not execute providers");'],
    capabilities: ['jsonl', 'tools', 'cancel', 'permissions', 'structured_output', 'model_selection'],
    billing_modes: ['local'],
  }] }));
  const external = JSON.parse(run(executable, ['providers', '--providers', registryFile, '--json'], { cwd: home, env }).stdout);
  assert.equal(external.find(adapter => adapter.name === 'package-agent').availability, 'available');
  const neutral = JSON.parse(run(executable, [
    'new', 'Neutral package', '--idea', 'Use a selected adapter.', '--adapter', 'package-agent',
    '--providers', registryFile, '--model', 'owner/model-v7', '--json',
  ], { cwd: home, env }).stdout);
  assert.equal(neutral.adapter, 'package-agent');
  assert.equal(neutral.model, 'owner/model-v7');
  assert.equal(neutral.billing_mode, 'local');
  assert.ok(existsSync(path.join(neutral.path, '.foundry/providers.json')));
  const noAdapter = spawnSync(executable, ['new', 'No adapter', '--idea', 'Missing selection'], { cwd: home, env, encoding: 'utf8' });
  assert.equal(noAdapter.status, 2);
  assert.match(noAdapter.stderr, /Choose a provider/);
  assert.equal(existsSync(path.join(home, '.foundry/products/no-adapter')), false);

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
  const providers = JSON.parse(run(executable, ['providers', project.slug, '--json'], { cwd: home, env }).stdout);
  assert.ok(providers.some(adapter => adapter.name === 'codex' && adapter.source === 'builtin'
    && adapter.authentication === 'not_checked' && ['available', 'missing'].includes(adapter.availability)));
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
  const scoped = path.join(home, 'scoped');
  await mkdir(scoped);
  run(executable, ['init', '--project', scoped], { cwd: home, env });
  await writeFile(path.join(scoped, '.foundry/project.json'), JSON.stringify({
    name: 'scoped fixture', checks: [{
      name: 'behavior', command: [process.execPath, '-e', 'process.exit(0)'], inputs: ['spec.md'], required: true,
    }],
  }));
  await writeFile(path.join(scoped, 'spec.md'), '# Installed context\n');
  run(executable, ['work', 'start', 'installed-context', '--spec', 'spec.md', '--project', scoped], { cwd: home, env });
  run(executable, ['work', 'verify', '--project', scoped], { cwd: home, env });
  const contextArgs = ['work', 'context', '--project', scoped, '--json'];
  const fresh = JSON.parse(run(executable, contextArgs, { cwd: home, env }).stdout);
  assert.equal(fresh.schema_version, 2);
  assert.equal(fresh.evidence.status, 'current');
  await writeFile(path.join(scoped, 'spec.md'), '# Changed since verification\n');
  const stale = JSON.parse(run(executable, contextArgs, { cwd: home, env }).stdout);
  assert.equal(stale.run.saved_status, 'verified');
  assert.equal(stale.evidence.status, 'stale');
  assert.equal(stale.next_action.kind, 'verify');
  assert.notEqual(stale.snapshot_revision, fresh.snapshot_revision);
  run(executable, ['work', 'verify', '--project', scoped], { cwd: home, env });
  run(executable, ['work', 'complete', '--project', scoped], { cwd: home, env });
  await writeFile(path.join(scoped, 'scope.json'), JSON.stringify({ schema_version: 1, criteria: [{
    id: 'INSTALL-001', requirement: 'The installed command verifies this change.', checks: ['behavior'],
  }] }));
  run(executable, ['work', 'start', 'installed-approval', '--spec', 'spec.md', '--contract', 'scope.json', '--project', scoped], { cwd: home, env });
  const pending = JSON.parse(run(executable, contextArgs, { cwd: home, env }).stdout);
  assert.equal(pending.scope_approval, 'pending');
  const unapproved = spawnSync(executable, ['work', 'verify', '--project', scoped, '--json'], { cwd: home, env, encoding: 'utf8' });
  assert.equal(unapproved.status, 2);
  assert.match(JSON.parse(unapproved.stdout).error, /approve/);
  const review = JSON.parse(run(executable, ['work', 'review', '--project', scoped, '--json'], { cwd: home, env }).stdout);
  const approved = JSON.parse(run(executable, ['work', 'approve', '--revision', review.revision, '--project', scoped, '--json'], { cwd: home, env }).stdout);
  assert.equal(approved.approval.status, 'current');
  run(executable, ['work', 'verify', '--project', scoped], { cwd: home, env });
  const covered = JSON.parse(run(executable, contextArgs, { cwd: home, env }).stdout);
  assert.equal(covered.requirements_coverage, 'checks_passed');
  run(executable, ['work', 'complete', '--project', scoped], { cwd: home, env });
  assert.equal(JSON.parse(run(executable, contextArgs, { cwd: home, env }).stdout).run.historical, true);

  await writeFile(path.join(scoped, 'README.md'), 'The installed fixture tests a single bounded local behavior.');
  await writeFile(path.join(scoped, 'connected-scope.json'), JSON.stringify({ schema_version: 1, preparation: {}, criteria: [{
    id: 'INSTALL-002', requirement: 'A bundled MCP client can complete checked work.', checks: ['behavior'],
  }] }));
  const preview = JSON.parse(run(executable, ['connect', 'opencode', '--project', scoped, '--dry-run', '--json'], { cwd: home, env }).stdout);
  assert.equal(preview.config, 'opencode.json');
  assert.equal(preview.configuration_action, 'add');
  assert.equal(existsSync(path.join(scoped, 'opencode.json')), false);
  run(executable, ['connect', 'opencode', '--project', scoped, '--apply'], { cwd: home, env });
  const installedCommand = JSON.parse(await readFile(path.join(scoped, 'opencode.json'), 'utf8')).mcp.foundry.command;
  assert.deepEqual(installedCommand, [process.execPath, path.join(installedRoot, 'dist/runtime/foundry.cjs'), 'mcp', '--project', scoped]);
  assert.match(await readFile(path.join(scoped, '.opencode/skills/foundry-work/SKILL.md'), 'utf8'), /Do not run approval yourself/);
  const connection = new Client({ name: 'installed-package-test', version: '1' });
  const transport = new StdioClientTransport({ command: installedCommand[0], args: installedCommand.slice(1), env, stderr: 'pipe' });
  let errors = '';
  transport.stderr?.on('data', data => { errors += String(data); });
  try {
    await connection.connect(transport);
    const catalog = await connection.listTools();
    assert.equal(catalog.tools.length, 16);
    assert.equal(catalog.tools.some(tool => tool.name.includes('approve')), false);
    const read = async () => (await connection.callTool({ name: 'foundry_context', arguments: {} })).structuredContent;
    const before = await read();
    const start = await connection.callTool({ name: 'foundry_start', arguments: {
      snapshot_revision: before.snapshot_revision, slug: 'installed-connected', spec: 'spec.md', contract: 'connected-scope.json',
    } });
    assert.equal(start.isError, false);
    const researchAssignment = await connection.callTool({ name: 'foundry_assignment', arguments: { stage: 'research' } });
    assert.equal(researchAssignment.isError, false);
    assert.equal(researchAssignment.structuredContent.phase, 'select_sources');
    const captured = await connection.callTool({ name: 'foundry_capture_sources', arguments: {
      selection: { sources: [{ kind: 'local', location: 'README.md' }] }, snapshot_revision: (await read()).snapshot_revision,
    } });
    assert.equal(captured.isError, false);
    const researched = await connection.callTool({ name: 'foundry_record_research', arguments: {
      report: { summary: 'Local installed fixture notes.', findings: [{ claim: 'A single local behavior is requested.', source: 'S1',
        quote: 'The installed fixture tests a single bounded local behavior.' }], limitations: ['Not market evidence.'] },
      snapshot_revision: (await read()).snapshot_revision,
    } });
    assert.equal(researched.isError, false);
    const assignment = await connection.callTool({ name: 'foundry_assignment', arguments: { stage: 'planner' } });
    assert.equal(assignment.isError, false);
    assert.equal(assignment.structuredContent.execution, 'host_client');
    const plan = { planner_role: 'planner', reviewer_role: 'quality-gate', tasks: [{
      id: 'TASK-01', title: 'Implement installed behavior', instructions: 'Implement INSTALL-002 only.',
      role: 'backend', criteria: ['INSTALL-002'], depends_on: [],
    }] };
    const planned = await connection.callTool({ name: 'foundry_save_plan', arguments: { plan, snapshot_revision: (await read()).snapshot_revision } });
    assert.equal(planned.isError, false);
    const scope = (await connection.callTool({ name: 'foundry_review', arguments: {} })).structuredContent;
    run(executable, ['work', 'approve', '--revision', scope.revision, '--project', scoped], { cwd: home, env });
    const designAssignment = await connection.callTool({ name: 'foundry_assignment', arguments: { stage: 'designer' } });
    assert.equal(designAssignment.isError, false);
    const designed = await connection.callTool({ name: 'foundry_record_design', arguments: {
      report: { kind: 'service', summary: 'Keep the installed behavior bounded.', criteria: [{ id: 'INSTALL-002',
        approach: 'Exercise the bundled command and local MCP tools.', primary_states: 'Idle and successful local completion.',
        failure_states: 'Failed checks prevent completion.', responsive: 'Not an interface.', accessibility: 'Plain terminal output.' }], assumptions: [] },
      snapshot_revision: (await read()).snapshot_revision,
    } });
    assert.equal(designed.isError, false);
    assert.equal(designed.structuredContent.scope_approval, 'stale');
    const designedScope = (await connection.callTool({ name: 'foundry_review', arguments: {} })).structuredContent;
    run(executable, ['work', 'approve', '--revision', designedScope.revision, '--project', scoped], { cwd: home, env });
    const checked = await connection.callTool({ name: 'foundry_verify', arguments: { snapshot_revision: (await read()).snapshot_revision } });
    assert.equal(checked.isError, false);
    assert.equal(checked.structuredContent.exit_code, 0);
    const finished = await connection.callTool({ name: 'foundry_task_done', arguments: { task_id: 'TASK-01', snapshot_revision: (await read()).snapshot_revision } });
    assert.equal(finished.isError, false);
    const reviewAssignment = await connection.callTool({ name: 'foundry_assignment', arguments: { stage: 'reviewer' } });
    assert.equal(reviewAssignment.isError, false);
    const reviewed = await connection.callTool({ name: 'foundry_record_review', arguments: {
      report: { summary: 'Installed command behavior inspected in this package fixture.',
        criteria: [{ id: 'INSTALL-002', assessment: 'met', observation: 'The bundled MCP completed configured local checks.' }], findings: [] },
      snapshot_revision: (await read()).snapshot_revision,
    } });
    assert.equal(reviewed.isError, false);
    const completed = await connection.callTool({ name: 'foundry_complete', arguments: { snapshot_revision: (await read()).snapshot_revision } });
    assert.equal(completed.isError, false);
  } finally { await connection.close(); }
  assert.equal(errors, '');
  run(executable, ['connect', 'opencode', '--project', scoped, '--remove'], { cwd: home, env });
  assert.equal(existsSync(path.join(scoped, 'opencode.json')), false);
  run('npm', ['uninstall', '-g', '--prefix', prefix, metadata.name], { cwd: home, env });
  assert.equal(existsSync(path.join(prefix, 'bin/foundry')), false);
  assert.ok(existsSync(path.join(project.path, 'docs/product/idea.md')));
});
