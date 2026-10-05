import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { request as httpRequest } from 'node:http';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { test } from 'node:test';
import { readFactoryState } from '../../src/core/factory-contract.js';
import { ProjectService, runProjectUntilBoundary } from '../../src/core/projects.js';
import { projectRunExitCode } from '../../src/cli/run-exit-code.js';
import { closeProjectRuns, startProjectRun } from '../../src/transports/jobs.js';
import { startHttpServer } from '../../src/transports/http.js';

const sourceRoot = path.resolve('.');
const nodeBin = path.dirname(process.execPath);

async function temporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

function hostExecutable(name: string): string {
  const executable = process.env.PATH?.split(path.delimiter)
    .map((directory) => path.join(directory, name))
    .find((candidate) => existsSync(candidate));
  assert.ok(executable, `Required test executable ${name} is not on PATH`);
  return executable;
}

async function isolatedToolPath(base: string): Promise<string> {
  const utilityBin = path.join(base, 'bin');
  await mkdir(utilityBin);
  for (const name of ['dirname', 'git']) {
    await symlink(hostExecutable(name), path.join(utilityBin, name));
  }
  return `${nodeBin}${path.delimiter}${utilityBin}`;
}

async function frameworkFixture(base: string, providerConfiguration?: string): Promise<string> {
  const framework = path.join(base, 'framework');
  await mkdir(path.join(framework, '.foundry'), { recursive: true });
  await mkdir(path.join(framework, 'dist/runtime'), { recursive: true });
  await copyFile(path.join(sourceRoot, '.foundry/project.json'), path.join(framework, '.foundry/project.json'));
  await copyFile(path.join(sourceRoot, '.foundry/roles.json'), path.join(framework, '.foundry/roles.json'));
  for (const name of ['foundry.cjs', 'foundry-worker.cjs']) {
    await copyFile(path.join(sourceRoot, 'dist/runtime', name), path.join(framework, 'dist/runtime', name));
  }
  if (providerConfiguration) await writeFile(path.join(framework, '.foundry/providers.json'), providerConfiguration);
  return framework;
}

function toolText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const first = content[0] as { type?: unknown; text?: unknown } | undefined;
  return first?.type === 'text' && typeof first.text === 'string' ? first.text : '';
}

