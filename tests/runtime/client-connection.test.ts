import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { parse } from 'jsonc-parser';
import { approveScope, reviewScope, start, status, verify, workContext, type WorkContext } from '../../src/core/lifecycle.js';
import { connectOpenCode, workSkill } from '../../src/core/connect.js';
import { digest, withProcessLock } from '../../src/core/fs.js';

const executable = path.resolve('dist/runtime/foundry.cjs');
const skillPath = '.opencode/skills/foundry-work/SKILL.md';
const manifestPath = '.foundry/state/connectors/opencode.json';

async function project(t: TestContext, script = 'process.exit(0)'): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-client-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.foundry'));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({ schema_version: 1, runtime: 'typescript', runtime_version: '1', installed_at: '2026-01-01', source_pin: 'a'.repeat(64) }));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'fixture', checks: [{ name: 'behavior', command: [process.execPath, '-e', script], inputs: ['spec.md'], required: true }] }));
  await writeFile(path.join(root, 'spec.md'), '# Change\nMake the agreed change.\n');
  await writeFile(path.join(root, 'source.ts'), 'original');
  await writeFile(path.join(root, 'scope.json'), JSON.stringify({ schema_version: 1, criteria: [{ id: 'CLIENT-001', requirement: 'The change passes its check.', checks: ['behavior'] }] }));
  return root;
}
async function files(root: string): Promise<Record<string, string>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return Object.fromEntries(await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => {
    const name = path.join(entry.parentPath, entry.name);
    return [path.relative(root, name), digest(await readFile(name))];
  })));
}
async function client(t: TestContext, root: string) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [executable, 'mcp', '--project', root], stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += String(chunk); });
  const connection = new Client({ name: 'foundry-test', version: '1' });
  t.after(async () => { await connection.close(); assert.equal(stderr, ''); });
  await connection.connect(transport);
  return connection;
}
async function context(connection: Client): Promise<WorkContext> {
  const response = await connection.callTool({ name: 'foundry_context', arguments: {} });
  assert.equal(response.isError, false);
  return response.structuredContent as unknown as WorkContext;
}
async function action(connection: Client, name: string, snapshot: WorkContext, extra: Record<string, unknown> = {}) {
  return connection.callTool({ name, arguments: { snapshot_revision: snapshot.snapshot_revision, ...extra } });
}
async function begin(connection: Client) {
  const response = await action(connection, 'foundry_start', await context(connection), { slug: 'client', spec: 'spec.md', contract: 'scope.json' });
  assert.equal(response.isError, false);
}
async function approve(root: string) { await approveScope(root, (await reviewScope(root)).revision); }
async function waitFor(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await check()) return;
    await delay(25);
  }
  throw new Error('Timed out waiting for fixture state');
}

test('MCP exposes one project, protocol stdout and no approval or provider tools', async t => {
  const root = await project(t);
  const connection = await client(t, root);
  const catalog = await connection.listTools();
  assert.deepEqual(catalog.tools.map(tool => tool.name).sort(), [
    'foundry_assignment', 'foundry_complete', 'foundry_context', 'foundry_pause', 'foundry_record_review', 'foundry_recover',
    'foundry_resume', 'foundry_review', 'foundry_save_plan', 'foundry_specialists', 'foundry_start', 'foundry_task_done', 'foundry_verify',
  ]);
  assert.equal(catalog.tools.find(tool => tool.name === 'foundry_context')?.annotations?.readOnlyHint, true);
  assert.equal(catalog.tools.find(tool => tool.name === 'foundry_verify')?.annotations?.destructiveHint, true);
  const before = await files(root);
  const first = await context(connection);
  assert.equal(first.project, root);
  assert.equal(first.run, null);
  assert.deepEqual(await context(connection), first);
  assert.deepEqual(await files(root), before);
  const unknown = await connection.callTool({ name: 'foundry_approve', arguments: {} }).catch(error => ({ isError: true, error }));
  assert.equal(unknown.isError, true);
});

