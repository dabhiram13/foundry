import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { request as httpRequest } from 'node:http';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { test } from 'node:test';
import { readFactoryState } from '../../src/core/factory-contract.js';
import { ProjectService } from '../../src/core/projects.js';
import { startHttpServer } from '../../src/transports/http.js';

const sourceRoot = path.resolve('.');
const nodeBin = path.dirname(process.execPath);

async function temporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function frameworkFixture(base: string, providerConfiguration?: string): Promise<string> {
  const framework = path.join(base, 'framework');
  await mkdir(path.join(framework, '.foundry'), { recursive: true });
  await mkdir(path.join(framework, 'dist/runtime'), { recursive: true });
  await copyFile(path.join(sourceRoot, '.foundry/project.json'), path.join(framework, '.foundry/project.json'));
  await copyFile(path.join(sourceRoot, '.foundry/roles.json'), path.join(framework, '.foundry/roles.json'));
  for (const name of ['project.cjs', 'foundry.cjs', 'foundry-worker.cjs']) {
    await copyFile(path.join(sourceRoot, 'dist/runtime', name), path.join(framework, 'dist/runtime', name));
  }
  if (providerConfiguration) await writeFile(path.join(framework, '.foundry/providers.json'), providerConfiguration);
  return framework;
}

function toolText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const first = content[0] as { type?: unknown; text?: unknown } | undefined;
  return first?.type === 'text' && typeof first.text === 'string' ? first.text : '';
}

test('project service creates only typed children and reports legacy workspaces without mutating them', async (t) => {
  const base = await temporaryDirectory('foundry-project-service-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const products = path.join(base, 'products');
  const legacy = path.join(products, 'older-app');
  await mkdir(path.join(legacy, '.foundry'), { recursive: true });
  await writeFile(path.join(legacy, '.foundry/project.json'), '{"name":"old app","checks":[]}\n');
  const service = new ProjectService(sourceRoot, products);

  await assert.rejects(service.create({
    name: 'Rejected Adapter',
    idea: 'Must not create files before validation.',
    adapter: 'missing-adapter',
  }), /Unknown provider adapter/);
  await assert.rejects(readFile(path.join(products, 'rejected-adapter/.foundry/runtime.json')));
  const created = await service.create({
    name: 'Typed Notes',
    idea: 'A local notes product with explicit approval.',
    adapter: 'codex',
  });
  assert.equal(created.runtime, 'typescript');
  assert.equal(created.status, 'ready');
  assert.equal(created.subscription_confirmed, false);
  assert.deepEqual(created.factory_roles, {
    research: 'market-researcher',
    scope: 'planner',
    design: 'designer',
    build: 'backend',
    verify: 'quality-gate',
    release: 'complete',
  });
  assert.equal(await readFile(path.join(products, 'typed-notes/.foundry/runtime/foundry.cjs'), 'utf8').then((value) => value.length > 0), true);
  assert.equal(await readFile(path.join(products, 'typed-notes/.foundry/runtime/foundry-worker.cjs'), 'utf8').then((value) => value.length > 0), true);
  assert.equal((await readFactoryState(path.join(products, 'typed-notes')))?.provider_task_id, null);

  const listed = await service.list();
  assert.deepEqual(listed.map((project) => project.runtime), ['legacy', 'typescript']);
  assert.equal(listed[0]?.id, 'legacy:older-app');
  await assert.rejects(service.status('older-app'), /legacy or unmarked/i);
  await assert.rejects(service.status('../outside'), /safe child workspace/);
  await assert.rejects(service.create({ name: 'Typed Notes', idea: 'Do not overwrite.' }), /already exists/);
  await assert.rejects(service.run(String(created.id)), /explicit confirmation/);
  assert.equal((await service.status(String(created.id))).status, 'ready');
  assert.deepEqual(await service.models(), []);
  assert.equal((await service.snapshot()).runtime, 'typescript');
  assert.deepEqual(await readFile(path.join(legacy, '.foundry/project.json'), 'utf8'), '{"name":"old app","checks":[]}\n');
});

test('listing remains useful with malformed and symlinked children and copies validated provider settings', async (t) => {
  const base = await temporaryDirectory('foundry-project-isolation-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const providerConfiguration = JSON.stringify({
    adapters: [{
      name: 'fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', 'process.stdin.resume()'],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions'],
      billing_modes: ['local'],
      environment: ['FIXTURE_TOKEN'],
    }],
  }, null, 2);
  const framework = await frameworkFixture(base, providerConfiguration);

  const products = path.join(base, 'products');
  const service = new ProjectService(framework, products);
  const created = await service.create({
    name: 'Copied Provider',
    idea: 'Use only validated local adapter metadata.',
    adapter: 'fixture',
  });
  assert.equal(
    await readFile(path.join(products, 'copied-provider/.foundry/providers.json'), 'utf8'),
    providerConfiguration,
  );
  const malformed = path.join(products, 'malformed');
  await mkdir(path.join(malformed, '.foundry/state/factory'), { recursive: true });
  await copyFile(
    path.join(products, 'copied-provider/.foundry/runtime.json'),
    path.join(malformed, '.foundry/runtime.json'),
  );
  await writeFile(path.join(malformed, '.foundry/state/factory/controller.json'), '{broken');
  const outside = path.join(base, 'outside');
  await mkdir(outside);
  await symlink(outside, path.join(products, 'linked'), 'dir');

  const listed = await service.list();
  assert.deepEqual(
    listed.map((project) => [project.slug, project.runtime]),
    [['copied-provider', 'typescript'], ['linked', 'unavailable'], ['malformed', 'unavailable']],
  );
  await assert.rejects(service.status('malformed'), /metadata is invalid or unavailable/);
  await assert.rejects(service.status('linked'), /metadata is invalid or unavailable/);
  assert.equal(created.adapter, 'fixture');
});