test('project service creates only typed children and reports legacy workspaces without mutating them', async (t) => {
  const base = await temporaryDirectory('foundry-project-service-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const products = path.join(base, 'products');
  const legacy = path.join(products, 'older-app');
  await mkdir(path.join(legacy, '.foundry'), { recursive: true });
  await writeFile(path.join(legacy, '.foundry/project.json'), '{"name":"old app","checks":[]}\n');
  const service = new ProjectService(sourceRoot, products);

  await assert.rejects(service.create({
    name: 'Rejected Adapter',
    idea: 'Must not create files before validation.',
    adapter: 'missing-adapter',
  }), /Unknown provider adapter/);
  await assert.rejects(readFile(path.join(products, 'rejected-adapter/.foundry/runtime.json')));
  const created = await service.create({
    name: 'Typed Notes',
    idea: 'A local notes product with explicit approval.',
    adapter: 'codex',
  });
  assert.equal(created.runtime, 'typescript');
  assert.equal(created.status, 'ready');
  assert.equal(created.adapter, 'codex');
  assert.equal(created.billing_mode, 'subscription');
  assert.equal(created.subscription_confirmed, false);
  assert.deepEqual(created.factory_roles, {
    research: 'market-researcher',
    scope: 'planner',
    design: 'designer',
    build: 'backend',
    verify: 'quality-gate',
    release: 'complete',
  });
  const initialFiles = spawnSync('git', ['-C', path.join(products, 'typed-notes'), 'ls-files'], { encoding: 'utf8' });
  assert.equal(initialFiles.status, 0, initialFiles.stderr);
  assert.deepEqual(initialFiles.stdout.trim().split('\n').sort(), [
    '.foundry/install.json',
    '.foundry/project.json',
    '.foundry/roles.json',
    '.foundry/runtime.json',
    '.gitignore',
    'docs/product/idea.md',
  ]);
  const commitCount = spawnSync('git', ['-C', path.join(products, 'typed-notes'), 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' });
  assert.equal(commitCount.stdout.trim(), '1');
  assert.equal((await readFactoryState(path.join(products, 'typed-notes')))?.provider_task_id, null);

  const listed = await service.list();
  assert.deepEqual(listed.map((project) => project.runtime), ['legacy', 'typescript']);
  assert.equal(listed[0]?.id, 'legacy:older-app');
  await assert.rejects(service.status('older-app'), /legacy or unmarked/i);
  await assert.rejects(service.status('../outside'), /safe child workspace/);
  await assert.rejects(service.create({ name: 'Typed Notes', idea: 'Do not overwrite.' }), /already exists/);
  await assert.rejects(service.run(String(created.id)), /explicit confirmation/);
  assert.equal((await service.status(String(created.id))).status, 'ready');
  assert.deepEqual(await service.models(), []);
  assert.equal((await service.snapshot()).runtime, 'typescript');
  assert.deepEqual(await readFile(path.join(legacy, '.foundry/project.json'), 'utf8'), '{"name":"old app","checks":[]}\n');
});

test('listing remains useful with malformed and symlinked children and copies validated provider settings', async (t) => {
  const base = await temporaryDirectory('foundry-project-isolation-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const providerConfiguration = JSON.stringify({
    adapters: [
      {
        name: 'fixture',
        kind: 'agent-runtime',
        command: [process.execPath, '-e', 'process.stdin.resume()'],
        capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'model_selection'],
        billing_modes: ['local', 'subscription'],
        environment: ['FIXTURE_TOKEN'],
      },
      {
        name: 'subscription-only',
        kind: 'agent-runtime',
        command: [process.execPath, '-e', 'process.stdin.resume()'],
        capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'model_selection'],
        billing_modes: ['subscription'],
      },
    ],
  }, null, 2);
  const framework = await frameworkFixture(base, providerConfiguration);

  const products = path.join(base, 'products');
  const service = new ProjectService(framework, products);
  const created = await service.create({
    name: 'Copied Provider',
    idea: 'Use only validated local adapter metadata.',
    adapter: 'fixture',
  });
  assert.equal(
    await readFile(path.join(products, 'copied-provider/.foundry/providers.json'), 'utf8'),
    providerConfiguration,
  );
  const productRoot = path.join(products, 'copied-provider');
  const tracked = spawnSync('git', ['-C', productRoot, 'ls-files'], { encoding: 'utf8' });
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.equal(tracked.stdout.includes('.foundry/providers.json'), false);
  const ignoredProviderConfig = spawnSync('git', ['-C', productRoot, 'check-ignore', '-q', '.foundry/providers.json']);
  assert.equal(ignoredProviderConfig.status, 0);
  await assert.rejects(service.configure(String(created.id), {
    factory_roles: [] as unknown as Record<string, string>,
  }), /object|role/i);
  await assert.rejects(service.configure(String(created.id), {
    confirmed: 'false' as unknown as boolean,
  }), /boolean/i);
  assert.equal((await service.status(String(created.id))).billing_mode, 'local');
  const consented = await service.configure(String(created.id), { billing: 'subscription', confirmed: true });
  assert.equal(consented.billing_mode, 'subscription');
  assert.equal(consented.subscription_confirmed, true);
  const revoked = await service.configure(String(created.id), { confirmed: false });
  assert.equal(revoked.billing_mode, 'subscription');
  assert.equal(revoked.subscription_confirmed, false);
  const rolePreference = await service.configure(String(created.id), {
    role_settings: { planner: { model: 'role-model' } },
  });
  assert.deepEqual(rolePreference.role_settings, { planner: { model: 'role-model' } });
  const globalPreference = await service.configure(String(created.id), { model: 'global-model' });
  assert.deepEqual(globalPreference.role_settings, { planner: { model: 'role-model' } });
  const changedAdapter = await service.configure(String(created.id), { adapter: 'subscription-only' });
  assert.equal(changedAdapter.billing_mode, 'subscription');
  assert.equal(changedAdapter.subscription_confirmed, false);
  const malformed = path.join(products, 'malformed');
  await mkdir(path.join(malformed, '.foundry/state/factory'), { recursive: true });
  await copyFile(
    path.join(products, 'copied-provider/.foundry/runtime.json'),
    path.join(malformed, '.foundry/runtime.json'),
  );
  await writeFile(path.join(malformed, '.foundry/state/factory/controller.json'), '{broken');
  const outside = path.join(base, 'outside');
  await mkdir(outside);
  await symlink(outside, path.join(products, 'linked'), 'dir');

  const listed = await service.list();
  assert.deepEqual(
    listed.map((project) => [project.slug, project.runtime]),
    [['copied-provider', 'typescript'], ['linked', 'unavailable'], ['malformed', 'unavailable']],
  );
  await assert.rejects(service.status('malformed'), /metadata is invalid or unavailable/);
  await assert.rejects(service.status('linked'), /metadata is invalid or unavailable/);
  assert.equal(created.adapter, 'fixture');
});

