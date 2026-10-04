import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  approveFactory, cancelFactory, configureFactory, initFactory, recoverFactory, reviewFactory, runFactory, statusFactory,
} from '../../src/core/factory.js';
import { FACTORY_LOCK, readFactoryState, reviewEvidenceDigests } from '../../src/core/factory-contract.js';
import { complete as lifecycleComplete } from '../../src/core/lifecycle.js';
import { digest, withProcessLock } from '../../src/core/fs.js';

type JsonRecord = Record<string, unknown>;
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function project(providerMode = 'success', checkPass = true, hangingCheck = false): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-factory-'));
  await mkdir(path.join(root, '.foundry'), { recursive: true });
  await mkdir(path.join(root, 'docs/product'), { recursive: true });
  await mkdir(path.join(root, 'docs/specs'), { recursive: true });
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({
    name: 'factory fixture',
    checks: [{
      name: 'behavior',
      command: [process.execPath, '-e', hangingCheck
        ? `const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync('check-started',String(child.pid));setInterval(()=>{},1000);`
        : checkPass ? 'process.stdout.write("verified")' : 'process.exit(1)'],
      cwd: '.',
      timeout: 10,
      required: true,
      inputs: ['docs/specs/product.md'],
      environment: [],
    }],
  }));
  await writeFile(path.join(root, '.foundry/runtime.json'), JSON.stringify({
    schema_version: 1, runtime: 'typescript', runtime_version: '1',
    installed_at: new Date().toISOString(), source_pin: 'a'.repeat(64),
  }));
  await writeFile(path.join(root, '.foundry/roles.json'), JSON.stringify({
    schema_version: 1,
    roles: [
      { name: 'market-researcher', description: 'Research', sandbox: 'workspace-write', instructions: 'Research safely.' },
      { name: 'planner', description: 'Plan', sandbox: 'workspace-write', instructions: 'Write a bounded plan.' },
      { name: 'designer', description: 'Design', sandbox: 'workspace-write', instructions: 'Write a design.' },
      { name: 'backend', description: 'Build', sandbox: 'workspace-write', instructions: 'Implement bounded tasks.' },
      { name: 'quality-gate', description: 'Review', sandbox: 'read-only', instructions: 'Report only.' },
      { name: 'complete', description: 'Ship', sandbox: 'workspace-write', instructions: 'Prepare a local summary.' },
    ],
  }));
  const fakeProvider = path.join(root, 'fake-provider.cjs');
  const providerScript = `
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const mode=process.argv[2]||'success';
let input='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>input+=chunk);
process.stdin.on('end',()=>{
  const request=JSON.parse(input);
  const prompt=request.prompt;
  const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  let output={ok:true};
  if(mode==='hang-child'){
    const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    fs.writeFileSync('provider-child-started',String(child.pid));
    setInterval(()=>{},1000);
    return;
  }
  if(prompt.includes('current stage is Research')){
    write('docs/product/research.md','# Research\\n\\nSource: https://example.test/research\\n');
  }else if(prompt.includes('current stage is Plan')){
    write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] A configured local check passes\\n');
  }else if(prompt.includes('current stage is Design')){
    write('docs/product/design.md','# Design\\n\\nThe local product has a clear verified state.\\n');
  }else if(prompt.includes('current stage is Build')){
    if(prompt.includes('Create docs/product/tasks.md')){
      write('docs/product/tasks.md','- [ ] Implement the local feature\\n');
    }else{
      write('src/product.txt','verified local feature\\n');
    }
    if(mode.startsWith('workflow-')){
      const ledgerPath='docs/project/marketcraft.json';
      const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
      const index=ledger.records.findIndex(item=>item.kind==='criterion'&&item.stage==='verify'&&item.required===true);
      if(index<0)throw new Error('The accepted workflow criterion was not available to the builder.');
      if(mode==='workflow-drop')ledger.records.splice(index,1);
      if(mode==='workflow-reword')ledger.records[index].expected='Changed without approval';
      if(mode==='workflow-reclassify'){
        ledger.records[index].required=false;
        ledger.records[index].status='proposed';
      }
      if(mode==='workflow-remap-check'){
        const project=JSON.parse(fs.readFileSync('.foundry/project.json','utf8'));
        project.checks[0].command=[process.execPath,'-e','process.exit(0)'];
        write('.foundry/project.json',JSON.stringify(project));
      }
      write(ledgerPath,JSON.stringify(ledger)+'\\n');
    }
    if(mode==='state-tamper'){
      const statePath='.foundry/state/factory/controller.json';
      const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
      state.completed_stages.push('release');
      write(statePath,JSON.stringify(state)+'\\n');
    }
    if(mode==='lifecycle-tamper'){
      const state=JSON.parse(fs.readFileSync('.foundry/state/factory/controller.json','utf8'));
      const lifecyclePath='.foundry/state/runs/'+state.lifecycle_run_id+'/state.json';
      const lifecycle=JSON.parse(fs.readFileSync(lifecyclePath,'utf8'));
      lifecycle.status='paused';
      write(lifecyclePath,JSON.stringify(lifecycle)+'\\n');
    }
    if(mode==='drop-criteria'){
      write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] Reworded without approval\\n');
    }
  }else if(prompt.includes('current stage is Test')){
    const lines=prompt.split('\\n');
    const planRevision=lines.find(line=>line.startsWith('Plan revision: ')).slice('Plan revision: '.length);
    const workspaceRevision=lines.find(line=>line.startsWith('Tested workspace revision: ')).slice('Tested workspace revision: '.length);
    const criteria=JSON.parse(lines[lines.indexOf('Approved criteria:')+1]);
    const plan=fs.readFileSync('docs/specs/product.md');
    const evidencePath=mode==='state-evidence'?'.foundry/state/factory/review.bin':mode==='unsafe-evidence'?'../outside':mode==='symlink-evidence'?'docs/product/evidence-link.md':'docs/specs/product.md';
    if(mode==='state-evidence')write(evidencePath,Buffer.from([1,2,3,4]));
    if(mode==='symlink-evidence')fs.symlinkSync('../../outside-evidence.txt',path.join(process.cwd(),'docs/product/evidence-link.md'));
    const evidenceBytes=mode==='state-evidence'?fs.readFileSync(evidencePath):plan;
    output={
      schema_version:1,
      plan_revision:mode==='stale-plan'?'0'.repeat(64):planRevision,
      workspace_revision:mode==='stale-workspace'?'0'.repeat(64):workspaceRevision,
      criteria:criteria.map(item=>({
        id:item.id,status:mode==='failed-review'?'fail':mode==='unverified-review'?'unverified':'pass',
        observation:'Configured local behavior is verified.',
        evidence:[{path:evidencePath,sha256:crypto.createHash('sha256').update(evidenceBytes).digest('hex')}],
      })),
      blockers:mode==='blocking-review'?['A required behavior is blocked.']:[],
    };
    if(mode==='missing-review')output=undefined;
    if(mode==='malformed-review')output='not valid JSON';
  }
  process.stdout.write(JSON.stringify({type:'session.started',session_id:'factory-fixture-session'})+'\\n');
  const result={type:'result',status:mode==='nonterminal-review'&&prompt.includes('current stage is Test')?'unknown':'completed'};
  if(mode==='failed-provider')result.status='failed';
  if(output!==undefined)result.output=output;
  process.stdout.write(JSON.stringify(result)+'\\n');
});
`;
  await writeFile(fakeProvider, providerScript);
  await chmod(fakeProvider, 0o700);
  if (providerMode === 'symlink-evidence') {
    await writeFile(path.join(root, 'outside-evidence.txt'), 'not review evidence');
  }
  await writeFile(path.join(root, '.foundry/providers.json'), JSON.stringify({
    adapters: ['fixture', 'fixture-next'].map((name) => ({
      name,
      kind: 'agent-runtime',
      command: [process.execPath, fakeProvider, providerMode],
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'model_selection', 'reasoning_selection'],
      billing_modes: ['local', 'subscription'],
    })),
  }));
  const git = (args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(git(['init', '-q']).status, 0);
  assert.equal(git(['config', 'user.name', 'Factory Test']).status, 0);
  assert.equal(git(['config', 'user.email', 'factory-test@localhost']).status, 0);
  assert.equal(git(['add', '.']).status, 0);
  assert.equal(git(['commit', '-q', '-m', 'fixture']).status, 0);
  return root;
}

