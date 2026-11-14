import { BlockList, isIP } from 'node:net';
import { z } from 'zod';
import { readBoundedBytes } from './factory-contract.js';
import { credentialReferenceSchema, resolveCredential } from './credential-reference.js';
import { canonicalJson, exists, FoundryError } from './fs.js';

export { credentialReferenceSchema, resolveCredential, type CredentialReference } from './credential-reference.js';

const name = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);

function plainUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.username || url.password || url.search || url.hash ? null : url;
  } catch { return null; }
}

function loopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.startsWith('127.')
    || host === '0.0.0.0' || host === '::';
}

const NON_PUBLIC = new BlockList();
for (const [network, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) {
  NON_PUBLIC.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [['::', 127], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  NON_PUBLIC.addSubnet(network, prefix, 'ipv6');
}

/** True only for globally routable unicast addresses. Remote connections never reach private, loopback or link-local hosts. */
export function publicAddress(value: string): boolean {
  const address = value.replace(/^\[|\]$/g, '').toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address)?.[1];
  if (mapped) return publicAddress(mapped);
  if (/^::ffff:/.test(address)) return false;
  const family = isIP(address);
  if (family === 4) return !NON_PUBLIC.check(address, 'ipv4');
  if (family === 6) return !NON_PUBLIC.check(address, 'ipv6');
  return false;
}

export const localTestEndpoint = z.url().max(2048).refine(value => {
  const url = plainUrl(value);
  return !!url && url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === '/v1' && Number(url.port) > 0;
}, 'Local test endpoints must be http://127.0.0.1:PORT/v1');

export const remoteEndpoint = z.url().max(2048).refine(value => {
  const url = plainUrl(value);
  return !!url && url.protocol === 'https:' && !loopbackHost(url.hostname)
    && (!isIP(url.hostname.replace(/^\[|\]$/g, '')) || publicAddress(url.hostname)) && (!url.port || url.port === '443')
    && /^\/[A-Za-z0-9._~/-]{0,256}$/.test(url.pathname) && !url.pathname.split('/').includes('..');
}, 'Remote endpoints must be plain public HTTPS base URLs without credentials, query or fragment');

export const localTestConnectionSchema = z.strictObject({
  mode: z.literal('local-test'), id: name, model: name, baseURL: localTestEndpoint,
});
export const remoteConnectionSchema = z.strictObject({
  mode: z.literal('remote'), id: name, model: name, baseURL: remoteEndpoint,
  api: z.literal('openai-chat-completions'), credential: credentialReferenceSchema,
});
export const connectionProfileSchema = z.discriminatedUnion('mode', [localTestConnectionSchema, remoteConnectionSchema]);
export type ConnectionProfile = z.infer<typeof connectionProfileSchema>;
export type RemoteConnection = z.infer<typeof remoteConnectionSchema>;

export const connectionRegistrySchema = z.strictObject({
  connections: z.array(z.strictObject({ name, profile: connectionProfileSchema })).max(32)
    .refine(items => new Set(items.map(item => item.name)).size === items.length, 'Connection names must be unique'),
});


export function inspectConnection(profile: ConnectionProfile, source: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const parsed = connectionProfileSchema.parse(profile);
  const base = { mode: parsed.mode, provider: parsed.id, model: parsed.model, endpoint: new URL(parsed.baseURL).origin };
  if (parsed.mode === 'local-test') return { ...base, credential: 'none', inference: 'local-test-only', authentication: 'not_applicable' };
  let credential: 'present' | 'missing' = 'present';
  try { resolveCredential(parsed.credential, source); } catch { credential = 'missing'; }
  return { ...base, api: parsed.api, credential_reference: `env:${parsed.credential.name}`, credential,
    inference: 'requires-consent', authentication: 'not_checked' };
}


export const CONNECTIONS_FILE = '.foundry/connections.json';
export type RegisteredConnection = z.infer<typeof connectionRegistrySchema>['connections'][number];

/** Owner-authored registry. A missing file means no connection is admitted. */
export async function readConnections(root: string): Promise<RegisteredConnection[]> {
  if (!(await exists(root, CONNECTIONS_FILE))) return [];
  let document: unknown;
  try { document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBoundedBytes(root, CONNECTIONS_FILE, 64 * 1024))); }
  catch (error) { throw new FoundryError(`Cannot read JSON ${CONNECTIONS_FILE}`, { cause: error }); }
  const parsed = connectionRegistrySchema.safeParse(document);
  if (!parsed.success) throw new FoundryError(`Invalid ${CONNECTIONS_FILE}: ${parsed.error.issues.map(issue => issue.message).join('; ')}`);
  return parsed.data.connections;
}

export async function requireRegisteredConnection(root: string, profile: ConnectionProfile): Promise<RegisteredConnection> {
  const selected = canonicalJson(connectionProfileSchema.parse(profile));
  const match = (await readConnections(root)).find(entry => canonicalJson(entry.profile) === selected);
  if (!match) throw new FoundryError(`Connection is not registered in ${CONNECTIONS_FILE}; remote access is denied by default`);
  return match;
}
