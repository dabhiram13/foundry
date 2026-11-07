import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import {
  connectionProfileSchema, credentialReferenceSchema, inspectConnection, requireRegisteredConnection, resolveCredential,
  type RemoteConnection,
} from '../../src/core/connection-profile.js';
import { managedProfileSchema, type RemoteManagedProfile } from '../../src/core/managed-profile.js';
import { startConnectionProxy, type ConnectionForward } from '../../src/runtime/connection-proxy.js';
import { inspectConnections } from '../../src/runtime/providers.js';
import { validateManagedExecutor } from '../../src/runtime/managed-opencode.js';
import { executableDigest } from '../../src/runtime/opencode.js';

const SECRET = 'sk-test-offline-credential-value-0001';
const remote: RemoteConnection = { mode: 'remote', id: 'example', model: 'example-model', baseURL: 'https://api.example.test/v1',
  api: 'openai-chat-completions', credential: { kind: 'env', name: 'EXAMPLE_API_KEY' } };

async function remoteProfile(): Promise<RemoteManagedProfile> {
  return { schemaVersion: 1, id: randomUUID(), consentRef: randomUUID(), boundary: 'trusted-local-disposable', inference: 'consented-remote',
    binary: process.execPath, binaryDigest: await executableDigest(process.execPath), provider: remote, permissions: 'read-edit',
    maxTurns: 1, maxSteps: 4, deadlineMs: 5000, limits: { maxRequests: 2, maxOutputTokens: 256 }, billing: { mode: 'api', dollarCap: 'not-enforced-by-foundry' } };
}

async function project(t: TestContext, connections?: unknown) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-connections-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'project');
  await mkdir(path.join(root, '.foundry'), { recursive: true, mode: 0o700 });
  if (connections !== undefined) await writeFile(path.join(root, '.foundry/connections.json'), JSON.stringify(connections));
  return { root, storage: path.join(directory, 'private') };
}

test('connection profiles require an explicit provider, model, HTTPS endpoint and credential reference', () => {
  assert.equal(connectionProfileSchema.safeParse(remote).success, true);
  assert.equal(connectionProfileSchema.safeParse({ mode: 'local-test', id: 'local', model: 'm', baseURL: 'http://127.0.0.1:9/v1' }).success, true);
  for (const baseURL of ['http://api.example.test/v1', 'https://127.0.0.1/v1', 'https://localhost/v1', 'https://[::1]/v1', 'https://user:pass@api.example.test/v1',
    'https://api.example.test/v1?key=value', 'https://api.example.test/v1#x', 'https://api.example.test:8443/v1']) {
    assert.equal(connectionProfileSchema.safeParse({ ...remote, baseURL }).success, false, baseURL);
  }
  for (const key of ['id', 'model', 'baseURL', 'credential', 'api']) {
    const altered: Record<string, unknown> = { ...remote }; delete altered[key];
    assert.equal(connectionProfileSchema.safeParse(altered).success, false, key);
  }
  assert.equal(connectionProfileSchema.safeParse({ ...remote, apiKey: SECRET }).success, false);
  assert.equal(connectionProfileSchema.safeParse({ ...remote, credential: { kind: 'env', name: 'EXAMPLE_API_KEY', value: SECRET } }).success, false);
  for (const name of ['lower', 'PATH', 'HOME', 'OPENCODE_SERVER_PASSWORD', 'FOUNDRY_X', 'NODE_OPTIONS', SECRET]) assert.equal(credentialReferenceSchema.safeParse({ kind: 'env', name }).success, false, name);
  assert.equal(connectionProfileSchema.safeParse({ mode: 'local-test', id: 'l', model: 'm', baseURL: 'https://api.example.test/v1' }).success, false);
});