async function advanceToBuild(root: string, name = 'Factory test'): Promise<void> {
  await initFactory(root, {
    name,
    idea: 'Build a local product with one verified behavior.',
    adapter: 'fixture',
  });
  await runFactory(root);
  await runFactory(root);
  const plan = await reviewFactory(root, 'plan');
  await approveFactory(root, 'plan', String(plan.revision));
  await runFactory(root);
  const design = await reviewFactory(root, 'design');
  await approveFactory(root, 'design', String(design.revision));
}

async function waitForFile(file: string): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      return (await readFile(file, 'utf8')).trim();
    } catch {
      await delay(25);
    }
  }
  assert.fail(`Timed out waiting for ${file}`);
}

async function waitForPidExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      process.kill(pid, 0);
      await delay(25);
    } catch {
      return;
    }
  }
  assert.fail(`Owned child process ${pid} remained alive`);
}

test('factory completes Research through Ship with approvals, a real check and checkpoint', async () => {
  const root = await project();
  await initFactory(root, {
    name: 'Local preview',
    idea: 'Build a local product with one verified behavior.',
    adapter: 'fixture',
  });
  await runFactory(root);
  const researchStatus = await statusFactory(root);
  assert.deepEqual(researchStatus.ready_next_step, { action: 'run', stage: 'scope', label: 'Plan' });
  assert.deepEqual((researchStatus.completed_work as JsonRecord[]).map((item) => item.stage), ['research']);
  await runFactory(root);
  const plan = await reviewFactory(root, 'plan');
  assert.equal((plan.criteria as JsonRecord[]).length, 1);
  await approveFactory(root, 'plan', String(plan.revision));
  await runFactory(root);
  const design = await reviewFactory(root, 'design');
  await approveFactory(root, 'design', String(design.revision));
  await runFactory(root);
  const built = await readFactoryState(root);
  assert.equal(built?.stage, 'verify');
  assert.equal(built?.build_tasks[0]?.status, 'done');
  assert.match(String(built?.build_tasks[0]?.checkpoint), /^[a-f0-9]{40,64}$/);
  await runFactory(root);
  await assert.rejects(lifecycleComplete(root), /Factory Ship review gate/);
  const reviewed = await readFactoryState(root);
  assert.equal(reviewed?.status, 'reviewed');
  assert.equal(reviewed?.stage, 'release');
  await runFactory(root);
  const completed = await readFactoryState(root);
  assert.equal(completed?.status, 'completed');
  assert.deepEqual(completed?.completed_stages, ['research', 'scope', 'design', 'build', 'verify', 'release']);
  assert.equal((await readFile(path.join(root, '.foundry/state/factory/ship.json'), 'utf8')).includes('not_authorized'), true);
});