test('a second client continues the same run through manual approval and actual checks', async t => {
  const root = await project(t);
  const first = await client(t, root);
  await begin(first);
  const pending = await context(first);
  assert.equal(pending.scope_approval, 'pending');
  assert.equal((await action(first, 'foundry_verify', pending)).isError, true);
  assert.equal((await action(first, 'foundry_complete', pending)).isError, true);
  const review = await first.callTool({ name: 'foundry_review', arguments: {} });
  assert.equal(review.isError, false);
  const revision = (review.structuredContent as Record<string, unknown>).revision;
  const approval = spawnSync(process.execPath, [executable, 'work', 'approve', '--project', root, '--revision', String(revision), '--json'], { encoding: 'utf8' });
  assert.equal(approval.status, 0, approval.stderr);
  await first.close();
  const second = await client(t, root);
  const continued = await context(second);
  assert.equal(continued.run?.id, pending.run?.id);
  assert.equal(continued.scope_approval, 'current');
  const checked = await action(second, 'foundry_verify', continued);
  assert.equal(checked.isError, false);
  assert.equal((checked.structuredContent as Record<string, unknown>).exit_code, 0);
  const verified = await context(second);
  assert.equal(verified.evidence.status, 'current');
  const completed = await action(second, 'foundry_complete', verified);
  assert.equal(completed.isError, false);
  assert.equal((await context(second)).run?.historical, true);
  assert.equal((await action(second, 'foundry_complete', await context(second))).isError, false);
});

test('active source changes and another client action invalidate stale mutation snapshots', async t => {
  const root = await project(t);
  const first = await client(t, root);
  const second = await client(t, root);
  await begin(first);
  await approve(root);
  const old = await context(first);
  await writeFile(path.join(root, 'source.ts'), 'changed');
  const before = await files(root);
  const stale = await action(first, 'foundry_verify', old);
  assert.equal(stale.isError, true);
  assert.match(JSON.stringify(stale), /stale/);
  assert.deepEqual(await files(root), before);
  const current = await context(first);
  assert.equal((await action(second, 'foundry_pause', current)).isError, false);
  assert.equal((await action(first, 'foundry_resume', current)).isError, true);
  const paused = await context(first);
  assert.equal(paused.run?.saved_status, 'paused');
  assert.equal((await action(first, 'foundry_resume', paused)).isError, false);
});

test('stale preconditions are checked only after the coordinator lock is acquired', async t => {
  const root = await project(t);
  await start(root, 'race', 'spec.md', 'scope.json');
  await approve(root);
  const old = await workContext(root);
  await withProcessLock(path.join(root, '.foundry/state/coordinator.lock'), async () => {
    await assert.rejects(verify(root, () => false, old.snapshot_revision), /locked|lock|operation/i);
  });
  await writeFile(path.join(root, 'source.ts'), 'new input');
  await assert.rejects(verify(root, () => false, old.snapshot_revision), /stale/);
  assert.equal((await workContext(root)).run?.saved_status, 'building');
});

test('failed and later edited checks cannot become completion through MCP', async t => {
  const root = await project(t, 'process.exit(7)');
  const connection = await client(t, root);
  await begin(connection);
  await approve(root);
  const failed = await action(connection, 'foundry_verify', await context(connection));
  assert.equal(failed.isError, true);
  assert.equal((failed.structuredContent as Record<string, unknown>).exit_code, 1);
  assert.equal((await context(connection)).evidence.status, 'failed');
  assert.equal((await action(connection, 'foundry_complete', await context(connection))).isError, true);
  const config = JSON.parse(await readFile(path.join(root, '.foundry/project.json'), 'utf8'));
  config.checks[0].command = [process.execPath, '-e', 'process.exit(0)'];
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify(config));
  await approve(root);
  assert.equal((await action(connection, 'foundry_verify', await context(connection))).isError, false);
  await writeFile(path.join(root, 'source.ts'), 'Edit after passing checks');
  const stale = await context(connection);
  assert.equal(stale.evidence.status, 'stale');
  assert.equal((await action(connection, 'foundry_complete', stale)).isError, true);
});

