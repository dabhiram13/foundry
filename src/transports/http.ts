import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { URL } from 'node:url';
import { FoundryError, rejectSymlinkComponents } from '../core/fs.js';
import { readBoundedBytes } from '../core/factory-contract.js';
import { ProjectService } from '../core/projects.js';
import { closeProjectRuns, startProjectRun } from './jobs.js';

type JsonRecord = Record<string, unknown>;
type Asset = { file: string; contentType: string };

const MAX_BODY = 256 * 1024;
const MAX_STATIC_FILE = 8 * 1024 * 1024;
const BODY_TIMEOUT_MS = 5_000;

function contentType(file: string): string {
  const extension = path.extname(file).toLowerCase();
  return ({
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  } as Record<string, string>)[extension] ?? 'application/octet-stream';
}

async function collectAssets(root: string, relative: string, prefix: string): Promise<Map<string, Asset>> {
  const assets = new Map<string, Asset>();
  const directory = path.join(root, relative);
  try {
    rejectSymlinkComponents(directory);
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const childRelative = path.join(relative, entry.name);
      const childUrl = `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        for (const [url, asset] of await collectAssets(root, childRelative, childUrl)) assets.set(url, asset);
      } else if (entry.isFile()) {
        const url = childUrl.endsWith('/index.html') ? childUrl.slice(0, -10) : childUrl;
        assets.set(url, { file: childRelative, contentType: contentType(entry.name) });
      }
    }
  } catch {
    return assets;
  }
  return assets;
}

async function collectDocumentationAssets(root: string): Promise<Map<string, Asset>> {
  const assets = new Map<string, Asset>();
  for (const namespace of ['docs', '_astro', 'pagefind']) {
    for (const [url, asset] of await collectAssets(root, `site/dist/${namespace}`, `/${namespace}`)) {
      assets.set(url, asset);
    }
  }
  return assets;
}

function documentationPolicy(content: string): string {
  const hashes = (tag: 'script' | 'style') => [...content.matchAll(new RegExp(`<${tag}\\b[^>]*>(.*?)</${tag}>`, 'gis'))]
    .map((match) => `'sha256-${crypto.createHash('sha256').update(match[1] ?? '').digest('base64')}'`);
  const scriptHashes = hashes('script');
  const styleHashes = hashes('style');
  return `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(' ')}; style-src 'self' ${styleHashes.join(' ')}; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(process.cwd(), '[project]')
    .replace(/(?:sk|api|access)[-_]?[a-z0-9_-]{12,}/gi, '[redacted]')
    .slice(0, 300);
}

async function body(request: IncomingMessage): Promise<JsonRecord> {
  const length = Number(request.headers['content-length'] ?? 0);
  if (!Number.isInteger(length) || length <= 0 || length > MAX_BODY) {
    throw new FoundryError('Request must be between 1 byte and 256 KiB');
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const timer = setTimeout(() => request.destroy(new Error('Request body timed out')), BODY_TIMEOUT_MS);
  timer.unref();
  try {
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length;
      if (total > MAX_BODY) throw new FoundryError('Request body exceeds the 256 KiB limit');
      chunks.push(bytes);
    }
  } finally {
    clearTimeout(timer);
  }
  if (total !== length) throw new FoundryError('Request body was incomplete');
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FoundryError('Expected a JSON object');
  }
  return parsed as JsonRecord;
}

function response(
  request: IncomingMessage,
  result: ServerResponse,
  status: number,
  payload: unknown,
  content = 'application/json',
  nonce?: string,
  policy?: string,
): void {
  const bytes = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(content === 'application/json' ? JSON.stringify(payload) : String(payload));
  result.writeHead(status, {
    'Content-Type': `${content}${content.startsWith('text/') || content === 'application/json' ? '; charset=utf-8' : ''}`,
    'Content-Length': bytes.byteLength,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': policy
      ?? `default-src 'self'; script-src 'self'; style-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''}; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`,
  });
  result.end(bytes);
}

function redirect(result: ServerResponse, location: string): void {
  result.writeHead(302, { Location: location, 'Content-Length': 0, 'Cache-Control': 'no-store' });
  result.end();
}

function verifyLocalOrigin(request: IncomingMessage, port: number, token: string, protectedRoute: boolean): void {
  const host = `127.0.0.1:${port}`;
  if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== `http://${host}`)) {
    throw new FoundryError('Only the local Foundry origin is allowed');
  }
  if (protectedRoute && request.headers['x-foundry-token'] !== token) {
    throw new FoundryError('Open Foundry locally to authorize this action');
  }
}

