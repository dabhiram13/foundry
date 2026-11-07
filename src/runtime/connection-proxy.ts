import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { RemoteManagedProfile } from '../core/managed-profile.js';

export type ConnectionForward = (url: string, init: RequestInit) => Promise<Response>;
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
 * Loopback relay for one managed execution. The executor receives a random per-run token,
 * never the owner credential. Only chat completions for the selected model reach the
 * selected HTTPS endpoint, within the request and output-token limits.
 */
export async function startConnectionProxy(profile: RemoteManagedProfile, credential: string, signal: AbortSignal,
  forward: ConnectionForward = (url, init) => fetch(url, init)): Promise<ConnectionProxy> {
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