test('factory rejects malformed, missing, stale, failing, unverified and blocking reviewer results', async (t) => {
  for (const mode of [
    'malformed-review', 'missing-review', 'stale-plan', 'stale-workspace',
    'failed-review', 'unverified-review', 'blocking-review', 'unsafe-evidence',
    'symlink-evidence', 'nonterminal-review',
  ]) {
    await t.test(mode, async () => {
      const root = await project(mode);
      await advanceToBuild(root, `Review ${mode}`);
      await runFactory(root);
      await assert.rejects(runFactory(root));
      const state = await readFactoryState(root);
      assert.equal(state?.stage, 'verify');
      assert.notEqual(state?.status, 'completed');
      assert.equal(state?.ship, null);
    });
  }
});

test('factory does not accept a builder that drops or rewords an approved criterion', async () => {
  const root = await project('drop-criteria');
  await advanceToBuild(root, 'Dropped criterion');
  await assert.rejects(runFactory(root), /Upstream input changed/);
  const state = await readFactoryState(root);
  assert.equal(state?.stage, 'scope');
  assert.equal(state?.approvals.plan, null);
  assert.equal(state?.build_tasks.length, 0);
});

test('Factory rehashes state-local review evidence before Ship', async () => {
  const root = await project('state-evidence');
  await advanceToBuild(root, 'Evidence drift');
  await runFactory(root);
  await runFactory(root);
  await writeFile(path.join(root, '.foundry/state/factory/review.bin'), Buffer.from([4, 3, 2, 1]));
  await assert.rejects(runFactory(root), /review evidence changed after review/);
  const state = await readFactoryState(root);
  assert.equal(state?.status, 'failed');
  assert.equal(state?.ship, null);
});

test('factory freezes accepted verify IDs, expectations, and required-check mappings before Build', async (t) => {
  for (const [mode, error] of [
    ['workflow-drop', /criteria changed during Build/],
    ['workflow-reword', /criterion AC-001 changed during Build/],
    ['workflow-reclassify', /criteria changed during Build/],
    ['workflow-remap-check', /no longer maps to one required configured check/],
  ] as const) {
    await t.test(mode, async () => {
      const root = await project(mode);
      await advanceToBuild(root, `Frozen ${mode}`);
      await assert.rejects(runFactory(root), error);
      const state = await readFactoryState(root);
      assert.equal(state?.stage, 'build');
      assert.equal(state?.status, 'failed');
      assert.equal(state?.workflow_criteria.length, 1);
      assert.equal(state?.workflow_criteria[0]?.id, 'AC-001');
      assert.equal(state?.workflow_criteria[0]?.expected, 'A configured local check passes');
      assert.equal(state?.workflow_criteria[0]?.check_name, 'behavior');
    });
  }
});