test('typed CLI runs without Python and rejects unknown options', async (t) => {
  const base = await temporaryDirectory('foundry-typed-cli-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const products = path.join(base, 'products');
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: nodeBin };
  delete env.PYTHONPATH;
  const help = spawnSync(path.join(sourceRoot, 'foundry'), ['typed', '--help'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /new NAME --idea TEXT/);
  const listed = spawnSync(path.join(sourceRoot, 'foundry'), ['typed', 'list', '--products-dir', products, '--json'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(JSON.parse(listed.stdout), []);
  const unknown = spawnSync(path.join(sourceRoot, 'foundry'), ['typed', 'list', '--typo'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown option --typo/);
  const invalidBilling = spawnSync(path.join(sourceRoot, 'foundry'), ['typed', 'configure', 'missing', '--billing', 'api'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(invalidBilling.status, 2);
  assert.match(invalidBilling.stderr, /--billing must be local or subscription/);
});

test('loopback HTTP requires local origin and token, exposes explicit API data, and rejects traversal', async (t) => {
  const base = await temporaryDirectory('foundry-typed-http-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const service = new ProjectService(sourceRoot, path.join(base, 'products'));
  const handle = await startHttpServer(service, { port: 0, openBrowser: false });
  t.after(() => handle.close());
  const requests: string[] = [];
  handle.server.on('request', (incoming, outgoing) => {
    const label = `${incoming.method} ${incoming.url}`;
    requests.push(`started ${label}`);
    outgoing.once('finish', () => requests.push(`finished ${label}`));
  });
  const address = handle.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const request = async (input: string, init?: RequestInit): Promise<Response> => {
    try {
      return await fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      throw new Error(`HTTP request to ${new URL(input).pathname} failed (${requests.join('; ')})`, { cause: error });
    }
  };

  const page = await request(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy') ?? '', /nonce-/);
  assert.match(await page.text(), /foundry-token/);
  const direct = await service.create({ name: 'Service Notes', idea: 'Created by the shared service.' });

  const denied = await request(`${url}/api/snapshot`);
  assert.equal(denied.status, 403);
  const wrongOrigin = await request(`${url}/api/snapshot`, {
    headers: { 'X-Foundry-Token': handle.token, Origin: 'http://example.com' },
  });
  assert.equal(wrongOrigin.status, 403);
  const headers = { 'X-Foundry-Token': handle.token, 'Content-Type': 'application/json' };
  const createdResponse = await request(`${url}/api/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'HTTP Notes', idea: 'Notes from a local form.', adapter: 'codex' }),
  });
  assert.equal(createdResponse.status, 200);
  const created = await createdResponse.json() as { id: string; status: string };
  assert.equal(created.status, 'ready');
  const snapshotResponse = await request(`${url}/api/snapshot`, { headers: { 'X-Foundry-Token': handle.token } });
  const snapshot = await snapshotResponse.json() as { projects: Array<{ id: string; name: string; factory_roles: Record<string, string> }> };
  const httpProject = snapshot.projects.find((project) => project.id === created.id);
  assert.equal(httpProject?.factory_roles.scope, 'planner');
  assert.ok(snapshot.projects.some((project) => project.id === direct.id));
  const artifact = await request(`${url}/api/artifact?id=${encodeURIComponent(String(direct.id))}&path=${encodeURIComponent('docs/product/idea.md')}`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(artifact.status, 200);
  assert.match(JSON.stringify(await artifact.json()), /Created by the shared service/);
  const models = await request(`${url}/api/models`, { headers: { 'X-Foundry-Token': handle.token } });
  assert.deepEqual(await models.json(), []);
  const traversal = await request(`${url}/api/artifact?id=${encodeURIComponent(created.id)}&path=${encodeURIComponent('../.foundry/state/factory.json')}`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(traversal.status, 400);
  const privateArtifact = await request(`${url}/api/artifact?id=${encodeURIComponent(String(created.id))}&path=${encodeURIComponent('.foundry/state/factory/controller.json')}`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(privateArtifact.status, 400);
  const oversized = await request(`${url}/api/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'x'.repeat(270_000), idea: 'Too large.' }),
  });
  assert.equal(oversized.status, 400);
  const badContentType = await request(`${url}/api/create`, {
    method: 'POST',
    headers: { 'X-Foundry-Token': handle.token, 'Content-Type': 'text/plain' },
    body: '{}',
  });
  assert.equal(badContentType.status, 400);
  const invalidAdapter = await request(`${url}/api/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Invalid Adapter', idea: 'Reject an unknown adapter.', adapter: 'missing' }),
  });
  assert.equal(invalidAdapter.status, 400);
  const slowStartedAt = Date.now();
  const slowFailure = await new Promise<Error>((resolve, reject) => {
    const slow = httpRequest(`${url}/api/create`, {
      method: 'POST',
      headers: {
        'X-Foundry-Token': handle.token,
        'Content-Type': 'application/json',
        'Content-Length': '2',
      },
    }, (response) => {
      response.resume();
      reject(new Error(`Slow request unexpectedly returned ${response.statusCode}`));
    });
    slow.once('error', resolve);
    slow.write('{');
  });
  assert.match(slowFailure.message, /socket|reset|hang up/i);
  assert.ok(Date.now() - slowStartedAt >= 4_500);
  const signIn = await request(`${url}/api/sign-in`, { method: 'POST', headers, body: '{}' });
  assert.equal(signIn.status, 400);
  assert.match(JSON.stringify(await signIn.json()), /runtime CLI/);
  const wrongMethod = await request(`${url}/api/snapshot`, { method: 'DELETE', headers: { 'X-Foundry-Token': handle.token } });
  assert.equal(wrongMethod.status, 405);
});

test('HTTP runs in the background, keeps snapshots responsive, and requires explicit recovery after restart', async (t) => {
  const base = await temporaryDirectory('foundry-typed-http-jobs-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const hangingProvider = [
    "process.stdin.resume();",
    "process.stdin.on('end',()=>{",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'fixture-session'})+'\\n');",
    'setInterval(()=>{},1000);',
    '});',
  ].join('');
  const providerConfiguration = JSON.stringify({
    adapters: [{
      name: 'hanging-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', hangingProvider],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions'],
      billing_modes: ['local'],
    }],
  });
  const framework = await frameworkFixture(base, providerConfiguration);
  const products = path.join(base, 'products');
  const service = new ProjectService(framework, products);
  const project = await service.create({
    name: 'Background Run',
    idea: 'Exercise a cancellable local provider task.',
    adapter: 'hanging-fixture',
  });
  const projectId = String(project.id);
  const root = path.join(products, 'background-run');
  for (const args of [
    ['init', '-q'],
    ['config', 'user.name', 'Runtime Test'],
    ['config', 'user.email', 'runtime-test@localhost'],
    [
      'add',
      '.foundry/project.json',
      '.foundry/install.json',
      '.foundry/runtime.json',
      '.foundry/roles.json',
      '.foundry/providers.json',
      '.foundry/runtime/project.cjs',
      '.foundry/runtime/foundry.cjs',
      '.foundry/runtime/foundry-worker.cjs',
      'docs/product/idea.md',
    ],
    ['commit', '-q', '-m', 'fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }

  let handle = await startHttpServer(service, { port: 0, openBrowser: false });
  t.after(async () => handle.close());
  const endpoint = (): string => {
    const address = handle.server.address();
    assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  const headers = (): Record<string, string> => ({
    'X-Foundry-Token': handle.token,
    'Content-Type': 'application/json',
  });
  const runStartedAt = Date.now();
  const run = await fetch(`${endpoint()}/api/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: projectId }),
  });
  assert.equal(run.status, 200);
  assert.equal((await run.json() as { status: string }).status, 'running');
  assert.ok(Date.now() - runStartedAt < 1_000);

  const productRoot = path.join(products, 'background-run');
  let active = await readFactoryState(productRoot);
  for (let attempt = 0; attempt < 150 && !active?.provider_task_id; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    active = await readFactoryState(productRoot);
  }
  assert.ok(active?.provider_task_id, 'provider task should be persisted before cancellation');
  const snapshotStartedAt = Date.now();
  const snapshotResponse = await fetch(`${endpoint()}/api/snapshot`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(snapshotResponse.status, 200);
  const snapshot = await snapshotResponse.json() as {
    projects: Array<{ id: string; status: string }>;
    jobs: Record<string, { status: string }>;
  };
  const activeProject = snapshot.projects.find((item) => item.id === projectId);
  assert.equal(activeProject?.status, 'running');
  assert.equal(snapshot.jobs[projectId]?.status, 'running');
  assert.ok(Date.now() - snapshotStartedAt < 1_000);

  const stopped = await fetch(`${endpoint()}/api/cancel`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: projectId }),
  });
  assert.equal(stopped.status, 200);
  for (let attempt = 0; attempt < 150; attempt += 1) {
    active = await readFactoryState(productRoot);
    if (active?.status === 'interrupted' || active?.status === 'recovery_required') break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(['interrupted', 'recovery_required'].includes(active?.status ?? ''));

  await handle.close();
  handle = await startHttpServer(service, { port: 0, openBrowser: false });
  const restarted = await fetch(`${endpoint()}/api/snapshot`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  const restartedSnapshot = await restarted.json() as {
    projects: Array<{ id: string; status: string }>;
    jobs: Record<string, { status: string }>;
  };
  assert.equal(restartedSnapshot.projects.find((item) => item.id === projectId)?.status, active?.status);
  assert.notEqual(restartedSnapshot.jobs[projectId]?.status, 'running');

  const recovered = await fetch(`${endpoint()}/api/recover`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: projectId }),
  });
  assert.equal(recovered.status, 200);
  const recoveredProject = await recovered.json() as { status: string; stage: string };
  assert.equal(recoveredProject.status, 'interrupted');
  assert.equal(recoveredProject.stage, 'research');
});