test('service-created workspace shares Research, exact Plan approval, Design and exact approval across HTTP and MCP', async (t) => {
  const base = await temporaryDirectory('foundry-cross-transport-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const providerScript = [
    "let input='';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data',chunk=>input+=chunk);",
    "process.stdin.on('end',()=>{",
    "const prompt=JSON.parse(input).prompt;",
    "const fs=require('node:fs');",
    "const path=require('node:path');",
    "const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};",
    "if(prompt.includes('current stage is Research'))write('docs/product/research.md','# Research\\n\\nSource: https://example.test/research\\n');",
    "else if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] The local product has a verified state\\n');",
    "else if(prompt.includes('current stage is Design'))write('docs/product/design.md','# Design\\n\\nThe verified state is visible to the owner.\\n');",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'cross-transport-fixture'})+'\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output:{ok:true}})+'\\n');",
    '});',
  ].join('');
  const providerConfiguration = JSON.stringify({
    adapters: [{
      name: 'journey-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', providerScript],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions'],
      billing_modes: ['local'],
    }],
  });
  const framework = await frameworkFixture(base, providerConfiguration);
  const products = path.join(base, 'products');
  const service = new ProjectService(framework, products);
  const created = await service.create({
    name: 'Cross Transport Journey',
    idea: 'Verify a locally created product through exact owner approvals.',
    adapter: 'journey-fixture',
  });
  const id = String(created.id);
  const slug = 'cross-transport-journey';
  let handle = await startHttpServer(service, { port: 0, openBrowser: false });
  t.after(async () => handle.close());
  const isolatedPath = await isolatedToolPath(base);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(framework, 'dist/runtime/foundry.cjs'), 'mcp', '--products-dir', products],
    cwd: framework,
    env: { PATH: isolatedPath, HOME: base },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'foundry-cross-transport-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  t.after(() => client.close());

  const endpoint = (): string => {
    const address = handle.server.address();
    assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  const headers = (): Record<string, string> => ({
    'X-Foundry-Token': handle.token,
    'Content-Type': 'application/json',
  });
  const getSnapshot = async (): Promise<{
    projects: Array<Record<string, unknown>>;
    jobs: Record<string, { status: string }>;
  }> => {
    const response = await fetch(`${endpoint()}/api/snapshot`, { headers: { 'X-Foundry-Token': handle.token } });
    assert.equal(response.status, 200);
    return response.json() as Promise<{
      projects: Array<Record<string, unknown>>;
      jobs: Record<string, { status: string }>;
    }>;
  };
  const post = async (action: string, data: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await fetch(`${endpoint()}/api/${action}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    });
    const result = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  };
  const artifact = async (relative: string): Promise<{ revision: string }> => {
    const query = new URLSearchParams({ id, path: relative });
    const response = await fetch(`${endpoint()}/api/artifact?${query}`, {
      headers: { 'X-Foundry-Token': handle.token },
    });
    assert.equal(response.status, 200);
    return response.json() as Promise<{ revision: string }>;
  };
  const waitForBoundary = async (): Promise<Record<string, unknown>> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const snapshot = await getSnapshot();
      const project = snapshot.projects.find((item) => item.id === id);
      const job = snapshot.jobs[id];
      if (job?.status !== 'running') {
        assert.equal(job?.status, 'completed', JSON.stringify(job));
        assert.ok(project);
        return project;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail('Factory worker did not reach an approval boundary');
  };

  const firstRun = await post('run', { id });
  assert.equal(firstRun.status, 'running');
  const planned = await waitForBoundary();
  assert.equal(planned.status, 'awaiting_approval');
  assert.equal(planned.stage, 'scope');
  assert.equal(planned.billing_mode, 'local');
  assert.deepEqual(planned.history, [{ stage: 'research', status: 'completed' }]);
  const mcpPlanned = JSON.parse(toolText((await client.callTool({
    name: 'foundry_snapshot',
    arguments: {},
  })).content)) as { projects: Array<Record<string, unknown>> };
  const plannedFromMcp = mcpPlanned.projects.find((item) => item.id === id);
  assert.equal(plannedFromMcp?.status, planned.status);
  assert.equal(plannedFromMcp?.stage, planned.stage);

  const plan = await artifact('docs/specs/product.md');
  const staleApproval = await fetch(`${endpoint()}/api/approve`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id, reviewed_revision: '0'.repeat(64) }),
  });
  assert.equal(staleApproval.status, 400);
  assert.equal((await service.status(id)).status, 'awaiting_approval');
  const planApproved = await post('approve', { id, reviewed_revision: plan.revision });
  assert.equal(planApproved.status, 'ready');
  assert.equal(planApproved.stage, 'design');
  const designRun = await post('run', { id: slug });
  assert.equal(designRun.status, 'running');
  const designed = await waitForBoundary();
  assert.equal(designed.status, 'awaiting_approval');
  assert.equal(designed.stage, 'design');
  assert.deepEqual(designed.history, [
    { stage: 'research', status: 'completed' },
    { stage: 'scope', status: 'completed' },
  ]);

  const design = await artifact('docs/product/design.md');
  const designApproved = await post('approve', { id, reviewed_revision: design.revision });
  assert.equal(designApproved.status, 'ready');
  assert.equal(designApproved.stage, 'build');
  const mcpApproved = JSON.parse(toolText((await client.callTool({
    name: 'foundry_snapshot',
    arguments: {},
  })).content)) as { projects: Array<Record<string, unknown>> };
  const approvedFromMcp = mcpApproved.projects.find((item) => item.id === id);
  assert.equal(approvedFromMcp?.status, designApproved.status);
  assert.equal(approvedFromMcp?.stage, designApproved.stage);
  assert.deepEqual(approvedFromMcp?.history, designApproved.history);
});

test('an explicit background invocation retries a persisted failure through the normal Factory gates', async (t) => {
  const base = await temporaryDirectory('foundry-retry-boundary-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const providerScript = [
    "let input='';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data',chunk=>input+=chunk);",
    "process.stdin.on('end',()=>{",
    "const fs=require('node:fs');",
    "const path=require('node:path');",
    "const prompt=JSON.parse(input).prompt;",
    "const marker='.foundry/state/factory/retry-once';",
    "let status='completed';",
    "const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};",
    "if(!fs.existsSync(marker)){write(marker,'failed once');process.stdout.write(JSON.stringify({type:'session.started',session_id:'retry-fixture'})+'\\n');process.exitCode=1;return;}",
    "else if(prompt.includes('current stage is Research'))write('docs/product/research.md','# Research\\n\\nSource: https://example.test/retry\\n');",
    "else if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] Retry uses the saved controller\\n');",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'retry-fixture'})+'\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output:{ok:true}})+'\\n');",
    '});',
  ].join('');
  const framework = await frameworkFixture(base, JSON.stringify({
    adapters: [{
      name: 'retry-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', providerScript],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions'],
      billing_modes: ['local'],
    }],
  }));
  const service = new ProjectService(framework, path.join(base, 'products'));
  const created = await service.create({
    name: 'Retry Fixture',
    idea: 'Retry a failed stage only through Factory.',
    adapter: 'retry-fixture',
  });
  const root = path.join(base, 'products/retry-fixture');
  const failed = await runProjectUntilBoundary(root);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.stage, 'research');
  assert.deepEqual((await service.status(String(created.id))).ready_next_step, { action: 'recover', stage: 'research', label: 'Research' });
  await assert.rejects(runProjectUntilBoundary(root), /Recover the unresolved factory stage/);
  const recovered = await service.recover(String(created.id));
  assert.equal(recovered.status, 'interrupted');
  const retried = await runProjectUntilBoundary(root);
  assert.equal(retried.status, 'awaiting_approval');
  assert.equal(retried.stage, 'scope');
  assert.deepEqual(retried.completed_stages, ['research']);
  assert.equal((await service.status(String(created.id))).status, 'awaiting_approval');
});

test('background workers record an abnormal exit without a message as a terminal failed job', async (t) => {
  const base = await temporaryDirectory('foundry-worker-exit-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const framework = await frameworkFixture(base);
  const products = path.join(base, 'products');
  const service = new ProjectService(framework, products);
  const created = await service.create({
    name: 'Worker exit',
    idea: 'An abnormal worker must not remain stuck as running.',
  });
  await writeFile(path.join(framework, 'dist/runtime/foundry-worker.cjs'), 'throw new Error("fixture worker failure");\n');
  try {
    await startProjectRun(service, String(created.id));
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const job = service.jobSnapshot()[String(created.id)];
      if (job?.status !== 'running') {
        assert.equal(job?.status, 'failed');
        assert.match(job?.error ?? '', /Factory worker exited without a confirmed boundary/);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (attempt === 199) assert.fail('Abnormal worker exit was not observed');
    }
  } finally {
    await closeProjectRuns(service);
  }
});

test('typed CLI runs without Python and rejects unknown options', async (t) => {
  const base = await temporaryDirectory('foundry-typed-cli-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const products = path.join(base, 'products');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: await isolatedToolPath(base),
    HOME: base,
    GIT_CONFIG_GLOBAL: path.join(base, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
  };
  delete env.PYTHONPATH;
  const help = spawnSync(path.join(sourceRoot, 'foundry'), ['--help'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /new NAME --idea TEXT/);
  const created = spawnSync(path.join(sourceRoot, 'foundry'), [
    'new', 'CLI Consent', '--idea', 'A service-created project without Python.',
    '--products-dir', products, '--json',
  ], { cwd: sourceRoot, encoding: 'utf8', env });
  assert.equal(created.status, 0, created.stderr);
  const createdProject = JSON.parse(created.stdout) as { id: string; path: string };
  const identity = spawnSync('git', ['-C', createdProject.path, 'log', '-1', '--format=%an <%ae>'], {
    encoding: 'utf8',
    env,
  });
  assert.equal(identity.status, 0, identity.stderr);
  assert.equal(identity.stdout.trim(), 'Foundry Workspace <foundry@localhost>');
  const consent = spawnSync(path.join(sourceRoot, 'foundry'), [
    'configure', createdProject.id, '--billing', 'subscription', '--confirmed',
    '--products-dir', products, '--json',
  ], { cwd: sourceRoot, encoding: 'utf8', env });
  assert.equal(consent.status, 0, consent.stderr);
  let current = await new ProjectService(sourceRoot, products).status(createdProject.id) as Record<string, unknown>;
  assert.equal(current.subscription_confirmed, true);
  const preference = spawnSync(path.join(sourceRoot, 'foundry'), [
    'configure', createdProject.id, '--model', 'cli-model', '--products-dir', products, '--json',
  ], { cwd: sourceRoot, encoding: 'utf8', env });
  assert.equal(preference.status, 0, preference.stderr);
  current = await new ProjectService(sourceRoot, products).status(createdProject.id) as Record<string, unknown>;
  assert.equal(current.subscription_confirmed, true);
  const revoke = spawnSync(path.join(sourceRoot, 'foundry'), [
    'configure', createdProject.id, '--revoke-consent', '--products-dir', products, '--json',
  ], { cwd: sourceRoot, encoding: 'utf8', env });
  assert.equal(revoke.status, 0, revoke.stderr);
  current = await new ProjectService(sourceRoot, products).status(createdProject.id) as Record<string, unknown>;
  assert.equal(current.subscription_confirmed, false);
  const listed = spawnSync(path.join(sourceRoot, 'foundry'), ['list', '--products-dir', products, '--json'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(listed.status, 0, listed.stderr);
  const listedProjects = JSON.parse(listed.stdout) as Array<{ id: string }>;
  assert.deepEqual(listedProjects.map((project) => project.id), [createdProject.id]);
  const unknown = spawnSync(path.join(sourceRoot, 'foundry'), ['list', '--typo'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown option --typo/);
  const invalidBilling = spawnSync(path.join(sourceRoot, 'foundry'), ['configure', 'missing', '--billing', 'api'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  assert.equal(invalidBilling.status, 2);
  assert.match(invalidBilling.stderr, /--billing must be local or subscription/);
});

test('typed CLI prints successful Factory boundaries and maps terminal run statuses to exit codes', async (t) => {
  const base = await temporaryDirectory('foundry-typed-cli-run-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const providerScript = [
    "let input='';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data',chunk=>input+=chunk);",
    "process.stdin.on('end',()=>{",
    "const fs=require('node:fs');",
    "const path=require('node:path');",
    "const prompt=JSON.parse(input).prompt;",
    "const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};",
    "if(prompt.includes('current stage is Research'))write('docs/product/research.md','# Research\\n\\nSource: https://example.test/cli\\n');",
    "else if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] CLI displays controller boundaries\\n');",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'cli-fixture'})+'\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output:{ok:true}})+'\\n');",
    '});',
  ].join('');
  const framework = await frameworkFixture(base, JSON.stringify({
    adapters: [{
      name: 'cli-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', providerScript],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions'],
      billing_modes: ['local'],
    }],
  }));
  const products = path.join(base, 'products');
  const env = {
    ...process.env,
    PATH: await isolatedToolPath(base),
    HOME: base,
    GIT_CONFIG_GLOBAL: path.join(base, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const cli = path.join(framework, 'dist/runtime/foundry.cjs');
  const invoke = (arguments_: string[]) => spawnSync(process.execPath, [
    cli, ...arguments_, '--products-dir', products, '--json',
  ], { cwd: framework, encoding: 'utf8', env });
  const created = invoke([
    'new', 'CLI Boundary', '--idea', 'Exercise CLI Factory run result handling.', '--adapter', 'cli-fixture',
  ]);
  assert.equal(created.status, 0, created.stderr);
  const project = JSON.parse(created.stdout) as { id: string };

  const research = invoke(['run', project.id]);
  assert.equal(research.status, 0, research.stderr);
  const researchState = JSON.parse(research.stdout) as { status: string; stage: string };
  assert.equal(researchState.status, 'ready');
  assert.equal(researchState.stage, 'scope');

  const plan = invoke(['run', project.id]);
  assert.equal(plan.status, 0, plan.stderr);
  const planState = JSON.parse(plan.stdout) as { status: string; stage: string };
  assert.equal(planState.status, 'awaiting_approval');
  assert.equal(planState.stage, 'scope');

  assert.equal(projectRunExitCode('failed'), 1);
  assert.equal(projectRunExitCode('recovery_required'), 1);
  assert.equal(projectRunExitCode('interrupted'), 130);
  for (const status of ['ready', 'awaiting_approval', 'completed']) {
    assert.equal(projectRunExitCode(status), 0);
  }
});

test('loopback HTTP requires local origin and token, exposes explicit API data, and rejects traversal', async (t) => {
  const base = await temporaryDirectory('foundry-typed-http-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const service = new ProjectService(sourceRoot, path.join(base, 'products'));
  const handle = await startHttpServer(service, { port: 0, openBrowser: false });
  t.after(() => handle.close());
  const requests: string[] = [];
  handle.server.on('request', (incoming, outgoing) => {
    const label = `${incoming.method} ${incoming.url}`;
    requests.push(`started ${label}`);
    outgoing.once('finish', () => requests.push(`finished ${label}`));
  });
  const address = handle.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const request = async (input: string, init?: RequestInit): Promise<Response> => {
    try {
      return await fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      throw new Error(`HTTP request to ${new URL(input).pathname} failed (${requests.join('; ')})`, { cause: error });
    }
  };

  const page = await request(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy') ?? '', /nonce-/);
  assert.match(await page.text(), /foundry-token/);
  const direct = await service.create({ name: 'Service Notes', idea: 'Created by the shared service.' });

  const denied = await request(`${url}/api/snapshot`);
  assert.equal(denied.status, 403);
  const wrongOrigin = await request(`${url}/api/snapshot`, {
    headers: { 'X-Foundry-Token': handle.token, Origin: 'http://example.com' },
  });
  assert.equal(wrongOrigin.status, 403);
  const headers = { 'X-Foundry-Token': handle.token, 'Content-Type': 'application/json' };
  const createdResponse = await request(`${url}/api/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'HTTP Notes', idea: 'Notes from a local form.', adapter: 'codex' }),
  });
  assert.equal(createdResponse.status, 200);
  const created = await createdResponse.json() as { id: string; status: string };
  assert.equal(created.status, 'ready');
  const snapshotResponse = await request(`${url}/api/snapshot`, { headers: { 'X-Foundry-Token': handle.token } });
  const snapshot = await snapshotResponse.json() as { projects: Array<{ id: string; name: string; factory_roles: Record<string, string> }> };
  const httpProject = snapshot.projects.find((project) => project.id === created.id);
  assert.equal(httpProject?.factory_roles.scope, 'planner');
  assert.ok(snapshot.projects.some((project) => project.id === direct.id));
  const artifact = await request(`${url}/api/artifact?id=${encodeURIComponent(String(direct.id))}&path=${encodeURIComponent('docs/product/idea.md')}`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(artifact.status, 200);
  assert.match(JSON.stringify(await artifact.json()), /Created by the shared service/);
  const models = await request(`${url}/api/models`, { headers: { 'X-Foundry-Token': handle.token } });
  assert.deepEqual(await models.json(), []);
  const traversal = await request(`${url}/api/artifact?id=${encodeURIComponent(created.id)}&path=${encodeURIComponent('../.foundry/state/factory.json')}`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(traversal.status, 400);
  const privateArtifact = await request(`${url}/api/artifact?id=${encodeURIComponent(String(created.id))}&path=${encodeURIComponent('.foundry/state/factory/controller.json')}`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(privateArtifact.status, 400);
  const oversized = await request(`${url}/api/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'x'.repeat(270_000), idea: 'Too large.' }),
  });
  assert.equal(oversized.status, 400);
  const badContentType = await request(`${url}/api/create`, {
    method: 'POST',
    headers: { 'X-Foundry-Token': handle.token, 'Content-Type': 'text/plain' },
    body: '{}',
  });
  assert.equal(badContentType.status, 400);
  const invalidAdapter = await request(`${url}/api/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Invalid Adapter', idea: 'Reject an unknown adapter.', adapter: 'missing' }),
  });
  assert.equal(invalidAdapter.status, 400);
  const wrongAdapterType = await request(`${url}/api/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Wrong Adapter Type', idea: 'Reject malformed input.', adapter: 7 }),
  });
  assert.equal(wrongAdapterType.status, 400);
  const beforeInvalidConfigure = await service.status(String(created.id));
  const invalidRoles = await request(`${url}/api/configure`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: created.id, factory_roles: [] }),
  });
  assert.equal(invalidRoles.status, 400);
  const afterInvalidConfigure = await service.status(String(created.id));
  assert.equal(afterInvalidConfigure.status, beforeInvalidConfigure.status);
  assert.deepEqual(afterInvalidConfigure.factory_roles, beforeInvalidConfigure.factory_roles);
  const invalidConsent = await request(`${url}/api/configure`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: created.id, subscription_confirmed: 'false' }),
  });
  assert.equal(invalidConsent.status, 400);
  assert.equal((await service.status(String(created.id))).billing_mode, beforeInvalidConfigure.billing_mode);
  const slowStartedAt = Date.now();
  const slowFailure = await new Promise<Error>((resolve, reject) => {
    const slow = httpRequest(`${url}/api/create`, {
      method: 'POST',
      headers: {
        'X-Foundry-Token': handle.token,
        'Content-Type': 'application/json',
        'Content-Length': '2',
      },
    }, (response) => {
      response.resume();
      reject(new Error(`Slow request unexpectedly returned ${response.statusCode}`));
    });
    slow.once('error', resolve);
    slow.write('{');
  });
  assert.match(slowFailure.message, /socket|reset|hang up/i);
  assert.ok(Date.now() - slowStartedAt >= 4_500);
  const signIn = await request(`${url}/api/sign-in`, { method: 'POST', headers, body: '{}' });
  assert.equal(signIn.status, 400);
  assert.match(JSON.stringify(await signIn.json()), /runtime CLI/);
  const wrongMethod = await request(`${url}/api/snapshot`, { method: 'DELETE', headers: { 'X-Foundry-Token': handle.token } });
  assert.equal(wrongMethod.status, 405);
});

test('HTTP runs in the background, keeps snapshots responsive, and requires explicit recovery after restart', async (t) => {
  const base = await temporaryDirectory('foundry-typed-http-jobs-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const hangingProvider = [
    "let input='';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data',chunk=>input+=chunk);",
    "process.stdin.on('end',()=>{",
    "const fs=require('node:fs');",
    "const path=require('node:path');",
    "const prompt=JSON.parse(input).prompt;",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'fixture-session'})+'\\n');",
    "if(!fs.existsSync('allow-retry')){setInterval(()=>{},1000);return;}",
    "const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};",
    "if(prompt.includes('current stage is Research'))write('docs/product/research.md','# Research\\n\\nSource: https://example.test/recovery\\n');",
    "else if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] Recovered work resumes explicitly\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output:{ok:true}})+'\\n');",
    '});',
  ].join('');
  const providerConfiguration = JSON.stringify({
    adapters: [{
      name: 'hanging-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', hangingProvider],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions'],
      billing_modes: ['local'],
    }],
  });
  const framework = await frameworkFixture(base, providerConfiguration);
  const products = path.join(base, 'products');
  const service = new ProjectService(framework, products);
  const project = await service.create({
    name: 'Background Run',
    idea: 'Exercise a cancellable local provider task.',
    adapter: 'hanging-fixture',
  });
  const projectId = String(project.id);
  const root = path.join(products, 'background-run');

  let handle = await startHttpServer(service, { port: 0, openBrowser: false });
  t.after(async () => handle.close());
  const endpoint = (): string => {
    const address = handle.server.address();
    assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  const headers = (): Record<string, string> => ({
    'X-Foundry-Token': handle.token,
    'Content-Type': 'application/json',
  });
  const runStartedAt = Date.now();
  const run = await fetch(`${endpoint()}/api/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: projectId }),
  });
  assert.equal(run.status, 200);
  assert.equal((await run.json() as { status: string }).status, 'running');
  assert.ok(Date.now() - runStartedAt < 1_000);
  const duplicateAlias = await fetch(`${endpoint()}/api/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: 'background-run' }),
  });
  assert.equal(duplicateAlias.status, 400);
  assert.match(JSON.stringify(await duplicateAlias.json()), /already has a run in progress/);

  const productRoot = path.join(products, 'background-run');
  let active = await readFactoryState(productRoot);
  for (let attempt = 0; attempt < 150 && !active?.provider_task_id; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    active = await readFactoryState(productRoot);
  }
  assert.ok(active?.provider_task_id, 'provider task should be persisted before cancellation');
  const snapshotStartedAt = Date.now();
  const snapshotResponse = await fetch(`${endpoint()}/api/snapshot`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  assert.equal(snapshotResponse.status, 200);
  const snapshot = await snapshotResponse.json() as {
    projects: Array<{ id: string; status: string }>;
    jobs: Record<string, { status: string }>;
  };
  const activeProject = snapshot.projects.find((item) => item.id === projectId);
  assert.equal(activeProject?.status, 'running');
  assert.equal(snapshot.jobs[projectId]?.status, 'running');
  assert.ok(Date.now() - snapshotStartedAt < 1_000);

  const stopped = await fetch(`${endpoint()}/api/cancel`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: projectId }),
  });
  assert.equal(stopped.status, 200);
  for (let attempt = 0; attempt < 150; attempt += 1) {
    active = await readFactoryState(productRoot);
    if (active?.status === 'interrupted' || active?.status === 'recovery_required') break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(['interrupted', 'recovery_required'].includes(active?.status ?? ''));

  await handle.close();
  handle = await startHttpServer(service, { port: 0, openBrowser: false });
  const restarted = await fetch(`${endpoint()}/api/snapshot`, {
    headers: { 'X-Foundry-Token': handle.token },
  });
  const restartedSnapshot = await restarted.json() as {
    projects: Array<{ id: string; status: string }>;
    jobs: Record<string, { status: string }>;
  };
  assert.equal(restartedSnapshot.projects.find((item) => item.id === projectId)?.status, active?.status);
  assert.notEqual(restartedSnapshot.jobs[projectId]?.status, 'running');

  const recovered = await fetch(`${endpoint()}/api/recover`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: projectId }),
  });
  assert.equal(recovered.status, 200);
  const recoveredProject = await recovered.json() as { status: string; stage: string };
  assert.equal(recoveredProject.status, 'interrupted');
  assert.equal(recoveredProject.stage, 'research');
  assert.equal((await readFactoryState(root))?.provider_task_id, null);

  await writeFile(path.join(root, 'allow-retry'), 'resume only after explicit recovery');
  const retry = await fetch(`${endpoint()}/api/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: projectId }),
  });
  assert.equal(retry.status, 200);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await fetch(`${endpoint()}/api/snapshot`, {
      headers: { 'X-Foundry-Token': handle.token },
    });
    const snapshot = await response.json() as {
      projects: Array<{ id: string; status: string }>;
      jobs: Record<string, { status: string }>;
    };
    if (snapshot.jobs[projectId]?.status !== 'running') {
      assert.equal(snapshot.jobs[projectId]?.status, 'completed');
      assert.equal(snapshot.projects.find((item) => item.id === projectId)?.status, 'awaiting_approval');
      break;
    }
    if (attempt === 199) assert.fail('Explicit recovery retry did not reach the next approval boundary');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
});

