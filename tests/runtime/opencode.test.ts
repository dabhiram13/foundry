import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { qualifyOpenCode, OpenCodeLifecycleError, OPENCODE_VERSION } from '../../src/runtime/opencode.js';

async function fixture(t: TestContext, mode = 'good') {
  const base = await mkdtemp(path.join(os.tmpdir(), 'foundry-opencode-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const project = path.join(base, 'project space ü');
  const runtimeParent = path.join(base, 'runtime');
  await mkdir(project);
  await mkdir(runtimeParent, { mode: 0o700 });
  const binary = path.join(base, 'opencode');
  await writeFile(binary, `#!${process.execPath}\nrequire(${JSON.stringify(path.resolve('dist/runtime-tests/opencode-server-fixture.cjs'))}).run(${JSON.stringify(mode)});\n`, { mode: 0o700 });
  const binaryDigest = createHash('sha256').update(await readFile(binary)).digest('hex');
  return { purpose: 'lifecycle-only' as const, binary, binaryDigest, project, runtimeParent, deadlineMs: 10_000, shutdownMs: 600 };
}

async function records(parent: string) {
  const entries = (await readdir(parent)).filter(name => name.startsWith('opencode-'));
  return Promise.all(entries.map(async entry => ({ directory: path.join(parent, entry), record: JSON.parse(await readFile(path.join(parent, entry, 'launch.json'), 'utf8')) })));
}

test('typed SDK qualifies an owned empty session without prompts or inherited credentials', async t => {
  const settings = await fixture(t);
  const before = process.env.SUPERVISOR_SENTINEL;
  process.env.SUPERVISOR_SENTINEL = 'sentinel-must-not-leak';
  t.after(() => { if (before === undefined) delete process.env.SUPERVISOR_SENTINEL; else process.env.SUPERVISOR_SENTINEL = before; });
  const result = await qualifyOpenCode(settings);
  assert.equal(result.sdkVersion, OPENCODE_VERSION);
  assert.equal(result.project.root, settings.project);
  assert.equal(result.upstreamSessionId, 'ses_fixture');
  assert.equal(result.resourcesStopped, true);
  assert.equal(result.modelExecuted, false);
  assert.equal(result.activeAbortQualified, false);
  const data = JSON.parse(await readFile(path.join(result.recordDirectory, 'state/audit.json'), 'utf8'));
  assert.equal(data.leaked, false);
  assert.equal(data.home, path.join(result.recordDirectory, 'home'));
  assert.equal(data.cwd, settings.project);
  assert.equal(data.pure, '1');
  assert.equal(data.projectConfigDisabled, '1');
  assert.deepEqual(data.audit.map((request: { method: string; path: string }) => `${request.method} ${request.path}`), [
    'GET /session', 'GET /global/health', 'GET /config', 'POST /session', 'GET /session/ses_fixture', 'POST /session/ses_fixture/abort', 'DELETE /session/ses_fixture',
  ]);
  assert.ok(data.audit.every((request: { directory: string }) => request.directory === settings.project));
  assert.equal(data.audit[0].authenticated, false);
  assert.ok(data.audit.slice(1).every((request: { authenticated: boolean }) => request.authenticated));
  const { record } = (await records(settings.runtimeParent))[0]!;
  assert.equal(record.phase, 'stopped');
  assert.equal(record.failure, null);
  assert.throws(() => process.kill(record.pid, 0), { code: 'ESRCH' });
  assert.equal(JSON.stringify(record).includes('sentinel-must-not-leak'), false);
  assert.deepEqual(await readdir(settings.project), []);
});

for (const [mode, code] of [
  ['wrong-version', 'version-mismatch'], ['no-auth', 'authentication-missing'], ['unsafe-config', 'configuration-unsafe'],
  ['malformed-config', 'configuration-unsafe'], ['mutate-binary', 'binding-changed'],
  ['wrong-root', 'binding-changed'], ['wrong-session', 'binding-changed'], ['malformed', 'protocol-invalid'],
  ['oversized', 'body-limit'], ['chunked', 'body-limit'], ['redirect', 'http-failed'],
  ['abort-failed', 'protocol-invalid'], ['delete-failed', 'protocol-invalid'],
  ['early-exit', 'startup-failed'], ['noise', 'output-limit'], ['late-noise', 'output-limit'], ['silent', 'deadline'], ['hang', 'deadline'],
] as const) {
  test(`OpenCode lifecycle fails closed for ${mode}`, async t => {
    const settings = await fixture(t, mode);
    if (mode === 'silent' || mode === 'hang') settings.deadlineMs = 600;
    await assert.rejects(qualifyOpenCode(settings), error => {
      assert.ok(error instanceof OpenCodeLifecycleError);
      assert.equal(error.code, code);
      assert.equal(error.resourcesStopped, true);
      assert.equal(error.message, `OpenCode lifecycle: ${code}`);
      return true;
    });
    const { directory, record } = (await records(settings.runtimeParent))[0]!;
    assert.equal(record.phase, 'stopped');
    assert.equal(record.failure, code);
    assert.throws(() => process.kill(record.pid, 0), { code: 'ESRCH' });
    assert.equal((await readFile(path.join(directory, 'launch.json'), 'utf8')).includes('PASSWORD'), false);
  });
}

test('shutdown escalates when an owned server ignores termination', async t => {
  const settings = await fixture(t, 'ignore-term');
  const result = await qualifyOpenCode(settings);
  assert.equal(result.resourcesStopped, true);
  const { record } = (await records(settings.runtimeParent))[0]!;
  assert.throws(() => process.kill(record.pid, 0), { code: 'ESRCH' });
});

test('uncertain shutdown stays unresolved and reading it never replays a launch', async t => {
  const settings = await fixture(t);
  const kill = process.kill.bind(process);
  const mock = t.mock.method(process, 'kill', ((pid: number, signal: NodeJS.Signals | number = 'SIGTERM') => {
    if (pid < 0 && signal === 0) throw Object.assign(new Error('inspection denied'), { code: 'EPERM' });
    return kill(pid, signal);
  }) as typeof process.kill);
  await assert.rejects(qualifyOpenCode(settings), { code: 'shutdown-unconfirmed', resourcesStopped: false });
  mock.mock.restore();
  const before = await records(settings.runtimeParent);
  assert.equal(before[0]!.record.phase, 'unknown');
  assert.throws(() => process.kill(before[0]!.record.pid, 0), { code: 'ESRCH' });
  await assert.rejects(qualifyOpenCode(settings), { code: 'runtime-unresolved', resourcesStopped: false });
  assert.deepEqual(await records(settings.runtimeParent), before);
});

test('private resource records reject tampering instead of admitting another server', async t => {
  const settings = await fixture(t);
  const result = await qualifyOpenCode(settings);
  await chmod(path.join(result.recordDirectory, 'launch.json'), 0o644);
  await assert.rejects(qualifyOpenCode(settings), { code: 'runtime-unresolved' });
  assert.equal((await records(settings.runtimeParent)).length, 1);
});

test('a crashed supervisor leaves a durable launch that reopening cannot replay', async t => {
  const settings = await fixture(t, 'hang');
  const helper = path.resolve('dist/runtime-tests/opencode-server-fixture.cjs');
  const worker = spawn(process.execPath, ['-e', `require(${JSON.stringify(helper)}).qualify(${JSON.stringify(settings)}).catch(()=>process.exit(1));`], {
    env: { PATH: path.dirname(process.execPath), LANG: 'C.UTF-8' }, stdio: 'ignore',
  });
  const exited = new Promise<void>((resolve, reject) => { worker.once('exit', () => resolve()); worker.once('error', reject); });
  let serverPid: number | undefined;
  try {
    const end = Date.now() + 8000;
    let ready = false;
    while (Date.now() < end) {
      try {
        const [entry] = await records(settings.runtimeParent);
        if (entry?.record.pid) serverPid = entry.record.pid;
        if (entry && serverPid) {
          const audit = JSON.parse(await readFile(path.join(entry.directory, 'state/audit.json'), 'utf8'));
          if (audit.audit.some((request: { path: string }) => request.path === '/global/health')) { ready = true; break; }
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      await delay(20);
    }
    assert.ok(ready);
    worker.kill('SIGKILL');
    await exited;
    assert.ok(serverPid);
    assert.equal(process.kill(serverPid, 0), true);
    const before = await records(settings.runtimeParent);
    await assert.rejects(qualifyOpenCode(settings), { code: 'runtime-unresolved', resourcesStopped: false });
    assert.deepEqual(await records(settings.runtimeParent), before);
  } finally {
    worker.kill('SIGKILL');
    if (serverPid) {
      try { process.kill(-serverPid, 'SIGKILL'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    }
    await exited;
  }
});

test('stopped history does not exhaust admission, while unresolved history still blocks', async t => {
  const settings = await fixture(t);
  await qualifyOpenCode(settings);
  const [original] = await records(settings.runtimeParent);
  assert.ok(original);
  for (let i = 0; i < 260; i++) {
    const directory = path.join(settings.runtimeParent, `opencode-history-${i}`);
    await mkdir(directory, { mode: 0o700 });
    await writeFile(path.join(directory, 'launch.json'), JSON.stringify(original.record), { mode: 0o600 });
  }
  await qualifyOpenCode(settings);
  assert.equal((await records(settings.runtimeParent)).length, 262);
  const directory = path.join(settings.runtimeParent, 'opencode-unresolved-history');
  await mkdir(directory, { mode: 0o700 });
  await writeFile(path.join(directory, 'launch.json'), JSON.stringify({ ...original.record, phase: 'unknown' }), { mode: 0o600 });
  await assert.rejects(qualifyOpenCode(settings), { code: 'runtime-unresolved', resourcesStopped: false });
  assert.equal((await records(settings.runtimeParent)).length, 263);
});

test('competing qualifications reject admission instead of sharing an unowned server', async t => {
  const settings = await fixture(t, 'slow');
  const first = qualifyOpenCode(settings);
  void first.catch(() => {});
  try {
    const end = Date.now() + 5000;
    while (!(await readdir(settings.runtimeParent)).some(name => name.startsWith('opencode-')) && Date.now() < end) await delay(10);
    await assert.rejects(qualifyOpenCode(settings), { code: 'runtime-unresolved', resourcesStopped: false });
  } finally { await first; }
  assert.equal((await records(settings.runtimeParent)).length, 1);
});

test('unsafe selection and storage are rejected before launch', async t => {
  const settings = await fixture(t);
  for (const invalid of [
    { ...settings, purpose: 'execute' }, { ...settings, binary: 'opencode' },
    { ...settings, binary: path.join(settings.project, 'missing') }, { ...settings, project: settings.binary },
    { ...settings, runtimeParent: path.join(settings.project, 'runtime') },
    { ...settings, remoteUrl: 'http://127.0.0.1:4096' }, { ...settings, deadlineMs: 100_000 },
    { ...settings, binaryDigest: '0'.repeat(64) },
  ]) await assert.rejects(qualifyOpenCode(invalid), { code: 'invalid-profile', resourcesStopped: true });
  const linked = path.join(path.dirname(settings.binary), 'linked');
  await symlink(settings.binary, linked);
  await assert.rejects(qualifyOpenCode({ ...settings, binary: linked }), { code: 'invalid-profile' });
  await chmod(settings.runtimeParent, 0o755);
  await assert.rejects(qualifyOpenCode(settings), { code: 'invalid-profile' });
  await chmod(settings.runtimeParent, 0o700);
  await mkdir(path.join(settings.runtimeParent, '.git'));
  await assert.rejects(qualifyOpenCode(settings), { code: 'invalid-profile' });
  assert.deepEqual((await readdir(settings.runtimeParent)).filter(name => name.startsWith('opencode-')), []);
});

test('real pinned OpenCode lifecycle, without a model or active-turn abort', {
  skip: !process.env.FOUNDRY_OPENCODE_QUALIFY_BINARY,
}, async t => {
  const settings = await fixture(t);
  settings.binary = process.env.FOUNDRY_OPENCODE_QUALIFY_BINARY!;
  settings.binaryDigest = createHash('sha256').update(await readFile(settings.binary)).digest('hex');
  settings.deadlineMs = 30_000;
  settings.shutdownMs = 4000;
  const marker = path.join(settings.project, 'plugin-ran');
  await writeFile(path.join(settings.project, 'hostile-plugin.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marker)},'unexpected');export const plugin=async()=>({});`);
  await writeFile(path.join(settings.project, 'opencode.json'), JSON.stringify({ plugin: ['./hostile-plugin.mjs'], mcp: {
    trap: { type: 'local', command: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected')`], enabled: true },
  } }));
  const result = await qualifyOpenCode(settings);
  assert.equal(result.resourcesStopped, true);
  assert.equal(result.modelExecuted, false);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  assert.deepEqual((await readdir(settings.project)).sort(), ['hostile-plugin.mjs', 'opencode.json']);
  t.diagnostic(JSON.stringify(result));
});