test('remote managed profiles require consented billing terms and bounded requests', async () => {
  const profile = await remoteProfile();
  assert.equal(managedProfileSchema.safeParse(profile).success, true);
  for (const key of ['limits', 'billing', 'consentRef']) {
    const altered: Record<string, unknown> = { ...profile }; delete altered[key];
    assert.equal(managedProfileSchema.safeParse(altered).success, false, key);
  }
  assert.equal(managedProfileSchema.safeParse({ ...profile, inference: 'local-test-only' }).success, false);
  assert.equal(managedProfileSchema.safeParse({ ...profile, limits: { maxRequests: 0, maxOutputTokens: 1 } }).success, false);
  assert.equal(managedProfileSchema.safeParse({ ...profile, billing: { mode: 'api', dollarCap: 5 } }).success, false);
});

test('credentials are read only by reference and reported only as present or missing', () => {
  assert.throws(() => resolveCredential(remote.credential, {}), /EXAMPLE_API_KEY is not set/);
  assert.throws(() => resolveCredential(remote.credential, { EXAMPLE_API_KEY: 'has space value' }), error => !String(error).includes('has space'));
  assert.equal(resolveCredential(remote.credential, { EXAMPLE_API_KEY: SECRET }), SECRET);
  const present = inspectConnection(remote, { EXAMPLE_API_KEY: SECRET });
  assert.deepEqual({ credential: present.credential, authentication: present.authentication, inference: present.inference },
    { credential: 'present', authentication: 'not_checked', inference: 'requires-consent' });
  assert.equal(JSON.stringify(present).includes(SECRET), false);
  assert.equal(inspectConnection(remote, {}).credential, 'missing');
});

test('remote connections are denied unless the owner registered the exact profile', async t => {
  const empty = await project(t);
  await assert.rejects(requireRegisteredConnection(empty.root, remote), /denied by default/);
  const other = await project(t, { connections: [{ name: 'other', profile: { ...remote, model: 'different-model' } }] });
  await assert.rejects(requireRegisteredConnection(other.root, remote), /denied by default/);
  const invalid = await project(t, { connections: [{ name: 'bad', profile: { ...remote, apiKey: SECRET } }] });
  await assert.rejects(requireRegisteredConnection(invalid.root, remote), error => /Invalid/.test(String(error)) && !String(error).includes(SECRET));
  const registered = await project(t, { connections: [{ name: 'example', profile: remote }] });
  assert.equal((await requireRegisteredConnection(registered.root, remote)).name, 'example');
});

test('provider registry lists registered connections without exposing credential values', async t => {
  const { root } = await project(t, { connections: [{ name: 'example', profile: remote }] });
  const [listed] = await inspectConnections(root, { EXAMPLE_API_KEY: SECRET });
  assert.equal(listed?.source, '.foundry/connections.json');
  assert.equal(listed?.kind, 'connection');
  assert.equal(listed?.credential, 'present');
  assert.equal(listed?.credential_reference, 'env:EXAMPLE_API_KEY');
  assert.equal(JSON.stringify(listed).includes(SECRET), false);
  const cli = path.resolve(process.env.FOUNDRY_MANAGED_TEST_RUNTIME ?? 'dist/runtime', 'foundry.cjs');
  const result = spawnSync(process.execPath, [cli, 'provider', '--project', root, '--json'], { encoding: 'utf8', env: { ...process.env, EXAMPLE_API_KEY: SECRET } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout)['connection:example'].credential, 'present');
  assert.equal(result.stdout.includes(SECRET) || result.stderr.includes(SECRET), false);
});

test('managed preflight admits remote profiles only when registered and the credential reference is set', { skip: process.platform !== 'linux' }, async t => {
  const profile = await remoteProfile();
  const unregistered = await project(t);
  await assert.rejects(validateManagedExecutor(unregistered.root, unregistered.storage, profile), /denied by default/);
  const registered = await project(t, { connections: [{ name: 'example', profile: remote }] });
  const previous = process.env.EXAMPLE_API_KEY;
  t.after(() => { if (previous === undefined) delete process.env.EXAMPLE_API_KEY; else process.env.EXAMPLE_API_KEY = previous; });
  delete process.env.EXAMPLE_API_KEY;
  await assert.rejects(validateManagedExecutor(registered.root, registered.storage, profile), /not set/);
  process.env.EXAMPLE_API_KEY = SECRET;
  assert.equal((await validateManagedExecutor(registered.root, registered.storage, profile)).inference, 'consented-remote');
});