test('four worker reservations are enforced and closing one service leaves another service running', async (t) => {
  const base = await temporaryDirectory('foundry-job-capacity-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const hangingProvider = [
    "process.stdin.resume();",
    "process.stdin.on('end',()=>{",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'capacity-fixture'})+'\\n');",
    'setInterval(()=>{},1000);',
    '});',
  ].join('');
  const framework = await frameworkFixture(base, JSON.stringify({
    adapters: [{
      name: 'capacity-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', hangingProvider],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions'],
      billing_modes: ['local'],
    }],
  }));
  const products = path.join(base, 'products');
  const serviceA = new ProjectService(framework, products);
  const serviceB = new ProjectService(framework, products);
  const created = await Promise.all([
    serviceA.create({ name: 'Capacity A1', idea: 'Hold one worker.', adapter: 'capacity-fixture' }),
    serviceA.create({ name: 'Capacity A2', idea: 'Hold another worker.', adapter: 'capacity-fixture' }),
    serviceA.create({ name: 'Capacity A3', idea: 'Hold a third worker.', adapter: 'capacity-fixture' }),
    serviceB.create({ name: 'Capacity B1', idea: 'Hold a fourth worker.', adapter: 'capacity-fixture' }),
    serviceB.create({ name: 'Capacity B2', idea: 'Reject a fifth worker.', adapter: 'capacity-fixture' }),
  ]);
  let handleA = await startHttpServer(serviceA, { port: 0, openBrowser: false });
  let handleB = await startHttpServer(serviceB, { port: 0, openBrowser: false });
  t.after(async () => handleA.close());
  t.after(async () => handleB.close());
  const endpoint = (handle: Awaited<ReturnType<typeof startHttpServer>>): string => {
    const address = handle.server.address();
    assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  const start = async (handle: Awaited<ReturnType<typeof startHttpServer>>, id: string): Promise<Response> => fetch(
    `${endpoint(handle)}/api/run`,
    {
      method: 'POST',
      headers: { 'X-Foundry-Token': handle.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    },
  );
  const ids = created.map((project) => String(project.id));
  for (const id of ids.slice(0, 3)) assert.equal((await start(handleA, id)).status, 200);
  assert.equal((await start(handleB, ids[3]!)).status, 200);
  const excess = await start(handleB, ids[4]!);
  assert.equal(excess.status, 400);
  assert.match(JSON.stringify(await excess.json()), /four local Factory worker slots are full/);
  const waitForActive = async (slug: string): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if ((await readFactoryState(path.join(products, slug)))?.provider_task_id) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail(`Provider task did not start for ${slug}`);
  };
  for (const slug of ['capacity-a1', 'capacity-a2', 'capacity-a3', 'capacity-b1']) await waitForActive(slug);

  await handleA.close();
  const otherSnapshot = await serviceB.snapshot() as {
    jobs: Record<string, { status: string }>;
  };
  assert.equal(otherSnapshot.jobs[ids[3]!]?.status, 'running');
  assert.equal((await start(handleB, ids[4]!)).status, 200);
  await waitForActive('capacity-b2');
  await handleB.close();
  const closedSnapshot = await serviceB.snapshot() as {
    jobs: Record<string, { status: string }>;
  };
  assert.notEqual(closedSnapshot.jobs[ids[3]!]?.status, 'running');
  assert.notEqual(closedSnapshot.jobs[ids[4]!]?.status, 'running');
});