test('unknown fields, arbitrary commands and cross-project paths do not mutate work', async t => {
  const root = await project(t);
  const other = await project(t);
  const connection = await client(t, root);
  const before = await files(root);
  for (const extra of [
    { project: other, slug: 'wrong', spec: 'spec.md', contract: 'scope.json' },
    { slug: 'wrong', spec: path.join(other, 'spec.md'), contract: 'scope.json' },
    { slug: 'wrong', spec: '../spec.md', contract: 'scope.json' },
    { slug: 'wrong', spec: 'spec.md', contract: 'scope.json', command: ['bad'] },
    { slug: 'wrong', spec: 'spec.md' },
  ]) {
    const response = await action(connection, 'foundry_start', await context(connection), extra).catch(error => ({ isError: true, error }));
    assert.equal(response.isError, true);
  }
  assert.deepEqual(await files(root), before);
  assert.equal((await workContext(other)).run, null);
});

test('legacy work remains readable but client mutations cannot bypass scoped enrollment', async t => {
  const root = await project(t);
  await start(root, 'legacy', 'spec.md');
  const connection = await client(t, root);
  assert.equal((await context(connection)).scope_approval, 'not_recorded');
  const response = await action(connection, 'foundry_verify', await context(connection));
  assert.equal(response.isError, true);
  assert.match(JSON.stringify(response), /Legacy scoped work/);
});

test('cancellation preserves interrupted receipts and allows continuation', async t => {
  const root = await project(t, 'setTimeout(() => {}, 10_000)');
  const connection = await client(t, root);
  await begin(connection);
  await approve(root);
  const abort = new AbortController();
  const request = connection.callTool({ name: 'foundry_verify', arguments: { snapshot_revision: (await context(connection)).snapshot_revision } }, { signal: abort.signal });
  const rejected = assert.rejects(request, /abort|cancel/i);
  await waitFor(async () => ((await status(root)).active as Record<string, unknown>).status === 'verifying');
  abort.abort();
  await rejected;
  await waitFor(async () => ((await status(root)).active as Record<string, unknown>).status === 'paused');
  const interrupted = await context(connection);
  assert.equal(interrupted.evidence.status, 'invalid');
  assert.equal(interrupted.next_action.kind, 'resume');
  const receipt = JSON.parse(await readFile(path.join(root, interrupted.evidence.receipt!), 'utf8'));
  assert.equal(receipt.status, 'interrupted');
  assert.equal(receipt.passed, false);
  assert.equal((await action(connection, 'foundry_resume', interrupted)).isError, false);
});

test('disconnect drains checks before exit and a new client can resume', async t => {
  const root = await project(t, 'setTimeout(() => {}, 10_000)');
  const connection = await client(t, root);
  await begin(connection);
  await approve(root);
  const operation = action(connection, 'foundry_verify', await context(connection));
  const rejected = assert.rejects(operation);
  await waitFor(async () => ((await status(root)).active as Record<string, unknown>).status === 'verifying');
  await connection.close();
  await rejected;
  const second = await client(t, root);
  const interrupted = await context(second);
  assert.equal(interrupted.run?.saved_status, 'paused');
  assert.equal(interrupted.evidence.status, 'invalid');
  assert.equal((await action(second, 'foundry_resume', interrupted)).isError, false);
});

test('setup refuses an unowned skill directory even when SKILL.md is absent', async t => {
  const root = await project(t);
  await mkdir(path.join(root, path.dirname(skillPath)), { recursive: true });
  await writeFile(path.join(root, path.dirname(skillPath), 'notes.md'), 'Owner notes\n');
  const before = await files(root);
  await assert.rejects(connectOpenCode(root, executable, 'dry-run'), /skill directory already exists/);
  await assert.rejects(connectOpenCode(root, executable, 'apply'), /skill directory already exists/);
  assert.deepEqual(await files(root), before);
});