function strictKeys(data: JsonRecord, allowed: string[]): void {
  const unknown = Object.keys(data).find((key) => !allowed.includes(key));
  if (unknown) throw new FoundryError(`Unknown request field: ${unknown}`);
}

function optionalString(data: JsonRecord, key: string, nullable = false): string | null | undefined {
  if (!Object.hasOwn(data, key)) return undefined;
  const value = data[key];
  if (nullable && value === null) return null;
  if (typeof value !== 'string') throw new FoundryError(`${key} must be a ${nullable ? 'string or null' : 'string'}`);
  return value;
}

function optionalRecord(data: JsonRecord, key: string): JsonRecord | undefined {
  if (!Object.hasOwn(data, key)) return undefined;
  const value = data[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FoundryError(`${key} must be a JSON object`);
  }
  return value as JsonRecord;
}

async function dispatch(service: ProjectService, action: string, data: JsonRecord): Promise<unknown> {
  if (action === 'snapshot') {
    if (Object.keys(data).length) throw new FoundryError('snapshot does not accept request data');
    return service.snapshot();
  }
  if (action === 'models') {
    if (Object.keys(data).length) throw new FoundryError('models does not accept request data');
    return service.models();
  }
  if (action === 'create') {
    strictKeys(data, ['name', 'idea', 'adapter', 'model', 'reasoning']);
    if (typeof data.name !== 'string' || typeof data.idea !== 'string') throw new FoundryError('Create requires name and idea');
    return service.create({
      name: data.name,
      idea: data.idea,
      adapter: optionalString(data, 'adapter') as string | undefined,
      model: optionalString(data, 'model', true),
      reasoning: optionalString(data, 'reasoning', true),
    });
  }
  if (action === 'configure') {
    strictKeys(data, ['id', 'adapter', 'model', 'reasoning', 'subscription_confirmed', 'roles', 'factory_roles', 'role_settings']);
    if (typeof data.id !== 'string') throw new FoundryError('Configure requires a project ID');
    if (data.subscription_confirmed !== undefined && typeof data.subscription_confirmed !== 'boolean') {
      throw new FoundryError('subscription_confirmed must be a boolean');
    }
    if (data.roles !== undefined && data.role_settings !== undefined) {
      throw new FoundryError('Provide roles or role_settings, not both');
    }
    const roles = optionalRecord(data, 'roles');
    const roleSettings = optionalRecord(data, 'role_settings') ?? roles;
    const factoryRoles = optionalRecord(data, 'factory_roles');
    return service.configure(data.id, {
      adapter: optionalString(data, 'adapter') as string | undefined,
      model: optionalString(data, 'model', true),
      reasoning: optionalString(data, 'reasoning', true),
      billing: data.subscription_confirmed === true ? 'subscription' : undefined,
      confirmed: data.subscription_confirmed as boolean | undefined,
      factory_roles: factoryRoles as FactoryRoleMapData | undefined,
      role_settings: roleSettings as FactoryStateRoleSettings | undefined,
    });
  }
  if (action === 'run') {
    strictKeys(data, ['id']);
    if (typeof data.id !== 'string') throw new FoundryError('Run requires a project ID');
    return startProjectRun(service, data.id);
  }
  if (action === 'approve') {
    strictKeys(data, ['id', 'reviewed_revision']);
    if (typeof data.id !== 'string' || typeof data.reviewed_revision !== 'string') {
      throw new FoundryError('Approval requires the reviewed document revision');
    }
    return service.approve(data.id, data.reviewed_revision);
  }
  if (action === 'cancel') {
    strictKeys(data, ['id']);
    if (typeof data.id !== 'string') throw new FoundryError('Cancel requires a project ID');
    return service.stop(data.id);
  }
  if (action === 'recover') {
    strictKeys(data, ['id']);
    if (typeof data.id !== 'string') throw new FoundryError('Recover requires a project ID');
    return service.recover(data.id);
  }
  if (action === 'sign-in' || action === 'sign-out') {
    throw new FoundryError('Account login is handled through the runtime CLI; this action has no side effects');
  }
  throw new FoundryError('Unknown local API action');
}

type FactoryStateRoleSettings = Record<string, { model?: string | null; reasoning?: string | null }>;
type FactoryRoleMapData = Record<string, string>;

export interface HttpOptions {
  port?: number;
  openBrowser?: boolean;
}

export interface HttpHandle {
  server: Server;
  token: string;
  close(): Promise<void>;
}