test('stdio MCP subprocess uses the SDK protocol and omits owner-only tools', async (t) => {
  const base = await temporaryDirectory('foundry-typed-mcp-');
  t.after(() => rm(base, { recursive: true, force: true }));
  const isolatedPath = await isolatedToolPath(base);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(sourceRoot, 'dist/runtime/foundry.cjs'), 'mcp', '--products-dir', path.join(base, 'products')],
    cwd: sourceRoot,
    env: { PATH: isolatedPath, HOME: base },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'foundry-runtime-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  t.after(() => client.close());

  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    'foundry_artifact',
    'foundry_cancel',
    'foundry_create',
    'foundry_recover',
    'foundry_run',
    'foundry_snapshot',
  ]);
  const snapshot = await client.callTool({ name: 'foundry_snapshot', arguments: {} });
  assert.notEqual(snapshot.isError, true);
  assert.match(toolText(snapshot.content), /"runtime":"typescript"/);
  const cliCreated = spawnSync(path.join(sourceRoot, 'foundry'), [
    'typed', 'new', 'CLI Notes', '--idea', 'A shared project created by the terminal.',
    '--products-dir', path.join(base, 'products'), '--json',
  ], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env: { PATH: isolatedPath, HOME: base },
  });
  assert.equal(cliCreated.status, 0, cliCreated.stderr);
  const sharedSnapshot = await client.callTool({ name: 'foundry_snapshot', arguments: {} });
  assert.match(toolText(sharedSnapshot.content), /CLI Notes/);
  const created = await client.callTool({
    name: 'foundry_create',
    arguments: { name: 'MCP Notes', idea: 'A typed MCP fixture.', adapter: 'codex' },
  });
  assert.notEqual(created.isError, true);
  assert.match(toolText(created.content), /"runtime":"typescript"/);
});

