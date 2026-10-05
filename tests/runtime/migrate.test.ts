import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile, chmod } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { migrateWorkspace } from '../../src/core/migrate.js';
import { digest } from '../../src/core/fs.js';

const sourceRoot = path.resolve('.');

async function fixture(base: string): Promise<{ source: string; project: string; runId: string; docs: string }> {
  const source = path.join(base, 'framework');
  const project = path.join(base, 'legacy-project');
  const docs = '# Owner-authored specification\n\nKeep every byte.\n';
  await mkdir(path.join(source, '.foundry/runtime'), { recursive: true });
  await mkdir(path.join(source, '.foundry/state/factory'), { recursive: true });
  await mkdir(path.join(source, '.foundry'), { recursive: true });
  await mkdir(path.join(project, '.foundry/state/runs'), { recursive: true });
  await mkdir(path.join(project, 'docs/specs'), { recursive: true });
  for (const name of ['foundry.cjs', 'foundry-worker.cjs']) {
    await writeFile(
      path.join(source, `.foundry/runtime/${name}`),
      await readFile(path.join(sourceRoot, `dist/runtime/${name}`)),
      { mode: 0o700 },
    );
  }
  await writeFile(path.join(source, '.foundry/roles.json'), await readFile(path.join(sourceRoot, '.foundry/roles.json')));
  const registry = JSON.stringify({
    schema_version: 1,
    projects: [{
      id: randomUUID(),
      name: 'Legacy Project',
      slug: 'legacy-project',
      idea: 'not transferable',
      path: project,
      products_root: base,
      adapter: 'codex',
      model: null,
      reasoning: null,
      roles: [],
      role_settings: {},
      stage: 'release',
      status: 'completed',
      approved_stages: [],
      task_id: null,
      session_id: null,
      events: [],
      artifacts: [],
      stage_verification: {},
      history: [],
      approved_revisions: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subscription_confirmed: false,
      lifecycle_run_id: null,
      publication: 'not_authorized',
    }],
  }) + '\n';
  await writeFile(path.join(source, '.foundry/state/factory/projects.json'), registry);
  await writeFile(path.join(project, '.foundry/project.json'), '{"name":"Legacy Notes","checks":[]}\n');
  await writeFile(path.join(project, '.foundry/providers.json'), '{"adapters":[{"owner":"saved"}]}\n');
  await writeFile(path.join(project, '.foundry/owner-settings.json'), '{"keep":true}\n');
  await writeFile(path.join(project, 'docs/specs/product.md'), docs);
  const manifest = {
    version: '0.2.0',
    installed_at: new Date().toISOString(),
    files: {
      'z-runtime.cjs': 'a'.repeat(64),
      'a-worker.cjs': 'b'.repeat(64),
    },
    modes: {
      'z-runtime.cjs': 0o700,
      'a-worker.cjs': 0o700,
    },
  };
  const sourcePinText = `{"files": {"a-worker.cjs": "${'b'.repeat(64)}", "z-runtime.cjs": "${'a'.repeat(64)}"}, "modes": {"a-worker.cjs": 448, "z-runtime.cjs": 448}, "version": "0.2.0"}`;
  await writeFile(path.join(project, '.foundry/install.json'), JSON.stringify({
    ...manifest,
    source_pin: digest(sourcePinText),
  }));
  const runId = randomUUID();
  const updatedAt = new Date().toISOString();
  const runState = {
    schema_version: 1,
    run_id: runId,
    slug: 'legacy-notes',
    spec: 'docs/specs/product.md',
    status: 'completed',
    started_at: updatedAt,
    updated_at: updatedAt,
    completion: {
      path: 'docs/completion.md',
      text: 'The legacy task completed.',
      completed_at: updatedAt,
    },
  };
  await mkdir(path.join(project, '.foundry/state/runs', runId), { recursive: true });
  await writeFile(path.join(project, `.foundry/state/runs/${runId}/state.json`), JSON.stringify(runState));
  await writeFile(path.join(project, '.foundry/state/last-completed.json'), JSON.stringify({
    run_id: runId,
    state: `.foundry/state/runs/${runId}/state.json`,
  }));
  return { source, project, runId, docs };
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  const visit = async (relative: string): Promise<void> => {
    for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const child = path.join(relative, entry.name);
      const absolute = path.join(root, child);
      const metadata = await lstat(absolute);
      if (metadata.isDirectory()) {
        output[child] = `directory:${metadata.mode & 0o777}`;
        await visit(child);
      } else if (metadata.isFile()) {
        output[child] = `${metadata.mode & 0o777}:${digest(await readFile(absolute))}`;
      } else {
        output[child] = `other:${metadata.mode & 0o777}`;
      }
    }
  };
  await visit('');
  return output;
}

