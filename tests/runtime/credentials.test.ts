import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import {
  adapterCredentialSchema, missingCredentials, openCredentialSession, validateAdapterCredentials,
  type AdapterCredential,
} from '../../src/runtime/credentials.js';

function broker(upstream: string): Extract<AdapterCredential, { delivery: 'broker' }> {
  return adapterCredentialSchema.parse({
    id: 'fixture-key', delivery: 'broker', credential: { kind: 'env', name: 'CREDENTIAL_TEST_SECRET' }, billing_modes: ['api'],
    upstream, header: 'authorization', base_url_env: 'FIXTURE_BASE_URL', token_env: 'FIXTURE_TOKEN',
  }) as Extract<AdapterCredential, { delivery: 'broker' }>;
}

function send(url: string, token: string, body = '{"ping":1}'): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-api-key': 'child-value' } }, response => {
      let text = '';
      response.on('data', part => text += part);
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: text }));
    });
    outgoing.on('error', reject);
    outgoing.end(body);
  });
}

test('credential references reject unsafe upstreams, collisions and credential-like environment names', () => {
  assert.throws(() => adapterCredentialSchema.parse({ ...broker('https://api.example.test'), upstream: 'http://api.example.test' }));
  assert.throws(() => adapterCredentialSchema.parse({ ...broker('https://api.example.test'), upstream: 'https://user:pass@api.example.test' }));
  assert.throws(() => adapterCredentialSchema.parse({ ...broker('https://api.example.test'), upstream: 'https://api.example.test/?key=1' }));
  assert.doesNotThrow(() => broker('http://127.0.0.1:9'));
  const reference = broker('https://api.example.test');
  assert.throws(() => validateAdapterCredentials([reference, reference]), /unique/);
  assert.throws(() => validateAdapterCredentials([reference], ['FIXTURE_BASE_URL']), /collides/);
  assert.throws(() => validateAdapterCredentials([{ ...reference, credential: { kind: 'env', name: 'FIXTURE_REGION' } }], ['FIXTURE_REGION']), /source/);
  assert.throws(() => validateAdapterCredentials([{ ...reference, base_url_env: 'PATH' }]), /collides/);
  assert.doesNotThrow(() => validateAdapterCredentials([reference], ['PROVIDER_REGION']));
});

test('missing selected credentials fail closed and unselected modes are ignored', async () => {
  const reference = broker('https://api.example.test');
  assert.deepEqual(missingCredentials([reference], 'api', {}), ['fixture-key']);
  assert.deepEqual(missingCredentials([reference], 'api', { CREDENTIAL_TEST_SECRET: 'short' }), ['fixture-key']);
  assert.deepEqual(missingCredentials([reference], 'local', {}), []);
  await assert.rejects(openCredentialSession([reference], 'api', {}), /not set/);
});

test('broker injects the secret upstream, authenticates the adapter token and stops after revocation', async (t) => {
  const secret = 'fixture-upstream-secret-7781';
  const seen: IncomingHttpHeaders[] = [];
  const upstream = createServer((incoming, response) => {
    seen.push(incoming.headers);
    let body = '';
    incoming.on('data', part => body += part);
    incoming.on('end', () => response.end(JSON.stringify({ path: incoming.url, body })));
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => upstream.close());
  const origin = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/v1`;
  const session = await openCredentialSession([broker(origin)], 'api', { CREDENTIAL_TEST_SECRET: secret });
  t.after(() => session.close());
  const base = session.environment.FIXTURE_BASE_URL!;
  const token = session.environment.FIXTURE_TOKEN!;
  assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(Object.values(session.environment).includes(secret), false);
  assert.ok(session.secrets.includes(secret) && session.secrets.includes(token));

  const forwarded = await send(`${base}/chat?x=1`, token);
  assert.equal(forwarded.status, 200);
  assert.deepEqual(JSON.parse(forwarded.body), { path: '/v1/chat?x=1', body: '{"ping":1}' });
  assert.equal(seen[0]!.authorization, `Bearer ${secret}`);
  assert.equal(seen[0]!['x-api-key'], undefined);

  assert.equal((await send(`${base}/chat`, 'wrong-token')).status, 401);
  assert.equal(seen.length, 1);
  session.revoke();
  assert.equal((await send(`${base}/chat`, token)).status, 403);
  const [receipt] = session.receipts;
  assert.equal(receipt!.requests, 1);
  assert.equal(receipt!.rejected_requests, 2);
  assert.equal(receipt!.exposed_to_adapter_process, false);
  assert.equal(JSON.stringify(session.receipts).includes(secret), false);
  assert.equal(JSON.stringify(session.receipts).includes(token), false);
});