test('setup preserves other skills and owner notes in a previously managed directory', async t => {
  const root = await project(t);
  const other = path.join(root, '.opencode/skills/owner/SKILL.md');
  await mkdir(path.dirname(other), { recursive: true });
  await writeFile(other, 'Owner skill\n');
  await connectOpenCode(root, executable, 'apply');
  await connectOpenCode(root, executable, 'remove');
  await connectOpenCode(root, executable, 'apply');
  const notes = path.join(root, path.dirname(skillPath), 'notes.md');
  await writeFile(notes, 'Owner notes\n');
  await connectOpenCode(root, executable, 'remove');
  assert.equal(await readFile(other, 'utf8'), 'Owner skill\n');
  assert.equal(await readFile(notes, 'utf8'), 'Owner notes\n');
  const before = await files(root);
  await assert.rejects(connectOpenCode(root, executable, 'apply'), /skill directory already exists/);
  assert.deepEqual(await files(root), before);
});

test('setup preview is read-only and JSONC edits preserve unrelated settings and comments', async t => {
  const root = await project(t);
  const existing = '{\n  // Owner preference\n  "model": "provider/example",\n  "mcp": { "other": { "type": "local", "command": ["other"] } },\n}\n';
  await writeFile(path.join(root, 'opencode.jsonc'), existing);
  const before = await files(root);
  const preview = await connectOpenCode(root, executable, 'dry-run');
  assert.equal(preview.applied, false);
  assert.equal(preview.config, 'opencode.jsonc');
  assert.equal(preview.configuration_action, 'add');
  assert.deepEqual(await files(root), before);
  const installed = await connectOpenCode(root, executable, 'apply');
  assert.equal(installed.applied, true);
  const changed = await readFile(path.join(root, 'opencode.jsonc'), 'utf8');
  assert.match(changed, /Owner preference/);
  assert.equal(parse(changed).model, 'provider/example');
  assert.deepEqual(parse(changed).mcp.other, parse(existing).mcp.other);
  assert.deepEqual(parse(changed).mcp.foundry.command, [process.execPath, executable, 'mcp', '--project', root]);
  assert.equal(await readFile(path.join(root, skillPath), 'utf8'), workSkill);
  const settled = await files(root);
  const repeated = await connectOpenCode(root, executable, 'apply');
  assert.equal(repeated.configuration_action, 'unchanged');
  assert.deepEqual(await files(root), settled);
  await connectOpenCode(root, executable, 'remove');
  const removed = parse(await readFile(path.join(root, 'opencode.jsonc'), 'utf8'));
  assert.equal(removed.mcp.foundry, undefined);
  assert.deepEqual(removed.mcp.other, parse(existing).mcp.other);
  assert.equal(removed.model, 'provider/example');
});

test('setup removes only unchanged managed files and preserves later unrelated edits', async t => {
  const root = await project(t);
  await connectOpenCode(root, executable, 'apply');
  const config = path.join(root, 'opencode.json');
  const edited = JSON.parse(await readFile(config, 'utf8'));
  edited.model = 'owner/model';
  await writeFile(config, JSON.stringify(edited));
  await connectOpenCode(root, executable, 'remove');
  assert.equal(JSON.parse(await readFile(config, 'utf8')).model, 'owner/model');
  await connectOpenCode(root, executable, 'remove');
  await connectOpenCode(root, executable, 'apply');
  await writeFile(path.join(root, skillPath), 'owner-edited skill');
  const before = await files(root);
  await assert.rejects(connectOpenCode(root, executable, 'remove'), /Owner file preserved/);
  assert.deepEqual(await files(root), before);
});

test('new default config is removed only while unchanged, and no global files are touched', async t => {
  const root = await project(t);
  await connectOpenCode(root, executable, 'apply');
  await connectOpenCode(root, executable, 'remove');
  await assert.rejects(readFile(path.join(root, 'opencode.json')), /ENOENT/);
  await assert.rejects(readFile(path.join(root, skillPath)), /ENOENT/);
  assert.match(workSkill, /Do not run approval yourself/);
  assert.match(workSkill, /Refresh foundry_context before every mutation/);
});