async function holdFlock(lockPath: string): Promise<() => Promise<void>> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  const child = spawn('flock', ['-n', lockPath, 'sh', '-c', 'printf "migration-test-lock\\n"; cat'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes('migration-test-lock')) resolve();
    });
    child.once('error', reject);
    child.once('close', (code) => reject(new Error(`flock test process exited before locking (${code})`)));
  });
  return async () => {
    child.stdin.end();
    if (child.exitCode === null) await new Promise<void>((resolve) => child.once('close', () => resolve()));
  };
}

test('migration dry run makes no changes and reports preserved owner data', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-migrate-dry-run-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const { source, project } = await fixture(base);
  const beforeProject = await snapshot(project);
  const beforeSource = await snapshot(source);

  const result = await migrateWorkspace(project, source, 'dry-run');

  assert.equal(result.would_write, false);
  assert.deepEqual(result.preserved, ['.foundry', 'docs']);
  assert.equal(result.archivedFactoryRegistry, true);
  assert.equal(result.matchingFactoryRecord, true);
  assert.match(String(result.controllerDiscoveryLimitations), /arbitrary directories/);
  assert.deepEqual(await snapshot(project), beforeProject);
  assert.deepEqual(await snapshot(source), beforeSource);
  await assert.rejects(lstat(path.join(project, '.foundry/runtime.json')));
  assert.deepEqual((await readdir(base)).sort(), ['framework', 'legacy-project']);
});

test('migration preserves project state, settings, and docs and archives Factory history as nonresumable', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-migrate-apply-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const { source, project, runId, docs } = await fixture(base);
  const preserved = {
    project: await readFile(path.join(project, '.foundry/project.json')),
    providers: await readFile(path.join(project, '.foundry/providers.json')),
    install: await readFile(path.join(project, '.foundry/install.json')),
    settings: await readFile(path.join(project, '.foundry/owner-settings.json')),
    state: await readFile(path.join(project, `.foundry/state/runs/${runId}/state.json`)),
  };

  const result = await migrateWorkspace(project, source, 'apply');

  assert.equal(result.migrated, true);
  assert.equal(result.fresh_typed_reviews_required, true);
  assert.equal(result.archived_factory_registry, true);
  assert.equal(await readFile(path.join(project, 'docs/specs/product.md'), 'utf8'), docs);
  assert.deepEqual(await readFile(path.join(project, '.foundry/project.json')), preserved.project);
  assert.deepEqual(await readFile(path.join(project, '.foundry/providers.json')), preserved.providers);
  assert.deepEqual(await readFile(path.join(project, '.foundry/state/runs', runId, 'state.json')), preserved.state);
  assert.deepEqual(await readFile(path.join(project, '.foundry/owner-settings.json')), preserved.settings);
  assert.notDeepEqual(await readFile(path.join(project, '.foundry/install.json')), preserved.install);
  assert.equal(JSON.parse(await readFile(path.join(project, '.foundry/runtime.json'), 'utf8')).runtime, 'typescript');
  const backup = String(result.backup);
  assert.equal((await stat(backup)).mode & 0o777, 0o700);
  assert.deepEqual(await readFile(path.join(backup, '.foundry/owner-settings.json')), preserved.settings);
  assert.deepEqual(await readFile(path.join(backup, '.foundry/install.json')), preserved.install);
  assert.equal(await readFile(path.join(backup, 'docs/specs/product.md'), 'utf8'), docs);
  assert.match(await readFile(path.join(backup, 'legacy-factory-projects.json'), 'utf8'), /not transferable/);
  const archive = JSON.parse(await readFile(path.join(backup, 'legacy-factory-archive.json'), 'utf8')) as {
    resumable: boolean;
  };
  assert.equal(archive.resumable, false);
  const archiveRecords = JSON.parse(await readFile(path.join(backup, 'legacy-factory-records.json'), 'utf8')) as {
    resumable: boolean;
    projects: Array<{ status: string; stage: string; build: unknown }>;
  };
  assert.equal(archiveRecords.resumable, false);
  assert.deepEqual(archiveRecords.projects.map(({ status, stage, build }) => ({ status, stage, build })), [
    { status: 'completed', stage: 'release', build: null },
  ]);
  await assert.rejects(lstat(path.join(project, '.foundry/migration-pending.json')));
});