export async function startHttpServer(service: ProjectService, options: HttpOptions = {}): Promise<HttpHandle> {
  const requestedPort = options.port ?? 4321;
  const token = crypto.randomBytes(32).toString('base64url');
  const assets = await collectAssets(service.sourceRoot, 'app/assets', '/assets');
  const docs = await collectDocumentationAssets(service.sourceRoot);
  const staticFiles = new Map<string, Asset>([
    ['/', { file: 'app/index.html', contentType: 'text/html' }],
    ['/index.html', { file: 'app/index.html', contentType: 'text/html' }],
    ['/app.js', { file: 'app/app.js', contentType: 'text/javascript' }],
    ['/style.css', { file: 'app/style.css', contentType: 'text/css' }],
    ...assets,
    ...docs,
  ]);
  const server = createServer(async (request, result) => {
    const address = server.address();
    const hostPort = address && typeof address !== 'string' ? address.port : requestedPort;
    try {
      const parsed = new URL(request.url ?? '/', `http://127.0.0.1:${hostPort}`);
      const isApi = parsed.pathname.startsWith('/api/');
      verifyLocalOrigin(request, hostPort, token, isApi);
      if (isApi) {
        if (request.method === 'GET') {
          const action = parsed.pathname.slice('/api/'.length);
          if (action === 'snapshot' || action === 'models') {
            response(request, result, 200, await dispatch(service, action, {}));
          } else if (action === 'artifact') {
            const id = parsed.searchParams.get('id');
            const artifactPath = parsed.searchParams.get('path');
            if (!id || !artifactPath) throw new FoundryError('Artifact requires id and path');
            response(request, result, 200, await service.artifact(id, artifactPath));
          } else {
            throw new FoundryError('Unknown local API action');
          }
          return;
        }
        if (request.method !== 'POST') {
          result.writeHead(405, { Allow: 'GET, POST', 'Content-Length': 0 });
          result.end();
          return;
        }
        if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
          throw new FoundryError('Use application/json');
        }
        const action = parsed.pathname.slice('/api/'.length);
        if (!/^[a-z-]+$/.test(action)) throw new FoundryError('Unknown local API action');
        response(request, result, 200, await dispatch(service, action, await body(request)));
        return;
      }
      if (request.method !== 'GET') {
        result.writeHead(405, { Allow: 'GET', 'Content-Length': 0 });
        result.end();
        return;
      }
      if (parsed.pathname === '/docs') {
        redirect(result, '/docs/');
        return;
      }
      const asset = staticFiles.get(parsed.pathname);
      if (!asset) {
        if (parsed.pathname.startsWith('/docs/') && docs.size === 0) {
          redirect(result, 'https://github.com/dabhiram13/foundry/blob/main/docs/README.md');
          return;
        }
        response(request, result, 404, { error: 'Not found' });
        return;
      }
      rejectSymlinkComponents(path.join(service.sourceRoot, asset.file));
      const bytes = await readBoundedBytes(service.sourceRoot, asset.file, MAX_STATIC_FILE);
      if (asset.file === 'app/index.html') {
        const nonce = crypto.randomBytes(24).toString('base64url');
        const html = bytes.toString('utf8')
          .replaceAll('__FOUNDRY_TOKEN__', token)
          .replaceAll('__FOUNDRY_STYLE_NONCE__', nonce);
        response(request, result, 200, html, 'text/html', nonce);
      } else {
        const docsPolicy = asset.file.startsWith('site/dist/')
          ? documentationPolicy(asset.contentType === 'text/html' ? bytes.toString('utf8') : '')
          : undefined;
        response(request, result, 200, bytes, asset.contentType, undefined, docsPolicy);
      }
    } catch (error) {
      if (request.socket.destroyed || result.destroyed || result.writableEnded) return;
      const status = error instanceof FoundryError
        && (safeError(error).startsWith('Only the local') || safeError(error).startsWith('Open Foundry'))
        ? 403 : 400;
      response(request, result, status, { error: safeError(error) });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : requestedPort;
  let closePromise: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (closePromise) return closePromise;
    const serverClosed = new Promise<void>((resolve) => server.close(() => resolve()));
    closePromise = (async () => {
      const confirmed = await closeProjectRuns(service);
      await serverClosed;
      if (!confirmed) throw new FoundryError('Worker shutdown could not be confirmed; the saved project requires explicit recovery.');
    })();
    return closePromise;
  };
  const url = `http://127.0.0.1:${port}`;
  process.stderr.write(`Foundry typed UI: ${url}\n`);
  if (options.openBrowser) {
    if (process.platform === 'win32') {
      process.stderr.write('Automatic browser launch is unavailable on Windows; open the local URL manually.\n');
    } else {
      try {
        const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
        child.once('error', () => process.stderr.write('Could not launch a browser; open the local URL manually.\n'));
        child.unref();
      } catch {
        process.stderr.write('Could not launch a browser; open the local URL manually.\n');
      }
    }
  }
  return { server, token, close };
}