test('factory does not integrate a provider turn after controller-state tampering', async () => {
  const root = await project('state-tamper');
  await advanceToBuild(root, 'State integrity');
  await assert.rejects(runFactory(root), /controller state changed during a provider turn/);
  const state = await readFactoryState(root);
  assert.equal(state?.status, 'recovery_required');
  assert.equal(state?.stage, 'build');
  assert.deepEqual(state?.completed_stages, ['research', 'scope', 'design']);
});

test('factory preserves lifecycle ownership across provider turns', async () => {
  const root = await project('lifecycle-tamper');
  await advanceToBuild(root, 'Lifecycle integrity');
  await assert.rejects(runFactory(root), /lifecycle identity changed during a provider turn/);
  const state = await readFactoryState(root);
  assert.equal(state?.status, 'recovery_required');
  assert.equal(state?.stage, 'build');
  assert.ok(state?.lifecycle_run_id);
});

test('failed required checks leave the build task unticked and retry bounded repairs', async () => {
  const root = await project('success', false);
  await advanceToBuild(root, 'Failing check');
  await assert.rejects(runFactory(root));
  const state = await readFactoryState(root);
  assert.equal(state?.stage, 'build');
  assert.equal(state?.status, 'failed');
  assert.equal(state?.build_tasks[0]?.status, 'failed');
  assert.equal(state?.build_tasks[0]?.repair_attempts, 3);
  assert.equal(await readFile(path.join(root, 'docs/product/tasks.md'), 'utf8'), '- [ ] Implement the local feature\n');
  const runId = state?.lifecycle_run_id;
  const recovered = await recoverFactory(root);
  assert.equal(recovered.lifecycle_run_id, runId);
  assert.equal(recovered.stage, 'build');
  assert.equal(recovered.build_tasks[0]?.status, 'failed');
});

test('factory cancellation kills a provider-owned stdio-ignored child and preserves stage identity', async () => {
  const root = await project('hang-child');
  const initial = await initFactory(root, { name: 'Cancellation', idea: 'Stop provider work safely.', adapter: 'fixture' });
  const running = runFactory(root).then(() => null, (error: Error) => error);
  const pid = Number(await waitForFile(path.join(root, 'provider-child-started')));
  const active = await readFactoryState(root);
  assert.equal(active?.status, 'running');
  assert.ok(active?.provider_task_id);
  await cancelFactory(root);
  assert.match(String(await running), /cancel/i);
  await waitForPidExit(pid);
  const recovered = await recoverFactory(root);
  assert.equal(recovered.workspace_id, initial.workspace_id);
  assert.equal(recovered.stage, 'research');
  assert.equal(recovered.completed_stages.length, 0);
  assert.equal(recovered.status, 'interrupted');
});

test('factory cancellation during a configured check interrupts and cleans up its owned child', async () => {
  const root = await project('success', true, true);
  await advanceToBuild(root, 'Cancel check');
  const running = runFactory(root).then(() => null, (error: Error) => error);
  const pid = Number(await waitForFile(path.join(root, 'check-started')));
  const active = await readFactoryState(root);
  const runId = active?.lifecycle_run_id;
  await cancelFactory(root);
  assert.match(String(await running), /cancel/i);
  await waitForPidExit(pid);
  const interrupted = await readFactoryState(root);
  assert.equal(interrupted?.status, 'interrupted');
  assert.equal(interrupted?.stage, 'build');
  assert.notEqual(interrupted?.build_tasks[0]?.status, 'done');
  const recovered = await recoverFactory(root);
  assert.equal(recovered.lifecycle_run_id, runId);
  assert.equal(recovered.status, 'interrupted');
  assert.equal(recovered.stage, 'build');
});

test('factory stage writers serialize on the exclusive controller lock', async () => {
  const root = await project();
  await initFactory(root, { name: 'Writer lock', idea: 'Serialize writers.', adapter: 'fixture' });
  await withProcessLock(path.join(root, FACTORY_LOCK), async () => {
    await assert.rejects(runFactory(root), /lock/i);
  });
  assert.equal((await readFactoryState(root))?.stage, 'research');
});