test('migration refuses active work, future project formats, and owner-data symlinks without writing', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-migrate-refuse-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const active = await fixture(path.join(base, 'active'));
  await mkdir(path.dirname(path.join(active.project, '.foundry/state/active.json')), { recursive: true });
  await writeFile(path.join(active.project, '.foundry/state/active.json'), JSON.stringify({
    run_id: active.runId,
    slug: 'legacy-notes',
  }));
  const activeBefore = await snapshot(active.project);
  await assert.rejects(migrateWorkspace(active.project, active.source, 'apply'), /active lifecycle run/);
  assert.deepEqual(await snapshot(active.project), activeBefore);
  await assert.rejects(lstat(path.join(active.project, '.foundry/runtime.json')));

  const future = await fixture(path.join(base, 'future'));
  await writeFile(path.join(future.project, '.foundry/project.json'), '{"schema_version":99,"name":"Future","checks":[]}\n');
  const futureBefore = await snapshot(future.project);
  await assert.rejects(migrateWorkspace(future.project, future.source, 'apply'), /future project manifest format/);
  assert.deepEqual(await snapshot(future.project), futureBefore);

  const futureRegistry = await fixture(path.join(base, 'future-registry'));
  await writeFile(path.join(futureRegistry.source, '.foundry/state/factory/projects.json'), '{"schema_version":2,"projects":[]}\n');
  const futureRegistryBefore = await snapshot(futureRegistry.project);
  await assert.rejects(
    migrateWorkspace(futureRegistry.project, futureRegistry.source, 'apply'),
    /unsupported or malformed legacy Factory registry/,
  );
  assert.deepEqual(await snapshot(futureRegistry.project), futureRegistryBefore);
  await assert.rejects(lstat(path.join(futureRegistry.project, '.foundry/migration-pending.json')));

  const runningFactory = await fixture(path.join(base, 'running-factory'));
  const registryPath = path.join(runningFactory.source, '.foundry/state/factory/projects.json');
  const registry = JSON.parse(await readFile(registryPath, 'utf8')) as {
    projects: Array<Record<string, unknown>>;
  };
  const runningRecord = registry.projects[0];
  assert.ok(runningRecord);
  runningRecord.status = 'running';
  await writeFile(registryPath, JSON.stringify(registry));
  const runningFactoryBefore = await snapshot(runningFactory.project);
  await assert.rejects(
    migrateWorkspace(runningFactory.project, runningFactory.source, 'apply'),
    /matching running legacy Factory record/,
  );
  assert.deepEqual(await snapshot(runningFactory.project), runningFactoryBefore);

  const activeBuild = await fixture(path.join(base, 'active-factory-build'));
  const activeRegistryPath = path.join(activeBuild.source, '.foundry/state/factory/projects.json');
  const activeRegistry = JSON.parse(await readFile(activeRegistryPath, 'utf8')) as {
    projects: Array<Record<string, unknown>>;
  };
  const activeRecord = activeRegistry.projects[0];
  assert.ok(activeRecord);
  activeRecord.stage_verification = {
    build: { status: 'building', tasks: [{ title: 'unfinished task', status: 'working' }] },
  };
  await writeFile(activeRegistryPath, JSON.stringify(activeRegistry));
  const activeBuildBefore = await snapshot(activeBuild.project);
  await assert.rejects(
    migrateWorkspace(activeBuild.project, activeBuild.source, 'apply'),
    /in-flight or ambiguous legacy Factory build state/,
  );
  assert.deepEqual(await snapshot(activeBuild.project), activeBuildBefore);

  const taskWorkspace = await fixture(path.join(base, 'active-provider'));
  const tasks = path.join(taskWorkspace.project, '.foundry/state/providers/tasks');
  await mkdir(tasks, { recursive: true });
  await writeFile(path.join(tasks, 'active.json'), JSON.stringify({
    schema_version: 1,
    adapter_contract_version: 1,
    task_id: randomUUID(),
    created_at: new Date().toISOString(),
    status: 'running',
    session_id: null,
    settings: {
      adapter: 'codex',
      adapter_digest: 'a'.repeat(64),
      kind: 'agent-runtime',
      required_capabilities: ['jsonl'],
      model: null,
      reasoning: null,
      permissions: null,
      output_schema_digest: 'b'.repeat(64),
      billing: { mode: 'local' },
      budget: {
        max_attempts: 1,
        max_concurrency: 1,
        max_elapsed_seconds: 300,
        max_api_dollars: 0,
      },
    },
    attempts: [],
    elapsed_seconds: 0,
    usage: {
      input_tokens: null,
      output_tokens: null,
      api_dollars: null,
      known_api_dollars: 0,
      subscription_allowance_remaining: null,
    },
  }));
  const taskBefore = await snapshot(taskWorkspace.project);
  await assert.rejects(migrateWorkspace(taskWorkspace.project, taskWorkspace.source, 'apply'), /active or ambiguous provider work/);
  assert.deepEqual(await snapshot(taskWorkspace.project), taskBefore);

  const malformed = await fixture(path.join(base, 'malformed-manifest'));
  await writeFile(path.join(malformed.project, '.foundry/install.json'), '{"version":"0.2.0","files":[]}\n');
  const malformedBefore = await snapshot(malformed.project);
  await assert.rejects(migrateWorkspace(malformed.project, malformed.source, 'apply'), /malformed legacy install manifest/);
  assert.deepEqual(await snapshot(malformed.project), malformedBefore);

  const linked = await fixture(path.join(base, 'linked'));
  const outside = path.join(base, 'outside-docs');
  await mkdir(outside);
  await symlink(outside, path.join(linked.project, 'docs/linked'), 'dir');
  await assert.rejects(migrateWorkspace(linked.project, linked.source, 'apply'), /symlinked owner data/);
  await assert.rejects(lstat(path.join(linked.project, '.foundry/runtime.json')));

  const special = await fixture(path.join(base, 'special-owner-file'));
  const socketPath = path.join(special.project, 'docs/special.sock');
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });
  await assert.rejects(migrateWorkspace(special.project, special.source, 'dry-run'), /special file in owner data/);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('managed target conflicts fail during dry-run without backup or journal writes', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-migrate-conflict-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const { source, project } = await fixture(base);
  const conflict = path.join(project, '.foundry/runtime/foundry.cjs');
  await mkdir(path.dirname(conflict), { recursive: true });
  await writeFile(conflict, 'owner-managed runtime\n');
  const projectBefore = await snapshot(project);
  const sourceBefore = await snapshot(source);
  const baseBefore = (await readdir(base)).sort();

  await assert.rejects(migrateWorkspace(project, source, 'dry-run'), /Legacy migration refuses modified managed bytes/);
  await assert.rejects(migrateWorkspace(project, source, 'apply'), /Legacy migration refuses modified managed bytes/);
  assert.equal(await readFile(conflict, 'utf8'), 'owner-managed runtime\n');
  assert.deepEqual(await snapshot(project), projectBefore);
  assert.deepEqual(await snapshot(source), sourceBefore);
  assert.deepEqual((await readdir(base)).sort(), baseBefore);
  await assert.rejects(lstat(path.join(project, '.foundry/migration-pending.json')));
});

