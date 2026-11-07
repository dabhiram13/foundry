import { z } from 'zod';
import { readBoundedBytes } from './factory-contract.js';
import { canonicalJson, exists, FoundryError } from './fs.js';

const name = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]{0,127}$/;
const RESERVED_ENVIRONMENT = /^(?:PATH|HOME|USER|SHELL|TMPDIR|LANG|TZ|NODE_OPTIONS|OPENCODE_.*|FOUNDRY_.*|XDG_.*)$/;

/** Names an owner-held secret without containing it. Foundry reads the value only for the selected connection. */
export const credentialReferenceSchema = z.strictObject({
  kind: z.literal('env'),
  name: z.string().regex(ENVIRONMENT_NAME).refine(value => !RESERVED_ENVIRONMENT.test(value), 'Reserved environment name'),
});
export type CredentialReference = z.infer<typeof credentialReferenceSchema>;

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

export const localTestEndpoint = z.url().max(2048).refine(value => {
  const url = plainUrl(value);
  return !!url && url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === '/v1' && Number(url.port) > 0;
}, 'Local test endpoints must be http://127.0.0.1:PORT/v1');

export const remoteEndpoint = z.url().max(2048).refine(value => {
  const url = plainUrl(value);
  return !!url && url.protocol === 'https:' && !loopbackHost(url.hostname) && (!url.port || url.port === '443')
    && /^\/[A-Za-z0-9._~/-]{0,256}$/.test(url.pathname) && !url.pathname.split('/').includes('..');
}, 'Remote endpoints must be plain HTTPS base URLs without credentials, query or fragment');

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

/** Reads only the referenced variable. The value is never returned to callers that report or persist state. */
export function resolveCredential(reference: CredentialReference, source: NodeJS.ProcessEnv = process.env): string {
  const parsed = credentialReferenceSchema.parse(reference);
  const value = source[parsed.name];
  if (typeof value !== 'string' || value.length < 8 || value.length > 4096 || /[\s\0]/.test(value)) {
    throw new FoundryError(`Credential reference ${parsed.name} is not set to a usable value`);
  }
  return value;
}

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