test('configuration collisions and malformed or ambiguous files fail without writes', async t => {
  for (const text of ['{', '[]', '{"mcp":[]}', '{"mcp":{},"mcp":{}}', '{"mcp":{"foundry":{"type":"local","command":["owner"]}}}']) {
    await t.test(text, async child => {
      const root = await project(child);
      await writeFile(path.join(root, 'opencode.json'), text);
      const before = await files(root);
      await assert.rejects(connectOpenCode(root, executable, 'apply'));
      assert.deepEqual(await files(root), before);
    });
  }
  const root = await project(t);
  await writeFile(path.join(root, 'opencode.json'), '{}');
  await writeFile(path.join(root, 'opencode.jsonc'), '{}');
  await assert.rejects(connectOpenCode(root, executable, 'apply'), /ambiguity/);
});

test('symlinks and oversized connection files cannot redirect setup', async t => {
  const root = await project(t);
  const outside = await project(t);
  await writeFile(path.join(outside, 'owner.json'), '{}');
  await symlink(path.join(outside, 'owner.json'), path.join(root, 'opencode.json'));
  await assert.rejects(connectOpenCode(root, executable, 'apply'), /Symlink/);
  assert.equal(await readFile(path.join(outside, 'owner.json'), 'utf8'), '{}');
  await rm(path.join(root, 'opencode.json'));
  await writeFile(path.join(root, 'opencode.json'), ' '.repeat(256 * 1024 + 1));
  await assert.rejects(connectOpenCode(root, executable, 'apply'), /256 KiB/);
});

test('partial setup and removal recover without adopting owner edits', async t => {
  const root = await project(t);
  const rename = fs.rename;
  let fail = true;
  fs.rename = async (from, to) => {
    if (fail && String(to) === path.join(root, 'opencode.json')) { fail = false; throw new Error('interrupted config write'); }
    return rename(from, to);
  };
  try { await assert.rejects(connectOpenCode(root, executable, 'apply'), /interrupted/); }
  finally { fs.rename = rename; }
  assert.equal(JSON.parse(await readFile(path.join(root, manifestPath), 'utf8')).phase, 'applying');
  await connectOpenCode(root, executable, 'apply');
  assert.equal(JSON.parse(await readFile(path.join(root, manifestPath), 'utf8')).phase, 'applied');
  const unlink = fs.rm;
  fs.rm = async (file, options) => {
    if (String(file) === path.join(root, 'opencode.json')) throw new Error('interrupted removal');
    return unlink(file, options);
  };
  try { await assert.rejects(connectOpenCode(root, executable, 'remove'), /interrupted/); }
  finally { fs.rm = unlink; }
  assert.equal(JSON.parse(await readFile(path.join(root, manifestPath), 'utf8')).phase, 'removing');
  await connectOpenCode(root, executable, 'remove');
  assert.equal(JSON.parse(await readFile(path.join(root, manifestPath), 'utf8')).phase, 'removed');
});

test('interrupted managed updates keep both proven versions recoverable', async t => {
  const root = await project(t);
  await connectOpenCode(root, executable, 'apply');
  const nextExecutable = path.join(root, 'next-foundry.cjs');
  const rename = fs.rename;
  fs.rename = async (from, to) => {
    if (String(to) === path.join(root, 'opencode.json')) throw new Error('interrupted update');
    return rename(from, to);
  };
  try { await assert.rejects(connectOpenCode(root, nextExecutable, 'apply'), /interrupted/); }
  finally { fs.rename = rename; }
  await connectOpenCode(root, nextExecutable, 'apply');
  assert.equal(JSON.parse(await readFile(path.join(root, 'opencode.json'), 'utf8')).mcp.foundry.command[1], nextExecutable);
  await connectOpenCode(root, nextExecutable, 'remove');
});