test('offline relay forwards only bounded chat completions for the selected model with the referenced credential', async t => {
  const seen: Array<{ url: string; authorization: string; body: Record<string, unknown> }> = [];
  const upstream = createServer(async (request, response) => {
    let text = ''; for await (const chunk of request) text += String(chunk);
    seen.push({ url: request.url ?? '', authorization: request.headers.authorization ?? '', body: JSON.parse(text) });
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => upstream.close(() => resolve())));
  const port = (upstream.address() as { port: number }).port;
  const targets: string[] = [];
  const forward: ConnectionForward = (url, init) => {
    targets.push(url);
    assert.equal(init.redirect, 'error');
    return fetch(url.replace('https://api.example.test', `http://127.0.0.1:${port}`), init);
  };
  const controller = new AbortController();
  const relay = await startConnectionProxy(await remoteProfile(), SECRET, controller.signal, forward);
  t.after(() => relay.close());
  assert.match(relay.baseURL, /^http:\/\/127\.0\.0\.1:\d+\/v1$/);
  assert.notEqual(relay.token, SECRET);
  const send = (body: unknown, options: { token?: string; path?: string; method?: string } = {}) => fetch(`${relay.baseURL.replace(/\/v1$/, '')}${options.path ?? '/v1/chat/completions'}`, {
    method: options.method ?? 'POST', headers: { authorization: `Bearer ${options.token ?? relay.token}`, 'content-type': 'application/json' },
    ...(options.method === 'GET' ? {} : { body: JSON.stringify(body) }) });
  assert.equal((await send({ model: 'example-model' }, { token: SECRET })).status, 401);
  assert.equal((await send({ model: 'example-model' }, { path: '/v1/models', method: 'GET' })).status, 403);
  assert.equal((await send({ model: 'example-model' }, { path: '/v1/embeddings' })).status, 403);
  assert.equal((await send({ model: 'other-model' })).status, 403);
  assert.equal(seen.length, 0);
  const first = await send({ model: 'example-model', messages: [], max_tokens: 100_000, stream: true });
  assert.equal(first.status, 200);
  assert.match(await first.text(), /\[DONE\]/);
  assert.equal((await send({ model: 'example-model', messages: [] })).status, 200);
  assert.equal((await send({ model: 'example-model', messages: [] })).status, 429);
  assert.equal(relay.requests(), 2);
  assert.deepEqual(targets, ['https://api.example.test/v1/chat/completions', 'https://api.example.test/v1/chat/completions']);
  assert.deepEqual(seen.map(item => [item.url, item.authorization, item.body.max_tokens]), [
    ['/v1/chat/completions', `Bearer ${SECRET}`, 256], ['/v1/chat/completions', `Bearer ${SECRET}`, 256]]);
});

test('offline relay stops in-flight upstream requests when the managed execution is stopped', async t => {
  let aborted = false;
  const forward: ConnectionForward = (_url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
  });
  const controller = new AbortController();
  const relay = await startConnectionProxy(await remoteProfile(), SECRET, controller.signal, forward);
  t.after(() => relay.close());
  const pending = fetch(`${relay.baseURL}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${relay.token}` },
    body: JSON.stringify({ model: 'example-model', messages: [] }) }).then(response => response.status, () => 'closed');
  while (relay.requests() === 0) await new Promise(resolve => setTimeout(resolve, 10));
  controller.abort();
  assert.notEqual(await pending, 200);
  assert.equal(aborted, true);
  const after = await fetch(`${relay.baseURL}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${relay.token}` },
    body: JSON.stringify({ model: 'example-model', messages: [] }) }).then(response => response.status, () => 'closed');
  assert.notEqual(after, 200);
});
