import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import dns from 'node:dns/promises';
import https, { type RequestOptions } from 'node:https';
import { EventEmitter } from 'node:events';
import {
  collectResearchSources, fetchResearchSource, isPublicAddress, publicSourceUrl,
  renderResearchReport, researchSelectionSchema, researchText,
} from '../../src/core/research.js';

const observation = 'Customers supplied their own project requirements, not independent evidence of market demand.';
const signal = () => new AbortController().signal;
const report = () => ({
  summary: 'The supplied document describes the intended product.',
  findings: [{ claim: 'The source describes owner requirements.', source: 'S1', quote: observation }],
  limitations: ['No customer interviews or demand measurements.'],
});
const selection = { sources: [{ kind: 'local', location: 'docs/brief.md' }] };
const directory = '.foundry/state/factory/research/test';

test('research collects source snapshots, checks quotations and renders honest local-only limitations', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-research-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs'));
  await writeFile(path.join(root, 'docs/brief.md'), observation);
  const collected = await collectResearchSources(root, selection, directory, signal());
  assert.equal(collected.sources.length, 1);
  assert.equal(collected.sources[0]?.excerpt, observation);
  const rendered = await renderResearchReport(root, report(), collected);
  assert.match(rendered, /Local documents only/);
  assert.match(rendered, /SHA-256: [a-f0-9]{64}/);
  assert.match(rendered, /not that the source or the interpretation is correct/);
  assert.equal(JSON.parse(await readFile(path.join(root, directory, 'sources.json'), 'utf8')).sources.length, 1);

  const fabricated = report();
  fabricated.findings[0]!.quote = 'A fabricated quotation that is not present in the document.';
  await assert.rejects(renderResearchReport(root, fabricated, collected), /must quote/);
  const nonexistent = report();
  nonexistent.findings[0]!.source = 'S2';
  await assert.rejects(renderResearchReport(root, nonexistent, collected), /must quote/);
  await assert.rejects(renderResearchReport(root, { summary: 'https://example.com is unavailable' }, collected));
  await assert.rejects(renderResearchReport(root, { ...report(), findings: [] }, collected));
  await writeFile(path.join(root, directory, 'S1.txt'), 'Modified after capture');
  await assert.rejects(renderResearchReport(root, report(), collected), /snapshot changed/);
});

test('research refuses source traversal, secrets, symlinks, duplicates, oversized files and empty evidence', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-source-limits-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs'));
  await writeFile(path.join(root, 'docs/huge.md'), 'x'.repeat(512 * 1024 + 1));
  await writeFile(path.join(root, 'docs/empty.md'), ' ');
  await symlink(path.join(root, 'docs/huge.md'), path.join(root, 'docs/link.md'));
  for (const location of ['../outside.md', '.env', '.foundry/state/secret.md', 'docs/../README.md',
    'docs/link.md', 'docs/huge.md', 'docs/empty.md', 'docs/product/research.md']) {
    await assert.rejects(collectResearchSources(root, { sources: [{ kind: 'local', location }] }, directory, signal()), /at least one readable source/);
  }
  const saved = JSON.parse(await readFile(path.join(root, directory, 'sources.json'), 'utf8'));
  assert.equal(saved.unavailable.length, 1);
  assert.equal(saved.sources.length, 0);
  assert.throws(() => researchSelectionSchema.parse({ sources: [] }));
  assert.throws(() => researchSelectionSchema.parse({ sources: [...selection.sources, ...selection.sources] }));
  assert.throws(() => researchSelectionSchema.parse({ sources: Array.from({ length: 6 }, (_, i) => ({ kind: 'local', location: `docs/${i}.md` })) }));
});

test('source reading strips scripts and markup without executing them, decodes entities and records truncation', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-html-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(researchText({ body: '<head><title>Noise</title></head><body><nav>Menu</nav><main>Hello &amp; <b>world</b>.</main><script>fetch("secret")</script><style>body{}</style></body>',
    mediaType: 'text/html', location: 'https://example.com' }), 'Hello & world .');
  const collected = await collectResearchSources(root, { sources: [
    { kind: 'https', location: 'https://example.com/source' },
    { kind: 'https', location: 'https://example.com/missing' },
  ] }, directory, signal(), async url => {
    if (url.endsWith('missing')) throw new Error('not found');
    return { body: `<p>${observation}</p><p>${'more '.repeat(2_000)}</p>`, mediaType: 'text/html', location: url };
  });
  assert.equal(collected.sources[0]?.excerpt.length, 6_000);
  assert.equal(collected.sources[0]?.truncated, true);
  assert.equal(collected.unavailable.length, 1);
  const rendered = await renderResearchReport(root, report(), collected);
  assert.match(rendered, /only the first 6000 characters/);
  assert.match(rendered, /S2: Source unavailable/);
});