test('factory invalidates approvals when the exact Plan revision changes', async () => {
  const root = await project();
  await initFactory(root, { name: 'Stale plan', idea: 'Keep plan approvals revision-bound.', adapter: 'fixture' });
  await runFactory(root);
  await runFactory(root);
  const plan = await reviewFactory(root, 'plan');
  await approveFactory(root, 'plan', String(plan.revision));
  await writeFile(path.join(root, 'docs/specs/product.md'), '# Owner-edited plan\n\n## Acceptance criteria\n- [AC-001] A configured local check passes\n');
  const status = await statusFactory(root);
  assert.deepEqual(status.ready_next_step, { action: 'approve', stage: 'scope', label: 'Plan' });
  assert.deepEqual(status.stale_approvals, ['plan']);
  assert.deepEqual((status.completed_work as JsonRecord[]).map((item) => item.stage), ['research', 'scope']);
});

test('factory state rejects malformed and future versions', async () => {
  const root = await project();
  await initFactory(root, { name: 'Strict state', idea: 'Reject unknown state.', adapter: 'fixture' });
  const statePath = path.join(root, '.foundry/state/factory/controller.json');
  const valid = JSON.parse(await readFile(statePath, 'utf8')) as JsonRecord;
  await writeFile(statePath, JSON.stringify({ ...valid, schema_version: 2 }));
  await assert.rejects(readFactoryState(root), /Invalid factory controller state/);
  await writeFile(statePath, JSON.stringify({ ...valid, unexpected: true }));
  await assert.rejects(readFactoryState(root), /Invalid factory controller state/);
  await writeFile(statePath, JSON.stringify({ ...valid, padding: 'x'.repeat(4 * 1024 * 1024) }));
  await assert.rejects(readFactoryState(root), /bounded read limit/);
});

test('review evidence hashing accepts bounded binary regular files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-review-evidence-'));
  const bytes = Buffer.from([0, 255, 128, 10]);
  await writeFile(path.join(root, 'screenshot.png'), bytes);
  const review = {
    schema_version: 1,
    plan_revision: 'a'.repeat(64),
    workspace_revision: 'b'.repeat(64),
    criteria: [{
      id: 'AC-001',
      status: 'pass',
      observation: 'The screenshot shows the verified result.',
      evidence: [{ path: 'screenshot.png', sha256: digest(bytes) }],
    }],
    blockers: [],
  };
  const evidence = await reviewEvidenceDigests(root, review);
  assert.deepEqual(evidence.entries, [{ path: 'screenshot.png', sha256: digest(bytes) }]);
  await symlink('screenshot.png', path.join(root, 'linked.png'));
  await assert.rejects(reviewEvidenceDigests(root, {
    ...review,
    criteria: [{
      id: 'AC-001',
      status: 'pass',
      observation: 'The linked screenshot is not accepted.',
      evidence: [{ path: 'linked.png', sha256: digest(bytes) }],
    }],
  }), /Symlink paths are not allowed/);
});

test('factory configuration preserves explicit preferences and clears consent on adapter change', async () => {
  const root = await project();
  const state = await initFactory(root, {
    name: 'Adapter settings',
    idea: 'Keep selected model and reasoning.',
    adapter: 'fixture',
    model: 'model-24',
    reasoning: 'balanced',
    billing: 'subscription',
    confirmed: true,
  });
  assert.deepEqual(state.billing, { mode: 'subscription', confirmed: true });
  const configured = await configureFactory(root, { adapter: 'fixture-next' });
  assert.equal(configured.adapter, 'fixture-next');
  assert.equal(configured.model, 'model-24');
  assert.equal(configured.reasoning, 'balanced');
  assert.deepEqual(configured.billing, { mode: 'local', confirmed: false });
});

test('factory init preserves a pre-existing owner idea document', async () => {
  const root = await project();
  const ideaPath = path.join(root, 'docs/product/idea.md');
  await writeFile(ideaPath, '# Owner idea\n\nKeep my original text.\n');
  await assert.rejects(initFactory(root, {
    name: 'No overwrite',
    idea: 'Do not replace owner content.',
    adapter: 'fixture',
  }), /existing idea document is preserved/);
  assert.equal(await readFile(ideaPath, 'utf8'), '# Owner idea\n\nKeep my original text.\n');
  assert.equal(await readFactoryState(root), null);
});

test('installed factory route exposes help and rejects unknown options', async () => {
  const help = spawnSync(process.execPath, ['dist/runtime/project.cjs', 'factory', '--help'], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /factory init --name NAME/);
  const root = await project();
  const initialized = spawnSync(process.execPath, [
    'dist/runtime/project.cjs', 'factory', 'init',
    '--name', 'CLI preview', '--idea', 'Create a local tested feature.',
    '--adapter', 'fixture', '--project', root,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.match(initialized.stdout, /"stage":\s*"research"/);
  const unknown = spawnSync(process.execPath, [
    'dist/runtime/project.cjs', 'factory', 'status', '--unknown', '--project', root,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown option --unknown/);
});
