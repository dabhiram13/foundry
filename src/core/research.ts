import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { z } from 'zod';
import { readBoundedText } from './factory-contract.js';
import { atomicJson, atomicWrite, digest, FoundryError, now } from './fs.js';

const MAX_BYTES = 512 * 1024;
const MAX_EXCERPT = 6_000;
const sourceSchema = z.object({
  kind: z.enum(['https', 'local']),
  location: z.string().trim().min(1).max(2_048),
}).strict();
export const researchSelectionSchema = z.object({
  sources: z.array(sourceSchema).min(1).max(5),
}).strict().refine(({ sources }) => new Set(sources.map(source => source.location)).size === sources.length,
  'Research sources must be distinct');
export const researchReportSchema = z.object({
  summary: z.string().trim().min(1).max(3_000),
  findings: z.array(z.object({
    claim: z.string().trim().min(1).max(2_000),
    source: z.string().regex(/^S[1-5]$/),
    quote: z.string().trim().min(20).max(1_000),
  }).strict()).min(1).max(20),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(20),
}).strict();

// The provider protocol supports a small JSON Schema subset; bounds are checked locally.
export const selectionOutputSchema = {
  type: 'object', additionalProperties: false, required: ['sources'],
  properties: { sources: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['kind', 'location'],
    properties: { kind: { type: 'string', enum: ['https', 'local'] }, location: { type: 'string' } },
  } } },
};
export const reportOutputSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'findings', 'limitations'],
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['claim', 'source', 'quote'],
      properties: { claim: { type: 'string' }, source: { type: 'string' }, quote: { type: 'string' } },
    } },
    limitations: { type: 'array', items: { type: 'string' } },
  },
};

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['192.88.99.0', 24], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export function publicSourceUrl(location: string): URL {
  const url = new URL(location);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new FoundryError('Research requires public HTTPS without credentials or custom ports');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname || hostname.endsWith('.') || (!hostname.includes('.') && !isIP(hostname))
    || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new FoundryError('Research source is not a public host');
  }
  url.hash = '';
  return url;
}

export interface SourceResponse { body: string; location: string; mediaType: string }
type Address = { address: string; family: number };
type Page = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };

async function requestPage(url: URL, address: Address, signal: AbortSignal): Promise<Page> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, {
      agent: false, signal, family: address.family,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Foundry/Research', Accept: 'text/html, text/plain, text/markdown, application/json', 'Accept-Encoding': 'identity' },
    }, response => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          const error = new FoundryError('Research source exceeds 512 KiB');
          reject(error);
          outgoing.destroy(error);
        }
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