test('stdio MCP subprocess uses the SDK protocol and omits owner-only tools', async (t) => {
  const base = await temporaryDirectory('foundry-typed-mcp-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const utilityBin = path.join(base, 'bin');
  await mkdir(utilityBin);
  await symlink('/usr/bin/dirname', path.join(utilityBin, 'dirname'));
  const isolatedPath = `${nodeBin}${path.delimiter}${utilityBin}`;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(sourceRoot, 'dist/runtime/foundry.cjs'), 'mcp', '--products-dir', path.join(base, 'products')],
    cwd: sourceRoot,
    env: { PATH: isolatedPath, HOME: base },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'foundry-runtime-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  t.after(() => client.close());

  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    'foundry_artifact',
    'foundry_cancel',
    'foundry_create',
    'foundry_recover',
    'foundry_run',
    'foundry_snapshot',
  ]);
  const snapshot = await client.callTool({ name: 'foundry_snapshot', arguments: {} });
  assert.notEqual(snapshot.isError, true);
  assert.match(toolText(snapshot.content), /"runtime":"typescript"/);
  const cliCreated = spawnSync(path.join(sourceRoot, 'foundry'), [
    'typed', 'new', 'CLI Notes', '--idea', 'A shared project created by the terminal.',
    '--products-dir', path.join(base, 'products'), '--json',
  ], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env: { PATH: isolatedPath, HOME: base },
  });
  assert.equal(cliCreated.status, 0, cliCreated.stderr);
  const sharedSnapshot = await client.callTool({ name: 'foundry_snapshot', arguments: {} });
  assert.match(toolText(sharedSnapshot.content), /CLI Notes/);
  const created = await client.callTool({
    name: 'foundry_create',
    arguments: { name: 'MCP Notes', idea: 'A typed MCP fixture.', adapter: 'codex' },
  });
  assert.notEqual(created.isError, true);
  assert.match(toolText(created.content), /"runtime":"typescript"/);
});
