import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
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
  const registry = '{"projects":[{"id":"old","status":"completed","approvals":["not transferable"]}]}\n';
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
});

test('migration source conflicts remain recoverable and backups are integrity-pinned', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-migrate-recover-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const { source, project, docs } = await fixture(base);
  const conflict = path.join(project, '.foundry/runtime/foundry.cjs');
  await mkdir(path.dirname(conflict), { recursive: true });
  await writeFile(conflict, 'owner-managed runtime\n');

  await assert.rejects(migrateWorkspace(project, source, 'apply'), /Migration was interrupted or refused/);
  assert.equal(await readFile(conflict, 'utf8'), 'owner-managed runtime\n');
  const journal = JSON.parse(await readFile(path.join(project, '.foundry/migration-pending.json'), 'utf8')) as {
    backup: string;
  };
  const backupDocument = path.join(journal.backup, 'docs/specs/product.md');
  await writeFile(backupDocument, 'tampered\n');
  await assert.rejects(migrateWorkspace(project, source, 'recover'), /backup changed/);
  await writeFile(backupDocument, docs);
  await writeFile(conflict, await readFile(path.join(source, '.foundry/runtime/foundry.cjs')));

  const recovered = await migrateWorkspace(project, source, 'recover');

  assert.equal(recovered.recovered, true);
  assert.equal(await readFile(path.join(project, 'docs/specs/product.md'), 'utf8'), docs);
  assert.equal(JSON.parse(await readFile(path.join(project, '.foundry/runtime.json'), 'utf8')).runtime, 'typescript');
  await assert.rejects(lstat(path.join(project, '.foundry/migration-pending.json')));
});
