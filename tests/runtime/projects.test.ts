import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { readFactoryState } from '../../src/core/factory-contract.js';
import { ProjectService, runProjectUntilBoundary } from '../../src/core/projects.js';
import { projectRunExitCode } from '../../src/cli/run-exit-code.js';
import { closeProjectRuns, isProjectRunActive, startProjectRun } from '../../src/runtime/jobs.js';

const sourceRoot = path.resolve('.');
const nodeBin = path.dirname(process.execPath);
const researchFixture = `let output={ok:true};
if(prompt.includes('Research source selection.'))output={sources:[{kind:'local',location:'docs/product/idea.md'}]};
else if(prompt.includes('Research synthesis.'))output={summary:'Local owner input.',findings:[{claim:'The owner describes the product.',source:'S1',quote:fs.readFileSync('docs/product/idea.md','utf8').trim()}],limitations:['No external market research.']};`;

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

test('project service creates Node workspaces and reports legacy workspaces without mutating them', async (t) => {
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
        capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'model_selection', 'structured_output'],
        billing_modes: ['local', 'subscription'],
        environment: ['FIXTURE_TOKEN'],
      },
      {
        name: 'subscription-only',
        kind: 'agent-runtime',
        command: [process.execPath, '-e', 'process.stdin.resume()'],
        capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'model_selection', 'structured_output'],
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

