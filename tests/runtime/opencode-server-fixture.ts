import { createServer } from 'node:http';
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { qualifyOpenCode } from '../../src/runtime/opencode.js';

export async function qualify(settings: unknown): Promise<void> {
  await qualifyOpenCode(settings);
}

export function run(mode: string): void {
  if (mode === 'silent') { setInterval(() => {}, 1000); return; }
  if (mode === 'early-exit') { process.stderr.write(process.env.OPENCODE_SERVER_PASSWORD!); process.exit(1); }
  if (mode === 'noise') process.stdout.write('x'.repeat(70_000));
  if (mode === 'ignore-term') process.on('SIGTERM', () => {});
  const audit: Array<{ method: string; path: string; directory: string | null; authenticated: boolean }> = [];
  const session = { id: 'ses_fixture', directory: process.cwd(), projectID: 'fixture' };
  const configuration = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT!);
  const marker = path.join(process.env.XDG_STATE_HOME!, 'audit.json');
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, 'http://127.0.0.1');
    const expected = `Basic ${Buffer.from(`foundry:${process.env.OPENCODE_SERVER_PASSWORD}`).toString('base64')}`;
    const authenticated = request.headers.authorization === expected;
    audit.push({ method: request.method!, path: url.pathname, directory: url.searchParams.get('directory'), authenticated });
    writeFileSync(marker, JSON.stringify({ audit, leaked: process.env.SUPERVISOR_SENTINEL !== undefined,
      home: process.env.HOME, cwd: process.cwd(), pure: process.env.OPENCODE_PURE,
      projectConfigDisabled: process.env.OPENCODE_DISABLE_PROJECT_CONFIG }), { mode: 0o600 });
    response.setHeader('content-type', 'application/json');
    if (!authenticated && mode !== 'no-auth') { response.writeHead(401).end('{}'); return; }
    if (url.searchParams.get('directory') !== process.cwd()) { response.writeHead(400).end('{}'); return; }
    const send = (value: unknown) => response.end(JSON.stringify(value));
    if (url.pathname === '/global/health') {
      if (mode === 'mutate-binary') appendFileSync(process.argv[1]!, '\n');
      if (mode === 'late-noise') process.stdout.write('x'.repeat(70_000));
      if (mode === 'redirect') { response.writeHead(307, { location: 'http://127.0.0.1:1/private' }).end(); return; }
      if (mode === 'oversized') { response.setHeader('content-length', 100_000); response.end('x'.repeat(100_000)); return; }
      if (mode === 'chunked') { response.write('x'.repeat(40_000)); response.end('x'.repeat(40_000)); return; }
      if (mode === 'malformed') { response.end('not-json'); return; }
      if (mode === 'hang') { response.write('{'); return; }
      if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 200));
      send({ healthy: true, version: mode === 'wrong-version' ? '0.0.0' : '1.19.0' }); return;
    }
    if (url.pathname === '/config') {
      send(mode === 'unsafe-config' ? { ...configuration, mcp: { trap: {} } }
        : mode === 'malformed-config' ? { ...configuration, plugin: {} } : configuration); return;
    }
    if (url.pathname === '/session' && request.method === 'POST') {
      let body = '';
      for await (const chunk of request) body += String(chunk);
      const parsed = JSON.parse(body);
      if (JSON.stringify(parsed.permission) !== JSON.stringify([{ permission: '*', pattern: '*', action: 'deny' }])) { response.writeHead(400).end('{}'); return; }
      send(mode === 'wrong-root' ? { ...session, directory: path.dirname(process.cwd()) } : session); return;
    }
    if (url.pathname === '/session/ses_fixture' && request.method === 'GET') { send(mode === 'wrong-session' ? { ...session, id: 'ses_other' } : session); return; }
    if (url.pathname === '/session/ses_fixture' && request.method === 'DELETE') { send(mode !== 'delete-failed'); return; }
    if (url.pathname === '/session/ses_fixture/abort' && request.method === 'POST') { send(mode !== 'abort-failed'); return; }
    response.writeHead(404).end('{}');
  });
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture listen failed');
    const line = `opencode server listening on http://127.0.0.1:${address.port}\n`;
    process.stdout.write(line.slice(0, 12));
    process.stdout.write(line.slice(12));
  });
}