test('migration refuses active source-root Factory locks', { skip: process.platform === 'win32' }, async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-migrate-factory-lock-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const { source, project } = await fixture(base);
  const lock = path.join(source, '.foundry/state/factory/projects.lock');
  const release = await holdFlock(lock);
  try {
    const beforeProject = await snapshot(project);
    const beforeSource = await snapshot(source);
    await assert.rejects(migrateWorkspace(project, source, 'dry-run'), /active shared Factory lock/);
    assert.deepEqual(await snapshot(project), beforeProject);
    assert.deepEqual(await snapshot(source), beforeSource);
  } finally {
    await release();
  }
});

test('migration recovery preserves backed-up owner roles and refuses owner, source, or backup drift', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-migrate-recover-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const { source, project, docs } = await fixture(base);
  const rolesPath = path.join(project, '.foundry/roles.json');
  const sourceRolesPath = path.join(source, '.foundry/roles.json');
  const sourceRoles = await readFile(sourceRolesPath);
  const sourceRolesMode = (await stat(sourceRolesPath)).mode & 0o777;
  const ownerRoles = JSON.parse(sourceRoles.toString('utf8')) as { roles: Array<{ description: string }> };
  const ownerRole = ownerRoles.roles[0];
  assert.ok(ownerRole);
  ownerRole.description += ' owner-customized';
  const ownerRolesBytes = Buffer.from(`${JSON.stringify(ownerRoles, null, 2)}\n`);
  await writeFile(rolesPath, ownerRolesBytes, { mode: 0o640 });
  await chmod(rolesPath, 0o640);
  const runtimeDirectory = path.join(project, '.foundry/runtime');
  await mkdir(runtimeDirectory, { recursive: true });
  await chmod(runtimeDirectory, 0o500);

  await assert.rejects(migrateWorkspace(project, source, 'apply'), /Migration was interrupted or refused/);
  await chmod(runtimeDirectory, 0o700);
  const migrationJournal = JSON.parse(await readFile(path.join(project, '.foundry/migration-pending.json'), 'utf8')) as {
    backup: string;
  };
  await readFile(path.join(project, '.foundry/install-pending.json'));
  assert.deepEqual(await readFile(rolesPath), ownerRolesBytes);
  assert.equal((await stat(rolesPath)).mode & 0o777, 0o640);

  const changedRoles = JSON.parse(ownerRolesBytes.toString('utf8')) as { roles: Array<{ description: string }> };
  const changedRole = changedRoles.roles[0];
  assert.ok(changedRole);
  changedRole.description += ' changed';
  await writeFile(rolesPath, `${JSON.stringify(changedRoles, null, 2)}\n`);
  await chmod(rolesPath, 0o640);
  await assert.rejects(migrateWorkspace(project, source, 'recover'), /changed owner roles bytes or mode/);
  await writeFile(rolesPath, ownerRolesBytes);
  await chmod(rolesPath, 0o640);

  const changedSourceRoles = JSON.parse(sourceRoles.toString('utf8')) as { roles: Array<{ description: string }> };
  const changedSourceRole = changedSourceRoles.roles[0];
  assert.ok(changedSourceRole);
  changedSourceRole.description += ' changed-source';
  await writeFile(sourceRolesPath, `${JSON.stringify(changedSourceRoles, null, 2)}\n`);
  await assert.rejects(migrateWorkspace(project, source, 'recover'), /exactly the pinned source runtime/);
  await writeFile(sourceRolesPath, sourceRoles);
  await chmod(sourceRolesPath, sourceRolesMode);

  const backupRoles = path.join(migrationJournal.backup, '.foundry/roles.json');
  const backupRolesMode = (await stat(backupRoles)).mode & 0o777;
  await writeFile(backupRoles, 'tampered\n');
  await assert.rejects(migrateWorkspace(project, source, 'recover'), /backup changed/);
  await writeFile(backupRoles, ownerRolesBytes);
  await chmod(backupRoles, backupRolesMode);

  await chmod(rolesPath, 0o600);
  await assert.rejects(migrateWorkspace(project, source, 'recover'), /changed owner roles bytes or mode/);
  await chmod(rolesPath, 0o640);

  const recovered = await migrateWorkspace(project, source, 'recover');

  assert.equal(recovered.recovered, true);
  assert.equal(await readFile(path.join(project, 'docs/specs/product.md'), 'utf8'), docs);
  assert.deepEqual(await readFile(rolesPath), ownerRolesBytes);
  assert.equal((await stat(rolesPath)).mode & 0o777, 0o640);
  assert.equal(JSON.parse(await readFile(path.join(project, '.foundry/runtime.json'), 'utf8')).runtime, 'typescript');
  await assert.rejects(lstat(path.join(project, '.foundry/migration-pending.json')));
  await assert.rejects(lstat(path.join(project, '.foundry/install-pending.json')));
});