export async function fetchResearchSource(
  location: string,
  signal: AbortSignal,
  io: { resolve: (hostname: string) => Promise<Address[]>; request: typeof requestPage } = {
    resolve: hostname => lookup(hostname, { all: true, verbatim: true }), request: requestPage,
  },
): Promise<SourceResponse> {
  const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  let url = publicSourceUrl(location);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    boundedSignal.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = await new Promise<Address[]>((resolve, reject) => {
      const cleanup = () => boundedSignal.removeEventListener('abort', aborted);
      const aborted = () => { cleanup(); reject(new FoundryError('Research source lookup interrupted')); };
      boundedSignal.addEventListener('abort', aborted, { once: true });
      io.resolve(hostname).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
    boundedSignal.throwIfAborted();
    if (!addresses.length || addresses.some(address => !isPublicAddress(address.address))) {
      throw new FoundryError('Research source resolved to a non-public address');
    }
    const response = await io.request(url, addresses[0]!, boundedSignal);
    boundedSignal.throwIfAborted();
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const target = response.headers.location;
      if (typeof target !== 'string') throw new FoundryError('Research redirect has no location');
      url = publicSourceUrl(new URL(target, url).href);
      continue;
    }
    if (response.status !== 200) throw new FoundryError('Research source did not return HTTP 200');
    const mediaType = String(response.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (!['text/plain', 'text/markdown', 'text/html', 'application/json', 'application/xhtml+xml'].includes(mediaType)
      || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
      throw new FoundryError('Research source must be uncompressed text, HTML or JSON');
    }
    if (response.body.length > MAX_BYTES) throw new FoundryError('Research source exceeds 512 KiB');
    const body = new TextDecoder('utf-8', { fatal: true }).decode(response.body);
    if (body.includes('\0')) throw new FoundryError('Research source is not text');
    return { body, location: url.href, mediaType };
  }
  throw new FoundryError('Research source exceeded the redirect limit');
}

export interface ResearchSource {
  id: string;
  kind: 'https' | 'local';
  requested: string;
  location: string;
  observed_at: string;
  path: string;
  sha256: string;
  excerpt: string;
  truncated: boolean;
}
export interface ResearchCollection {
  sources: ResearchSource[];
  unavailable: { id: string; location: string; reason: string }[];
}

export function researchText(response: SourceResponse): string {
  if (!['text/html', 'application/xhtml+xml'].includes(response.mediaType)) return response.body;
  const document = parse(response.body);
  const pending: DefaultTreeAdapterMap['node'][] = [document];
  const text: string[] = [];
  while (pending.length) {
    const node = pending.pop()!;
    if ('tagName' in node && ['head', 'script', 'style', 'template', 'noscript', 'nav', 'footer'].includes(node.tagName)) continue;
    if (node.nodeName === '#text') text.push((node as DefaultTreeAdapterMap['textNode']).value);
    else if ('childNodes' in node) pending.push(...[...node.childNodes].reverse());
  }
  return normalized(text.join(' '));
}

export async function collectResearchSources(
  root: string, selection: unknown, directory: string, signal: AbortSignal,
  fetchSource: typeof fetchResearchSource = fetchResearchSource,
): Promise<ResearchCollection> {
  const plan = researchSelectionSchema.parse(selection);
  const collection: ResearchCollection = { sources: [], unavailable: [] };
  for (const [index, source] of plan.sources.entries()) {
    signal.throwIfAborted();
    const id = `S${index + 1}`;
    let captured: SourceResponse;
    try {
      if (source.kind === 'local') {
        if (!/^(README\.md|docs\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:md|txt))$/.test(source.location)
          || source.location === 'docs/product/research.md') {
          throw new FoundryError('Local sources must be project documentation, not state, secrets or the report itself');
        }
        const { text } = await readBoundedText(root, source.location, MAX_BYTES);
        captured = { body: text, location: source.location, mediaType: 'text/plain' };
      } else {
        publicSourceUrl(source.location);
        captured = await fetchSource(source.location, signal);
      }
      captured.body = researchText(captured);
      if (!captured.body.trim()) throw new FoundryError('Research source is empty');
    } catch {
      signal.throwIfAborted();
      collection.unavailable.push({ id, location: source.location, reason: 'Source unavailable, unsupported or refused by source safety checks' });
      continue;
    }
    signal.throwIfAborted();
    const file = `${directory}/${id}.txt`;
    await atomicWrite(root, file, captured.body);
    collection.sources.push({
      id, kind: source.kind, requested: source.location, location: captured.location,
      observed_at: now(), path: file, sha256: digest(captured.body),
      excerpt: captured.body.slice(0, MAX_EXCERPT), truncated: captured.body.length > MAX_EXCERPT,
    });
  }
  await atomicJson(root, `${directory}/sources.json`, collection);
  if (!collection.sources.length) throw new FoundryError('Research needs at least one readable source; inspect the saved source receipt and retry');
  return collection;
}

function normalized(text: string): string { return text.replace(/\s+/g, ' ').trim(); }

export async function renderResearchReport(root: string, report: unknown, collection: ResearchCollection): Promise<string> {
  const parsed = researchReportSchema.parse(report);
  for (const source of collection.sources) {
    if (digest((await readBoundedText(root, source.path, MAX_BYTES)).bytes) !== source.sha256) {
      throw new FoundryError('Research source snapshot changed during synthesis');
    }
  }
  for (const finding of parsed.findings) {
    const source = collection.sources.find(item => item.id === finding.source);
    if (!source || !normalized(source.excerpt).includes(normalized(finding.quote))) {
      throw new FoundryError('Research findings must quote the supplied source content');
    }
  }
  const limitations = [
    ...parsed.limitations,
    ...collection.unavailable.map(source => `${source.id}: ${source.reason}.`),
    ...collection.sources.filter(source => source.truncated).map(source => `${source.id}: only the first ${MAX_EXCERPT} characters were supplied to the researcher.`),
    ...(collection.sources.every(source => source.kind === 'local') ? ['Local documents only; external claims and market demand have not been verified.'] : []),
    'Matching quotations demonstrate source use, not that the source or the interpretation is correct. Review claims before approving the plan.',
  ];
  return [
    '# Research', '', parsed.summary, '', '## Findings', '',
    ...parsed.findings.flatMap(finding => [`- ${finding.claim} [${finding.source}]`, '', ...finding.quote.split('\n').map(line => `> ${line}`), '']),
    '## Sources', '',
    ...collection.sources.flatMap(source => [
      `- ${source.id}: ${source.location}`, `  - Read: ${source.observed_at}`,
      `  - Snapshot: ${source.path}`, `  - SHA-256: ${source.sha256}`,
    ]), '', '## Limits and open questions', '', ...limitations.map(item => `- ${item}`), '',
  ].join('\n');
}