test('service-created workspace shares Research, exact Plan approval, Design and exact approval through the core', async (t) => {
  const base = await temporaryDirectory('foundry-service-journey-');
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
    researchFixture,
    "if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] The local product has a verified state\\n');",
    "else if(prompt.includes('current stage is Design'))write('docs/product/design.md','# Design\\n\\nThe verified state is visible to the owner.\\n');",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'cross-transport-fixture'})+'\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output})+'\\n');",
    '});',
  ].join('');
  const providerConfiguration = JSON.stringify({
    adapters: [{
      name: 'journey-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', providerScript],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'structured_output'],
      billing_modes: ['local'],
    }],
  });
  const framework = await frameworkFixture(base, providerConfiguration);
  const products = path.join(base, 'products');
  const service = new ProjectService(framework, products);
  const created = await service.create({
    name: 'Service Journey',
    idea: 'Verify a locally created product through exact owner approvals.',
    adapter: 'journey-fixture',
  });
  const id = String(created.id);
  const researched = await service.run(id);
  assert.equal(researched.status, 'ready');
  assert.equal(researched.stage, 'scope');
  assert.deepEqual(researched.history, [{ stage: 'research', status: 'completed' }]);

  const planned = await service.run(id);
  assert.equal(planned.status, 'awaiting_approval');
  assert.equal(planned.stage, 'scope');
  assert.equal(planned.billing_mode, 'local');
  assert.deepEqual(planned.history, [{ stage: 'research', status: 'completed' }]);

  const plan = await service.artifact(id, 'docs/specs/product.md');
  await assert.rejects(service.approve(id, '0'.repeat(64)), /revision|changed/i);
  assert.equal((await service.status(id)).status, 'awaiting_approval');
  const planApproved = await service.approve(id, String(plan.revision));
  assert.equal(planApproved.status, 'ready');
  assert.equal(planApproved.stage, 'design');
  const designed = await service.run(id);
  assert.equal(designed.status, 'awaiting_approval');
  assert.equal(designed.stage, 'design');
  assert.deepEqual(designed.history, [
    { stage: 'research', status: 'completed' },
    { stage: 'scope', status: 'completed' },
  ]);

  const design = await service.artifact(id, 'docs/product/design.md');
  const designApproved = await service.approve(id, String(design.revision));
  assert.equal(designApproved.status, 'ready');
  assert.equal(designApproved.stage, 'build');
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
    researchFixture,
    "if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] Retry uses the saved controller\\n');",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'retry-fixture'})+'\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output})+'\\n');",
    '});',
  ].join('');
  const framework = await frameworkFixture(base, JSON.stringify({
    adapters: [{
      name: 'retry-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', providerScript],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'structured_output'],
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

test('Node CLI runs without Python and rejects unknown options', async (t) => {
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

test('Node CLI prints successful Factory boundaries and maps terminal run statuses to exit codes', async (t) => {
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
    researchFixture,
    "if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] CLI displays controller boundaries\\n');",
    "process.stdout.write(JSON.stringify({type:'session.started',session_id:'cli-fixture'})+'\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output})+'\\n');",
    '});',
  ].join('');
  const framework = await frameworkFixture(base, JSON.stringify({
    adapters: [{
      name: 'cli-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', providerScript],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'structured_output'],
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

test('terminal worker cancellation requires recovery after restart before a retry', async (t) => {
  const base = await temporaryDirectory('foundry-terminal-worker-recovery-');
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
    researchFixture,
    "if(prompt.includes('current stage is Plan'))write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] Recovered work resumes explicitly\\n');",
    "process.stdout.write(JSON.stringify({type:'result',status:'completed',output})+'\\n');",
    '});',
  ].join('');
  const providerConfiguration = JSON.stringify({
    adapters: [{
      name: 'hanging-fixture',
      kind: 'agent-runtime',
      command: [process.execPath, '-e', hangingProvider],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'structured_output'],
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

  const runStartedAt = Date.now();
  assert.equal(isProjectRunActive(root), false);
  await startProjectRun(service, projectId);
  assert.equal(isProjectRunActive(root), true);
  assert.ok(Date.now() - runStartedAt < 1_000);
  await assert.rejects(startProjectRun(service, 'background-run'), /already has a run in progress/);

  const productRoot = path.join(products, 'background-run');
  let active = await readFactoryState(productRoot);
  for (let attempt = 0; attempt < 150 && !active?.provider_task_id; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    active = await readFactoryState(productRoot);
  }
  assert.ok(active?.provider_task_id, 'provider task should be persisted before cancellation');
  assert.equal(service.jobSnapshot()[projectId]?.status, 'running');
  await service.stop(projectId);
  for (let attempt = 0; attempt < 150; attempt += 1) {
    active = await readFactoryState(productRoot);
    if (active?.status === 'interrupted' || active?.status === 'recovery_required') break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(['interrupted', 'recovery_required'].includes(active?.status ?? ''));

  await closeProjectRuns(service);
  const restarted = new ProjectService(framework, products);
  assert.equal(isProjectRunActive(root), false);
  assert.equal(restarted.jobSnapshot()[projectId], undefined);
  assert.equal((await restarted.status(projectId)).status, active?.status);
  const recoveredProject = await restarted.recover(projectId);
  assert.equal(recoveredProject.status, 'interrupted');
  assert.equal(recoveredProject.stage, 'research');
  assert.equal((await readFactoryState(root))?.provider_task_id, null);

  await writeFile(path.join(root, 'allow-retry'), 'resume only after explicit recovery');
  await startProjectRun(restarted, projectId);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = restarted.jobSnapshot()[projectId];
    if (job?.status !== 'running') {
      assert.equal(job?.status, 'completed');
      assert.equal((await restarted.status(projectId)).status, 'awaiting_approval');
      break;
    }
    if (attempt === 199) assert.fail('Explicit recovery retry did not reach the next approval boundary');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await closeProjectRuns(restarted);
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
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'structured_output'],
      billing_modes: ['local'],
    }],
  }));
  const products = path.join(base, 'products');
  const serviceA = new ProjectService(framework, products);
  const serviceB = new ProjectService(framework, products);
  t.after(async () => {
    await closeProjectRuns(serviceA);
    await closeProjectRuns(serviceB);
  });
  const created = await Promise.all([
    serviceA.create({ name: 'Capacity A1', idea: 'Hold one worker.', adapter: 'capacity-fixture' }),
    serviceA.create({ name: 'Capacity A2', idea: 'Hold another worker.', adapter: 'capacity-fixture' }),
    serviceA.create({ name: 'Capacity A3', idea: 'Hold a third worker.', adapter: 'capacity-fixture' }),
    serviceB.create({ name: 'Capacity B1', idea: 'Hold a fourth worker.', adapter: 'capacity-fixture' }),
    serviceB.create({ name: 'Capacity B2', idea: 'Reject a fifth worker.', adapter: 'capacity-fixture' }),
  ]);
  const ids = created.map((project) => String(project.id));
  for (const id of ids.slice(0, 3)) await startProjectRun(serviceA, id);
  await startProjectRun(serviceB, ids[3]!);
  await assert.rejects(startProjectRun(serviceB, ids[4]!), /four local Factory worker slots are full/);
  const waitForActive = async (slug: string): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if ((await readFactoryState(path.join(products, slug)))?.provider_task_id) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail(`Provider task did not start for ${slug}`);
  };
  for (const slug of ['capacity-a1', 'capacity-a2', 'capacity-a3', 'capacity-b1']) await waitForActive(slug);

  await closeProjectRuns(serviceA);
  assert.equal(serviceB.jobSnapshot()[ids[3]!]?.status, 'running');
  await startProjectRun(serviceB, ids[4]!);
  await waitForActive('capacity-b2');
  await closeProjectRuns(serviceB);
  assert.notEqual(serviceB.jobSnapshot()[ids[3]!]?.status, 'running');
  assert.notEqual(serviceB.jobSnapshot()[ids[4]!]?.status, 'running');
});
