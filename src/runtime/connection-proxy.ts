import { randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { publicAddress } from '../core/connection-profile.js';
import type { RemoteManagedProfile } from '../core/managed-profile.js';

export type ConnectionForward = (url: string, init: RequestInit) => Promise<Response>;
export type AddressResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
export type ConnectionProxy = { baseURL: string; token: string; requests: () => number; close: () => Promise<void> };

const BODY_LIMIT = 4 * 1024 * 1024;

function deny(response: ServerResponse, status: number, message: string): void {
  if (!response.headersSent) response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: { message } }));
}

async function body(request: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > BODY_LIMIT) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function bounded(document: Record<string, unknown>, limit: number): void {
  let applied = false;
  for (const key of ['max_tokens', 'max_completion_tokens']) {
    if (document[key] === undefined) continue;
    const value = document[key];
    document[key] = typeof value === 'number' && Number.isInteger(value) && value > 0 ? Math.min(value, limit) : limit;
    applied = true;
  }
  if (!applied) document.max_tokens = limit;
}

/**
 * HTTPS forwarder that connects only to the public addresses it validated, so a registered
 * hostname cannot be pointed at a private host by DNS. Redirects are refused, not followed.
 */
export function publicForward(resolve: AddressResolver = hostname => dnsLookup(hostname, { all: true, verbatim: true })): ConnectionForward {
  return (url, init) => new Promise<Response>((settle, fail) => {
    const target = new URL(url);
    if (target.protocol !== 'https:') { fail(new Error('Remote connections require HTTPS')); return; }
    const lookup = ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
      resolve(hostname).then(addresses => {
        if (!addresses.length || !addresses.every(item => publicAddress(item.address))) {
          callback(new Error('Remote connection host does not resolve only to public addresses'), '', 4);
        } else if (options.all) callback(null, addresses);
        else callback(null, addresses[0]!.address, addresses[0]!.family);
      }, error => callback(error, '', 4));
    }) as unknown as LookupFunction;
    const request = httpsRequest(target, {
      method: init.method ?? 'POST', headers: init.headers as Record<string, string>, signal: init.signal ?? undefined, lookup,
    }, response => {
      const status = response.statusCode ?? 502;
      if (status < 200 || status >= 300 && status < 400) {
        response.resume();
        fail(new Error('Remote connection redirects are not followed'));
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(response.headers)) {
        for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) headers.append(key, item);
      }
      settle(new Response(Readable.toWeb(response) as unknown as ReadableStream, { status, headers }));
    });
    request.once('error', fail);
    request.end(typeof init.body === 'string' ? init.body : undefined);
  });
}

/**
 * Loopback relay for one managed execution. The executor receives a random per-run token,
 * never the owner credential. Only chat completions for the selected model reach the
 * selected HTTPS endpoint, within the request and output-token limits.
 */
export async function startConnectionProxy(profile: RemoteManagedProfile, credential: string, signal: AbortSignal,
  forward: ConnectionForward = publicForward()): Promise<ConnectionProxy> {
  const token = randomBytes(32).toString('hex');
  const expected = Buffer.from(`Bearer ${token}`);
  const upstream = `${profile.provider.baseURL.replace(/\/+$/, '')}/chat/completions`;
  let count = 0;
  const server = createServer(async (request, response) => {
    try {
      const authorization = Buffer.from(request.headers.authorization ?? '');
      if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) return deny(response, 401, 'Unauthorized');
      if (request.method !== 'POST' || request.url !== '/v1/chat/completions') return deny(response, 403, 'Only chat completions are permitted');
      if (signal.aborted) return deny(response, 503, 'Managed execution stopped');
      const raw = await body(request);
      if (!raw) return deny(response, 413, 'Request too large');
      let document: unknown;
      try { document = JSON.parse(raw.toString('utf8')); } catch { return deny(response, 400, 'Invalid JSON'); }
      if (typeof document !== 'object' || document === null || Array.isArray(document)) return deny(response, 400, 'Invalid request');
      const fields = document as Record<string, unknown>;
      if (fields.model !== profile.provider.model) return deny(response, 403, 'Only the selected model is permitted');
      if (fields.n !== undefined && fields.n !== 1) return deny(response, 400, 'Only one completion per request is permitted');
      if (count >= profile.limits.maxRequests) return deny(response, 429, 'Managed request limit reached');
      count++;
      bounded(fields, profile.limits.maxOutputTokens);
      const result = await forward(upstream, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'content-type': 'application/json', accept: request.headers.accept ?? 'application/json', authorization: `Bearer ${credential}` },
        body: JSON.stringify(fields),
      });
      response.writeHead(result.status, { 'content-type': result.headers.get('content-type') ?? 'application/json' });
      if (result.body) await pipeline(Readable.fromWeb(result.body as import('node:stream/web').ReadableStream), response);
      else response.end();
    } catch {
      if (response.headersSent) response.destroy();
      else deny(response, 502, 'Upstream request failed');
    }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('Connection relay did not bind');
  const onAbort = () => server.closeAllConnections();
  signal.addEventListener('abort', onAbort, { once: true });
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`, token, requests: () => count,
    close: async () => {
      signal.removeEventListener('abort', onAbort);
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
