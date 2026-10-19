import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { Config } from '@opencode-ai/sdk/v2/client';
import { z } from 'zod';
import { connectOpenCode } from '../../src/core/connect.js';
import { OPENCODE_VERSION } from '../../src/runtime/opencode.js';

const payloadSchema = z.object({
  model: z.string(), stream: z.boolean(),
  tools: z.array(z.object({ function: z.object({ name: z.string() }).passthrough() }).passthrough()).optional(),
  messages: z.array(z.object({ role: z.string() }).passthrough()),
}).passthrough();

test('real OpenCode uses a custom OpenAI-compatible endpoint and Foundry tools', {
  skip: !process.env.FOUNDRY_OPENCODE_QUALIFY_BINARY || process.platform === 'win32',
  timeout: 90_000,
}, async t => {
  const binary = process.env.FOUNDRY_OPENCODE_QUALIFY_BINARY!;
  assert.ok(path.isAbsolute(binary));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-endpoint-'));
  const root = path.join(directory, 'project');
  const home = path.join(directory, 'home');
  const cleanup: (() => void | Promise<void>)[] = [];
  t.after(async () => {
    try { for (const action of cleanup.toReversed()) await action(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  });
  for (const name of [root, home, path.join(root, '.foundry')]) await mkdir(name, { mode: 0o700 });
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1, runtime: 'typescript', runtime_version: '1',
    installed_at: '2026-01-01', source_pin: 'a'.repeat(64),
  }));
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({ name: 'endpoint', checks: [] }));
  const requests: z.infer<typeof payloadSchema>[] = [];
  const errors: unknown[] = [];
  const toolNames: string[] = [];
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, 'POST');
      assert.equal(request.url, '/v1/chat/completions');
      assert.equal(request.headers.authorization, 'Bearer local-protocol-fixture');
      let input = '';
      for await (const chunk of request) {
        input += String(chunk);
        assert.ok(Buffer.byteLength(input) < 1024 * 1024);
      }
      const body = payloadSchema.parse(JSON.parse(input));
      assert.equal(body.model, 'tool-model');
      assert.equal(body.stream, true);
      if (body.tools?.length) requests.push(body);
      assert.ok(requests.length <= 3, 'unexpected retry or extra model turn');
      const tools = body.tools?.map(tool => tool.function.name) ?? [];
      const context = tools.find(name => name.endsWith('foundry_context'));
      if (tools.length) {
        assert.ok(context, 'Foundry MCP tool was not offered to the model');
        assert.ok(tools.includes('write'), tools.join(', '));
      }
      const toolResults = body.messages.filter((message: { role: string }) => message.role === 'tool');
      if (tools.length) assert.equal(toolResults.length, requests.length - 1, 'previous tool results must reach the endpoint');
      if (tools.length && requests.length === 2) assert.ok(JSON.stringify(toolResults).includes(root));
      const tool = tools.length ? requests.length === 1 ? context : requests.length === 2 ? 'write' : null : null;
      if (tool) toolNames.push(tool);
      const delta = tool ? {
        tool_calls: [{ index: 0, id: `call_${requests.length}`, type: 'function', function: {
          name: tool,
          arguments: JSON.stringify(tool === context ? {} : { filePath: path.join(root, 'result.txt'), content: 'Endpoint tool call passed.\n' }),
        } }],
      } : { content: 'Local protocol check complete.' };
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const [part, finish] of [[{ role: 'assistant' }, null], [delta, null], [{}, tool ? 'tool_calls' : 'stop']]) {
        response.write(`data: ${JSON.stringify({ id: 'chatcmpl-fixture', object: 'chat.completion.chunk', created: 1,
          model: 'tool-model', choices: [{ index: 0, delta: part, finish_reason: finish }],
        })}\n\n`);
      }
      response.end('data: [DONE]\n\n');
    } catch (error) {
      errors.push(error);
      response.writeHead(400).end();
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const configuration = {
    $schema: 'https://opencode.ai/config.json', mcp: {},
    model: 'foundry-test/tool-model',
    provider: { 'foundry-test': { npm: '@ai-sdk/openai-compatible', name: 'Local protocol fixture',
      options: { baseURL: `http://127.0.0.1:${address.port}/v1`, apiKey: '{env:FOUNDRY_ENDPOINT_TEST_KEY}' },
      models: { 'tool-model': { name: 'Fixture, not a real model' } },
    } },
    permission: { '*': 'deny', edit: 'allow', 'foundry_*': 'allow' },
    plugin: [], snapshot: false, share: 'disabled', autoupdate: false, lsp: false, formatter: false,
  } satisfies Config;
  await writeFile(path.join(root, 'opencode.json'), JSON.stringify(configuration));
  await connectOpenCode(root, path.resolve('dist/runtime/foundry.cjs'), 'apply');
  const environment = {
    PATH: path.dirname(process.execPath) + path.delimiter + '/usr/bin:/bin',
    HOME: home, XDG_CONFIG_HOME: path.join(home, 'config'), XDG_DATA_HOME: path.join(home, 'data'),
    XDG_CACHE_HOME: path.join(home, 'cache'), XDG_STATE_HOME: path.join(home, 'state'),
    TMPDIR: directory, FOUNDRY_ENDPOINT_TEST_KEY: 'local-protocol-fixture',
    OPENCODE_DISABLE_AUTOUPDATE: 'true', OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_DISABLE_MODELS_FETCH: 'true', OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true',
    OPENCODE_DISABLE_LSP_DOWNLOAD: 'true', OPENCODE_DISABLE_CLAUDE_CODE: 'true',
    OPENCODE_DISABLE_SHARE: 'true',
  };
  const version = spawnSync(binary, ['--version'], { env: environment, encoding: 'utf8', timeout: 10_000 });
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), OPENCODE_VERSION);
  const child = spawn(binary, ['run', '--model', configuration.model, '--format', 'json', 'Run the local protocol fixture.'], {
    cwd: root, env: environment, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stop = () => { if (!child.pid) return; try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  } };
  cleanup.push(stop);
  const timeout = setTimeout(stop, 60_000);
  cleanup.push(() => clearTimeout(timeout));
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    if (Buffer.byteLength(output) + chunk.length > 512 * 1024) { stop(); return; }
    output += String(chunk);
  });
  const exit = await new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  assert.deepEqual(errors, []);
  assert.equal(exit, 0, output.slice(-4000));
  assert.equal(requests.length, 3, output.slice(-4000));
  assert.equal(await readFile(path.join(root, 'result.txt'), 'utf8'), 'Endpoint tool call passed.\n');
  const events = output.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(events.filter(event => event.type === 'tool_use' && event.part?.state?.status === 'completed').length, 2);
  await connectOpenCode(root, path.resolve('dist/runtime/foundry.cjs'), 'remove');
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'opencode.json'), 'utf8')), configuration);
  t.diagnostic(JSON.stringify({ version: OPENCODE_VERSION,
    binary_sha256: createHash('sha256').update(await readFile(binary)).digest('hex'),
    endpoint: 'local fixture only', requests: requests.length, tools: toolNames, liveInference: false,
  }));
});