test('research accepts only public HTTPS destinations', () => {
  for (const address of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254',
    '172.16.0.1', '192.168.1.1', '192.0.0.1', '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1',
    '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1',
    '2001:db8::1', '2001::1', '2002:7f00:1::', '3fff::1', 'not-an-address']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
  for (const url of ['http://example.com', 'file:///etc/passwd', 'https://user:pass@example.com',
    'https://example.com:8443', 'https://localhost/', 'https://127.1/', 'https://2130706433/',
    'https://[::1]/', 'https://[::ffff:127.0.0.1]/']) assert.throws(() => publicSourceUrl(url), Error, url);
  assert.equal(publicSourceUrl('https://example.com/page#section').href, 'https://example.com/page');
});

test('HTTPS reader validates and pins DNS, checks redirects, status, body limits and media types', async () => {
  const address = { address: '93.184.216.34', family: 4 };
  const response = { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: Buffer.from(observation) };
  const io: NonNullable<Parameters<typeof fetchResearchSource>[2]> = {
    resolve: async () => [address],
    request: async (url, pinned) => { assert.equal(pinned, address); assert.equal(url.hostname, 'example.com'); return response; },
  };
  assert.equal((await fetchResearchSource('https://example.com/source', signal(), io)).body, observation);
  for (const addresses of [[], [{ address: '127.0.0.1', family: 4 }], [address, { address: '10.0.0.1', family: 4 }]]) {
    await assert.rejects(fetchResearchSource('https://example.com', signal(), {
      resolve: async () => addresses, request: async () => { throw new Error('must not request an unsafe address'); },
    }), /non-public address/);
  }
  await assert.rejects(fetchResearchSource('https://example.com', signal(), {
    ...io, request: async () => ({ ...response, status: 302, headers: { location: 'https://127.0.0.1/' } }),
  }), /not a public host/);
  await assert.rejects(fetchResearchSource('https://example.com', signal(), {
    ...io, request: async () => ({ ...response, status: 302, headers: { location: '/again' } }),
  }), /redirect limit/);
  let requests = 0;
  const redirected = await fetchResearchSource('https://example.com', signal(), {
    ...io, request: async () => ++requests === 1
      ? { ...response, status: 302, headers: { location: '/new' } } : response,
  });
  assert.equal(redirected.location, 'https://example.com/new');
  assert.equal(requests, 2);
  for (const bad of [
    { ...response, status: 404 },
    { ...response, headers: { 'content-type': 'application/pdf' } },
    { ...response, headers: { 'content-type': 'text/plain', 'content-encoding': 'gzip' } },
    { ...response, body: Buffer.alloc(512 * 1024 + 1, 65) },
    { ...response, body: Buffer.from([0xff]) },
    { ...response, body: Buffer.from('binary\0content') },
  ]) await assert.rejects(fetchResearchSource('https://example.com', signal(), { ...io, request: async () => bad }));
});

test('research cancellation interrupts DNS collection and prevents network dispatch', async () => {
  const abort = new AbortController();
  const pending = fetchResearchSource('https://example.com', abort.signal, {
    resolve: async () => { abort.abort(); return []; },
    request: async () => { throw new Error('network must not start'); },
  });
  await assert.rejects(pending, /interrupted|abort/i);
  await assert.rejects(fetchResearchSource('https://example.com', abort.signal));
});

test('HTTPS transport pins its socket lookup, refuses oversized streams and propagates interruption', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  let mode = 'success';
  let controller = new AbortController();
  t.mock.method(https, 'request', (_url: URL, options: RequestOptions, callback: (response: EventEmitter) => void) => {
    assert.equal(options.agent, false);
    assert.equal(options.family, 4);
    assert.deepEqual(options.headers, { 'User-Agent': 'Foundry/Research', Accept: 'text/html, text/plain, text/markdown, application/json', 'Accept-Encoding': 'identity' });
    const lookup = options.lookup as (host: string, options: object, cb: (error: unknown, address: string, family: number) => void) => void;
    lookup('example.com', {}, (error, address, family) => {
      assert.equal(error, null);
      assert.equal(address, '93.184.216.34');
      assert.equal(family, 4);
    });
    const outgoing = Object.assign(new EventEmitter(), {
      destroy(error: Error) { queueMicrotask(() => outgoing.emit('error', error)); return outgoing; },
      end() {
        queueMicrotask(() => {
          const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: { 'content-type': 'text/plain' } });
          callback(response);
          if (mode === 'interrupted') {
            const abort = () => outgoing.emit('error', new Error('Source request aborted'));
            options.signal?.addEventListener('abort', abort, { once: true });
            controller.abort();
          } else if (mode === 'broken') response.emit('error', new Error('Stream ended prematurely'));
          else {
            response.emit('data', Buffer.from(observation));
            if (mode === 'oversized') response.emit('data', Buffer.alloc(512 * 1024));
            response.emit('end');
          }
        });
        return outgoing;
      },
    });
    return outgoing;
  });
  assert.equal((await fetchResearchSource('https://example.com', controller.signal)).body, observation);
  for (mode of ['oversized', 'broken', 'interrupted']) {
    controller = new AbortController();
    await assert.rejects(fetchResearchSource('https://example.com', controller.signal), /512 KiB|prematurely|abort/);
  }
});