test('documentation routing and CSP work with synthetic static assets', async (t) => {
  const baseDirectory = await temporaryDirectory('foundry-typed-docs-products-');
  t.after(() => rm(baseDirectory, { recursive: true, force: true }));
  const framework = await frameworkFixture(baseDirectory);
  const products = path.join(baseDirectory, 'products');
  const docsDirectory = path.join(framework, 'site/dist/docs/architecture');
  const astroDirectory = path.join(framework, 'site/dist/_astro');
  const pagefindDirectory = path.join(framework, 'site/dist/pagefind');
  await Promise.all([
    mkdir(docsDirectory, { recursive: true }),
    mkdir(astroDirectory, { recursive: true }),
    mkdir(pagefindDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(docsDirectory, 'index.html'), [
      '<!doctype html>',
      '<html><head><style>body { color: #123; }</style><link rel="stylesheet" href="/_astro/site.css"></head>',
      '<body><script>window.docsReady = true;</script><script src="/pagefind/pagefind.js"></script></body></html>',
    ].join('')),
    writeFile(path.join(astroDirectory, 'site.css'), 'body { color: #123; }'),
    writeFile(path.join(pagefindDirectory, 'pagefind.js'), 'window.pagefind = true;'),
  ]);
  const handle = await startHttpServer(new ProjectService(framework, products), { port: 0, openBrowser: false });
  t.after(() => handle.close());
  const address = handle.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const page = await fetch(`${base}/docs/architecture/`);
  assert.equal(page.status, 200);
  assert.equal(new URL(page.url).pathname, '/docs/architecture/');
  const html = await page.text();
  assert.equal(html.includes('/docs/docs/'), false);
  const policy = page.headers.get('content-security-policy') ?? '';
  assert.match(policy, /wasm-unsafe-eval/);
  const inlineTags = [
    ...html.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi),
  ].filter((match) => !/\bsrc\s*=/.test(match[2] ?? ''));
  assert.ok(inlineTags.length > 0, 'the generated docs page exercises inline content hashes');
  for (const match of inlineTags) {
    const hash = createHash('sha256').update(match[3] ?? '').digest('base64');
    assert.ok(policy.includes(`'sha256-${hash}'`), `documentation CSP is missing the inline ${match[1]} hash`);
  }
  const linkedAsset = html.match(/(?:src|href)="(\/(?:_astro|pagefind)\/[^"]+)"/)?.[1];
  assert.ok(linkedAsset, 'docs page should reference a generated asset namespace');
  assert.equal((await fetch(new URL(linkedAsset, base))).status, 200);

  const pagefindFiles = await readdir(pagefindDirectory, { withFileTypes: true });
  const pagefindFile = pagefindFiles.find((entry) => entry.isFile() && entry.name.endsWith('.js'));
  assert.ok(pagefindFile, 'Pagefind JavaScript should be present in the built docs');
  const search = await fetch(`${base}/pagefind/${pagefindFile.name}`);
  assert.equal(search.status, 200);
  assert.match(search.headers.get('content-type') ?? '', /javascript/);
  const duplicated = await fetch(`${base}/docs/docs/architecture/`);
  assert.equal(duplicated.status, 404);
});
