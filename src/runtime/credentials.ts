import { randomBytes, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { FoundryError } from '../core/fs.js';
import { BASE_ENVIRONMENT } from './environment.js';

const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CREDENTIAL_MODES = ['subscription', 'api', 'local'] as const;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const CREDENTIAL_HEADERS = ['authorization', 'x-api-key', 'api-key'] as const;
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
  'transfer-encoding', 'upgrade', 'host', 'cookie', 'content-length', ...CREDENTIAL_HEADERS,
]);
export const SENSITIVE_ENVIRONMENT_NAME = /api[_-]?key|token|secret|password|passwd|credential|private[_-]?key/i;

function loopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === '[::1]' || hostname === 'localhost';
}

const environmentName = z.string().regex(ENVIRONMENT_NAME);
const upstream = z.string().max(2048).superRefine((value, context) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    context.addIssue({ code: 'custom', message: 'Credential upstream must be an absolute URL' });
    return;
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopbackHost(parsed.hostname))) {
    context.addIssue({ code: 'custom', message: 'Credential upstream must use HTTPS, or HTTP only for a loopback test server' });
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    context.addIssue({ code: 'custom', message: 'Credential upstream cannot contain credentials, a query or a fragment' });
  }
});
const common = {
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  source_env: environmentName,
  billing_modes: z.array(z.enum(CREDENTIAL_MODES)).min(1)
    .refine(modes => new Set(modes).size === modes.length, 'Credential billing modes must be unique'),
};

export const credentialReferenceSchema = z.discriminatedUnion('delivery', [
  z.object({
    ...common,
    delivery: z.literal('broker'),
    upstream,
    header: z.enum(CREDENTIAL_HEADERS),
    base_url_env: environmentName,
    token_env: environmentName,
  }).strict(),
  z.object({
    ...common,
    delivery: z.literal('environment'),
    target_env: environmentName,
  }).strict(),
]);

export type CredentialReference = z.infer<typeof credentialReferenceSchema>;

export interface CredentialReceipt {
  id: string;
  delivery: 'broker' | 'environment';
  source_env: string;
  exposed_to_adapter_process: boolean;
  upstream_origin?: string;
  requests?: number;
  rejected_requests?: number;
}

export interface CredentialSession {
  environment: Record<string, string>;
  secrets: string[];
  receipts: CredentialReceipt[];
  revoke(): void;
  close(): Promise<void>;
}

export function validateCredentialReferences(
  references: readonly CredentialReference[],
  adapterEnvironment: readonly string[] = [],
): void {
  const ids = new Set<string>();
  const delivered = new Set<string>();
  const sources = new Set(references.map(reference => reference.source_env));
  for (const reference of references) {
    if (ids.has(reference.id)) throw new FoundryError('Credential IDs must be unique');
    ids.add(reference.id);
    if (BASE_ENVIRONMENT.includes(reference.source_env) || adapterEnvironment.includes(reference.source_env)) {
      throw new FoundryError(`Credential ${reference.id} source cannot also be a passed environment name`);
    }
    const targets = reference.delivery === 'broker' ? [reference.base_url_env, reference.token_env] : [reference.target_env];
    for (const target of targets) {
      if (delivered.has(target) || BASE_ENVIRONMENT.includes(target) || adapterEnvironment.includes(target)
        || (reference.delivery === 'broker' && sources.has(target))) {
        throw new FoundryError(`Credential ${reference.id} delivery name ${target} collides with another environment name`);
      }
      delivered.add(target);
    }
  }
}

function selected(references: readonly CredentialReference[], mode: string): CredentialReference[] {
  return references.filter(reference => (reference.billing_modes as readonly string[]).includes(mode));
}

export function missingCredentials(
  references: readonly CredentialReference[],
  mode: string,
  source: NodeJS.ProcessEnv = process.env,
): string[] {
  return selected(references, mode).filter(reference => !source[reference.source_env]).map(reference => reference.id);
}

export function describeCredentials(
  references: readonly CredentialReference[],
  source: NodeJS.ProcessEnv = process.env,
): Record<string, unknown>[] {
  return references.map(reference => ({
    id: reference.id,
    delivery: reference.delivery,
    source_env: reference.source_env,
    billing_modes: reference.billing_modes,
    present: Boolean(source[reference.source_env]),
    exposed_to_adapter_process: reference.delivery === 'environment',
    ...(reference.delivery === 'broker' ? { upstream_origin: new URL(reference.upstream).origin } : {}),
  }));
}

function matchesToken(request: http.IncomingMessage, token: Buffer): boolean {
  const candidates: string[] = [];
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && /^Bearer\s+/i.test(authorization)) candidates.push(authorization.replace(/^Bearer\s+/i, ''));
  for (const name of ['x-api-key', 'api-key']) {
    const value = request.headers[name];
    if (typeof value === 'string') candidates.push(value);
  }
  return candidates.some(candidate => {
    const bytes = Buffer.from(candidate);
    return bytes.length === token.length && timingSafeEqual(bytes, token);
  });
}

function upstreamTarget(base: URL, requestUrl: string | undefined): URL | null {
  if (!requestUrl || !requestUrl.startsWith('/') || requestUrl.startsWith('//')) return null;
  const prefix = base.pathname.replace(/\/+$/, '');
  const target = new URL(`${prefix}${requestUrl}`, base.origin);
  if (target.origin !== base.origin) return null;
  if (prefix && target.pathname !== prefix && !target.pathname.startsWith(`${prefix}/`)) return null;
  return target;
}

interface Broker {
  receipt: CredentialReceipt;
  environment: Record<string, string>;
  token: string;
  revoke(): void;
  close(): Promise<void>;
}

async function startBroker(reference: Extract<CredentialReference, { delivery: 'broker' }>, secret: string): Promise<Broker> {
  const base = new URL(reference.upstream);
  const token = randomBytes(32).toString('base64url');
  const tokenBytes = Buffer.from(token);
  const receipt: CredentialReceipt = {
    id: reference.id, delivery: 'broker', source_env: reference.source_env,
    exposed_to_adapter_process: false, upstream_origin: base.origin, requests: 0, rejected_requests: 0,
  };
  let revoked = false;
  const active = new Set<http.ClientRequest>();
  const sockets = new Set<import('node:net').Socket>();
  const reject = (response: http.ServerResponse, status: number, code: string): void => {
    receipt.rejected_requests = (receipt.rejected_requests ?? 0) + 1;
    if (!response.headersSent) response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code, message: 'Foundry credential broker refused the request' } }));
  };
  const server = http.createServer((request, response) => {
    if (revoked) return reject(response, 403, 'credential_revoked');
    if (!matchesToken(request, tokenBytes)) return reject(response, 401, 'broker_token_required');
    const target = upstreamTarget(base, request.url);
    if (!target) return reject(response, 400, 'upstream_path_rejected');
    receipt.requests = (receipt.requests ?? 0) + 1;
    const headers: http.OutgoingHttpHeaders = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (!HOP_BY_HOP.has(name.toLowerCase()) && value !== undefined) headers[name] = value;
    }
    headers[reference.header] = reference.header === 'authorization' ? `Bearer ${secret}` : secret;
    const client = (target.protocol === 'https:' ? https : http).request(target, { method: request.method, headers });
    active.add(client);
    client.on('close', () => active.delete(client));
    client.on('response', (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders['set-cookie'];
      response.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders);
      upstreamResponse.pipe(response);
      upstreamResponse.on('error', () => response.destroy());
    });
    client.on('error', () => {
      if (response.headersSent) response.destroy();
      else reject(response, 502, revoked ? 'credential_revoked' : 'upstream_unavailable');
    });
    let bytes = 0;
    request.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) {
        client.destroy();
        reject(response, 413, 'request_too_large');
        request.destroy();
        return;
      }
      client.write(chunk);
    });
    request.on('end', () => client.end());
    request.on('error', () => client.destroy());
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  const revoke = (): void => {
    revoked = true;
    for (const client of active) client.destroy();
  };
  return {
    receipt,
    token,
    environment: { [reference.base_url_env]: `http://127.0.0.1:${port}`, [reference.token_env]: token },
    revoke,
    close: async () => {
      revoke();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

export async function openCredentialSession(
  references: readonly CredentialReference[],
  mode: string,
  source: NodeJS.ProcessEnv = process.env,
): Promise<CredentialSession> {
  const missing = missingCredentials(references, mode, source);
  if (missing.length) throw new FoundryError(`Selected credentials are not set: ${missing.join(', ')}`);
  const brokers: Broker[] = [];
  const environment: Record<string, string> = {};
  const secrets: string[] = [];
  const receipts: CredentialReceipt[] = [];
  try {
    for (const reference of selected(references, mode)) {
      const secret = source[reference.source_env] as string;
      secrets.push(secret);
      if (reference.delivery === 'environment') {
        environment[reference.target_env] = secret;
        receipts.push({ id: reference.id, delivery: 'environment', source_env: reference.source_env, exposed_to_adapter_process: true });
      } else {
        const broker = await startBroker(reference, secret);
        brokers.push(broker);
        Object.assign(environment, broker.environment);
        secrets.push(broker.token);
        receipts.push(broker.receipt);
      }
    }
  } catch (error) {
    await Promise.allSettled(brokers.map(broker => broker.close()));
    throw error;
  }
  return {
    environment,
    secrets,
    receipts,
    revoke: () => brokers.forEach(broker => broker.revoke()),
    close: async () => {
      await Promise.allSettled(brokers.map(broker => broker.close()));
    },
  };
}
