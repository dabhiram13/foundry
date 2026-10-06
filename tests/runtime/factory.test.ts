import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  approveFactory, cancelFactory, configureFactory, initFactory, recoverFactory, reviewFactory, runFactory, statusFactory,
} from '../../src/core/factory.js';
import {
  FACTORY_LOCK, readBoundedBytes, readBuildFailure, readFactoryState, reviewEvidenceDigests, writeFactoryState,
} from '../../src/core/factory-contract.js';
import { installWorkspace } from '../../src/core/install.js';
import { ProjectService } from '../../src/core/projects.js';
import { complete as lifecycleComplete, recover as lifecycleRecover } from '../../src/core/lifecycle.js';
import { digest, withProcessLock } from '../../src/core/fs.js';

type JsonRecord = Record<string, unknown>;
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function project(
  providerMode = 'success',
  checkPass = true,
  hangingCheck = false,
  ignorePaths: string[] = [],
  parent = os.tmpdir(),
): Promise<string> {
  const root = await mkdtemp(path.join(parent, 'foundry-runtime-factory-'));
  await mkdir(path.join(root, '.foundry'), { recursive: true });
  await mkdir(path.join(root, 'docs/product'), { recursive: true });
  await mkdir(path.join(root, 'docs/specs'), { recursive: true });
  await writeFile(path.join(root, '.foundry/project.json'), JSON.stringify({
    name: 'factory fixture',
    checks: [],
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
const fixtureCheckPass=${JSON.stringify(checkPass)};
const fixtureHangingCheck=${JSON.stringify(hangingCheck)};
let input='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>input+=chunk);
process.stdin.on('end',()=>{
  const request=JSON.parse(input);
  const prompt=request.prompt;
  if(prompt.includes('Repair evidence:\\n')){
    const evidence=JSON.parse(prompt.split('Repair evidence:\\n')[1].split('\\n')[0]);
    const receiptBytes=fs.readFileSync(evidence.receipt);
    const receipt=JSON.parse(receiptBytes);
    if(crypto.createHash('sha256').update(receiptBytes).digest('hex')!==evidence.receipt_sha256
      ||receipt.inputs_before!==evidence.inputs_before||receipt.inputs_after!==evidence.inputs_after
      ||evidence.required_failures!==1||evidence.checks[0].name!=='behavior')throw new Error('Repair evidence mismatch');
    for(const check of evidence.checks){
      if(crypto.createHash('sha256').update(fs.readFileSync(check.log)).digest('hex')!==check.log_sha256)throw new Error('Repair log mismatch');
    }
    const history='.foundry/state/factory/repair-prompts.json';
    const prompts=fs.existsSync(history)?JSON.parse(fs.readFileSync(history)) : [];
    prompts.push(prompt);
    fs.writeFileSync(history,JSON.stringify(prompts));
  }else if(prompt.includes('Repair task "'))throw new Error('Repair evidence missing');
  if(prompt.includes('current stage is Research') && (!request.output_schema || request.permissions.sandbox !== 'read-only')) {
    throw new Error('Research must request structured output and read-only access');
  }
  fs.writeFileSync('.foundry/state/factory/last-provider-request.json',JSON.stringify({
    model:request.model,reasoning:request.reasoning,
  }));
  const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  let output={ok:true};
  if(mode==='hang-child'){
    const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    fs.writeFileSync('provider-child-started',String(child.pid));
    setInterval(()=>{},1000);
    return;
  }
  if(((mode==='research-hang'&&prompt.includes('current stage is Research'))||(mode==='synthesis-hang'&&prompt.includes('Research synthesis.')))&&!fs.existsSync('.foundry/state/factory/research-retried')){
    write('docs/product/research.md','# Partial Research\\n\\nSource: https://example.test/partial\\n');
    fs.writeFileSync('.foundry/state/factory/research-retried','1');
    const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    fs.writeFileSync('provider-child-started',String(child.pid));
    setInterval(()=>{},1000);
    return;
  }
  if(prompt.includes('Research source selection.')){
    output={sources:[{kind:'local',location:'docs/product/idea.md'}]};
    if(mode==='research-url-only')output={ok:true};
    if(mode==='research-no-source')output={sources:[{kind:'local',location:'docs/missing.md'}]};
  }else if(prompt.includes('Research synthesis.')){
    const observation=fs.readFileSync('docs/product/idea.md','utf8').trim();
    output={summary:'The owner supplied a bounded local idea.',findings:[{claim:'The owner describes the intended product.',source:'S1',quote:observation}],limitations:['Owner input is not independent market evidence.']};
    if(mode==='research-fabricated-quote')output.findings[0].quote='A fabricated quotation not present in any source.';
    if(mode==='research-tampered-source'){
      const collections=fs.readdirSync('.foundry/state/factory/research');
      write('.foundry/state/factory/research/'+collections[0]+'/S1.txt','tampered');
    }
  }else if(prompt.includes('current stage is Plan')){
    write('docs/specs/product.md','# Product plan\\n\\n## Acceptance criteria\\n- [AC-001] A configured local check passes\\n');
  }else if(prompt.includes('current stage is Design')){
    write('docs/product/design.md','# Design\\n\\nThe local product has a clear verified state.\\n');
  }else if(prompt.includes('current stage is Build')){
    if(prompt.includes('Create docs/product/tasks.md')){
      write('docs/product/tasks.md',prompt.includes('Factory workspace: Installed journey.')
        ? '- [ ] Implement the local feature\\n- [ ] Add a second behavior\\n'
        : mode.startsWith('workflow-')
          ? '- [ ] Implement the local feature\\n- [ ] Continue after bootstrap\\n'
          : '- [ ] Implement the local feature\\n');
    }else if(prompt.includes('first implementation turn')){
      if(!prompt.includes('first implementation turn: create or change non-test product source')
        ||!prompt.includes('configure a real required check in .foundry/project.json')
        ||!prompt.includes('write docs/product/checks.json')) throw new Error('first-task bootstrap instructions missing');
      const plan=fs.readFileSync('docs/specs/product.md','utf8');
      const approvedIds=plan.split('\\n').filter(line=>line.startsWith('- [AC-')).map(line=>line.split(']')[0].slice(3));
      const feature=plan.includes('A changed local behavior is checked')
        ? 'verified changed local behavior' : 'verified local feature';
      write('src/product.js','module.exports = { feature: '+JSON.stringify(feature)+' };\\n');
      if(prompt.includes('Factory workspace: Installed journey.')) write('src/second.js','module.exports = { behavior: "pending" };\\n');
      const checkCommand=fixtureHangingCheck
        ? [process.execPath,'-e',"const fs=require('node:fs');if(fs.existsSync('.foundry/state/factory/check-pass'))process.exit(0);const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync('check-started',String(child.pid));setInterval(()=>{},1000);"]
        : [process.execPath,'-e',fixtureCheckPass
          ? "const fs=require('node:fs');const product=require('./src/product.js');if(!['verified local feature','verified changed local behavior'].includes(product.feature))process.exit(1);if(fs.existsSync('src/second.js')){const second=require('./src/second.js');if(!['pending','verified second behavior'].includes(second.behavior))process.exit(1);}"
          : mode==='repair-success' ? "if(!require('./src/product.js').repaired)process.exit(1)" : 'process.exit(1)'];
      write('.foundry/project.json',JSON.stringify({name:'factory fixture',checks:[{
        name:'behavior',
        command:checkCommand,
        cwd:'.',timeout:10,required:true,inputs:prompt.includes('Factory workspace: Installed journey.')
          ? ['docs/specs/product.md','src/product.js','src/second.js'] : ['docs/specs/product.md','src/product.js'],environment:[]
      },...(mode==='extra-required-check'?[{
        name:'style',command:[process.execPath,'-e','process.exit(0)'],cwd:'.',timeout:10,required:true,
        inputs:['src/other.txt'],environment:[]
      }]:[])]}));
      if(mode==='extra-required-check')write('src/other.txt','local style input\\n');
      write('docs/product/checks.json',JSON.stringify({schema_version:1,criteria:approvedIds.map(id=>({id:mode==='bad-mapping'?'AC-999':id,check_name:'behavior'}))}));
    }else if(prompt.includes('Add a second behavior')){
      write('src/second.js','module.exports = { behavior: "verified second behavior" };\\n');
    }else{
      const plan=fs.readFileSync('docs/specs/product.md','utf8');
      const feature=plan.includes('A changed local behavior is checked')
        ? 'verified changed local behavior' : 'verified local feature';
      write('src/product.js','module.exports = { feature: '+JSON.stringify(feature)+' };\\n');
      if(mode==='repair-progress')fs.appendFileSync('src/product.js','// '+prompt.match(/repair (\\d) of 3/)[1]+'\\n');
      if(mode==='repair-success')fs.appendFileSync('src/product.js','module.exports.repaired = true;\\n');
    }
    if(mode.startsWith('workflow-')
      &&!prompt.includes('Create docs/product/tasks.md')
      &&!prompt.includes('first implementation turn')){
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
    if(request.permissions?.sandbox!=='read-only') throw new Error('review provider was not read-only');
    if(!prompt.includes('"schema_version": 1')||!prompt.includes('"status": "pass|fail|unverified"')
      ||!prompt.includes('"plan_revision"')||!prompt.includes('"workspace_revision"')
      ||!prompt.includes('"observation"')||!prompt.includes('"path": "project-relative/path"')
      ||!prompt.includes('Approved criteria:')
      ||!prompt.includes('"sha256": "64 lowercase hex characters"')
      ||!prompt.includes('"blockers"')||!prompt.includes('Report every blocker')) throw new Error('review contract missing from prompt');
    const receiptPath=prompt.split('\\n').find(line=>line.startsWith('Final verification receipt: '))?.slice('Final verification receipt: '.length);
    const receiptHash=prompt.split('\\n').find(line=>line.startsWith('Final verification receipt SHA-256: '))?.slice('Final verification receipt SHA-256: '.length);
    if(!receiptPath||!receiptHash||crypto.createHash('sha256').update(fs.readFileSync(receiptPath)).digest('hex')!==receiptHash) {
      throw new Error('reviewer did not receive the exact verification receipt and hash');
    }
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
      capabilities: ['tools', 'jsonl', 'cancel', 'permissions', 'model_selection', 'reasoning_selection', 'structured_output'],
      billing_modes: ['local', 'subscription'],
    })),
  }));
  if (ignorePaths.length) await writeFile(path.join(root, '.gitignore'), `${ignorePaths.join('\n')}\n`);
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

test('Research rejects URL-only output, unavailable sources, invented quotes and changed source snapshots', async t => {
  for (const mode of ['research-url-only', 'research-no-source', 'research-fabricated-quote', 'research-tampered-source']) {
    const root = await project(mode);
    t.after(() => rm(root, { recursive: true, force: true }));
    await initFactory(root, { name: 'Research evidence', idea: 'Use actual evidence, not a URL placeholder.', adapter: 'fixture' });
    await assert.rejects(runFactory(root));
    const state = await readFactoryState(root);
    assert.equal(state?.stage, 'research');
    assert.equal(state?.completed_stages.includes('research'), false);
    assert.equal(state?.status, 'failed');
  }
});

test('Factory rejects adapters without structured research support before starting work', async t => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, '.foundry/providers.json');
  const configuration = JSON.parse(await readFile(file, 'utf8'));
  configuration.adapters[0].capabilities = configuration.adapters[0].capabilities.filter((item: string) => item !== 'structured_output');
  await writeFile(file, JSON.stringify(configuration));
  await assert.rejects(initFactory(root, { name: 'Research readiness', idea: 'Require structured handoffs.', adapter: 'fixture' }), /structured_output/);
});

test('cancellation during research synthesis retains the stage and requires explicit recovery', async t => {
  const root = await project('synthesis-hang');
  t.after(() => rm(root, { recursive: true, force: true }));
  await initFactory(root, { name: 'Research recovery', idea: 'Preserve source evidence after interruption.', adapter: 'fixture' });
  const running = runFactory(root).then(() => null, (error: Error) => error);
  const pid = Number(await waitForFile(path.join(root, 'provider-child-started')));
  await cancelFactory(root);
  assert.match(String(await running), /cancel/i);
  await waitForPidExit(pid);
  assert.equal((await readFactoryState(root))?.stage, 'research');
  assert.equal((await recoverFactory(root)).status, 'interrupted');
  assert.equal((await runFactory(root)).stage, 'scope');
});

test('factory completes Research through Ship with approvals, a real check and checkpoint', async (t) => {
  const products = await mkdtemp(path.join(os.tmpdir(), 'foundry-shipped-project-'));
  t.after(() => rm(products, { recursive: true, force: true }));
  const root = await project('success', true, false, [], products);
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
  const service = new ProjectService(path.resolve('.'), products);
  const status = await service.status(path.basename(root));
  assert.equal(status.status, 'completed');
  assert.ok((status.artifacts as JsonRecord[]).some((artifact) => artifact.path === 'docs/product/release.md'));
  const summary = await service.artifact(path.basename(root), 'docs/product/release.md');
  assert.match(String(summary.content), /Ship summary/);
  assert.match(String(summary.content), /Publication: not_authorized/);
  assert.match(String(summary.content), new RegExp(String(completed?.verification_receipt)));
  await assert.rejects(service.artifact(path.basename(root), '.foundry/state/factory/ship.json'), /not an allowed/);
});

test('build checkpoints succeed with ignored state and exclude private files', async () => {
  const root = await project('success', true, false, [
    '/.foundry/state/',
    '!/.foundry/state/',
    '/.foundry/state/**',
    '!/.foundry/state/factory/',
    '/.foundry/state/factory/**',
    '!/.foundry/state/factory/unignored-owner-state.json',
    '/.foundry/providers.json',
    '/.env',
  ]);
  const initialTree = spawnSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(initialTree.status, 0);
  assert.doesNotMatch(initialTree.stdout, /(?:^|\n)(?:\.foundry\/providers\.json|\.env(?:\n|$))/);
  await writeFile(path.join(root, '.env'), 'LOCAL_TEST_VALUE=fixture-only\n');
  await advanceToBuild(root, 'Ignored state checkpoint');
  const ignoredState = spawnSync('git', ['check-ignore', '-q', '.foundry/state/factory/controller.json'], {
    cwd: root, encoding: 'utf8',
  });
  const unignoredState = spawnSync('git', ['check-ignore', '-q', '.foundry/state/factory/unignored-owner-state.json'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(ignoredState.status, 0);
  assert.equal(unignoredState.status, 1);
  await writeFile(path.join(root, '.foundry/state/factory/unignored-owner-state.json'), 'OWNER_PRIVATE_STATE=fixture-only\n');
  await runFactory(root);
  const state = await readFactoryState(root);
  assert.equal(state?.stage, 'verify');
  assert.equal(state?.build_tasks[0]?.status, 'done');
  assert.match(String(state?.build_tasks[0]?.checkpoint), /^[a-f0-9]{40,64}$/);
  const tracked = spawnSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(tracked.status, 0);
  assert.match(tracked.stdout, /src\/product\.js/);
  assert.doesNotMatch(tracked.stdout, /(?:^|\n)(?:\.foundry\/state\/|\.foundry\/providers\.json|\.env(?:\n|$))/);
});

test('status offers recovery only for dead controller ownership and never an approval during active work', async () => {
  const root = await project();
  await initFactory(root, {
    name: 'Stale owner status',
    idea: 'Expose explicit recovery only with stale ownership evidence.',
    adapter: 'fixture',
  });
  await runFactory(root);
  await runFactory(root);
  const plan = await reviewFactory(root, 'plan');
  await approveFactory(root, 'plan', String(plan.revision));
  await writeFile(path.join(root, 'docs/specs/product.md'),
    '# Product plan\n\n## Acceptance criteria\n- [AC-001] A changed requirement makes approval stale\n');
  const running = await readFactoryState(root);
  assert.ok(running);
  running.status = 'running';
  await writeFactoryState(root, running);

  const noOwner = await statusFactory(root);
  assert.equal(noOwner.status, 'running');
  assert.deepEqual(noOwner.stale_approvals, ['plan']);
  assert.equal(noOwner.ready_next_step.action, 'none');

  const ownerFile = path.join(root, FACTORY_LOCK, 'owner.json');
  await mkdir(path.dirname(ownerFile), { recursive: true });
  const deadPid = process.pid + 1_000_000;
  assert.throws(() => process.kill(deadPid, 0), { code: 'ESRCH' });
  await writeFile(ownerFile, JSON.stringify({ pid: deadPid, token: 'durable-owner-token' }));
  const staleOwner = await statusFactory(root);
  assert.equal(staleOwner.status, 'recovery_required');
  assert.deepEqual(staleOwner.ready_next_step, { action: 'recover', stage: 'design', label: 'Design' });

  await writeFile(ownerFile, JSON.stringify({ pid: process.pid, token: 'live-owner-token' }));
  const liveOwner = await statusFactory(root);
  assert.equal(liveOwner.status, 'running');
  assert.equal(liveOwner.ready_next_step.action, 'none');
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

test('owner reapproval rebuilds a criterion under the same approved ID without replacing ledger history', async () => {
  const root = await project();
  await advanceToBuild(root, 'Criterion reapproval');
  await runFactory(root);
  const originalState = await readFactoryState(root);
  const originalCriterion = originalState?.workflow_criteria[0];
  assert.equal(originalCriterion?.approved_id, 'AC-001');
  const originalLedger = JSON.parse(await readFile(path.join(root, 'docs/project/marketcraft.json'), 'utf8')) as JsonRecord;
  const originalRecords = originalLedger.records as JsonRecord[];
  const originalRecord = originalRecords.find((record) => record.id === originalCriterion?.id);
  assert.ok(originalRecord);
  await writeFile(path.join(root, 'docs/specs/product.md'),
    '# Product plan\n\n## Acceptance criteria\n- [AC-001] A changed local behavior is checked\n');
  await assert.rejects(runFactory(root), /Owner approval is required/);
  const plan = await reviewFactory(root, 'plan');
  await approveFactory(root, 'plan', String(plan.revision));
  await runFactory(root);
  const design = await reviewFactory(root, 'design');
  await approveFactory(root, 'design', String(design.revision));
  const rebuilt = await runFactory(root);
  assert.equal(rebuilt.stage, 'verify');
  assert.equal(rebuilt.workflow_criteria[0]?.approved_id, 'AC-001');
  assert.equal(rebuilt.workflow_criteria[0]?.expected, 'A changed local behavior is checked');
  assert.notEqual(rebuilt.workflow_criteria[0]?.id, originalCriterion?.id);
  assert.match(await readFile(path.join(root, 'src/product.js'), 'utf8'), /verified changed local behavior/);
  const ledger = JSON.parse(await readFile(path.join(root, 'docs/project/marketcraft.json'), 'utf8')) as JsonRecord;
  const records = ledger.records as JsonRecord[];
  assert.ok(records.some((record) => record.id === originalCriterion?.id));
  const replacement = records.find((record) => record.id === rebuilt.workflow_criteria[0]?.id);
  assert.equal(replacement?.supersedes, originalCriterion?.id);
  assert.equal(originalRecord?.expected, 'A configured local check passes');
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

test('owner-approved replacement criteria can retire old requirements and ship without erasing history', async () => {
  const root = await project();
  await advanceToBuild(root, 'Replaced requirement');
  await runFactory(root);
  const previous = (await readFactoryState(root))?.workflow_criteria[0];
  await writeFile(path.join(root, 'docs/specs/product.md'),
    '# Revised plan\n\n## Acceptance criteria\n- [AC-002] A changed local behavior is checked\n');
  await assert.rejects(runFactory(root), /Owner approval is required/);
  await approveFactory(root, 'plan', String((await reviewFactory(root, 'plan')).revision));
  await runFactory(root);
  await approveFactory(root, 'design', String((await reviewFactory(root, 'design')).revision));
  await runFactory(root);
  await runFactory(root);
  assert.equal((await runFactory(root)).status, 'completed');
  const ledger = JSON.parse(await readFile(path.join(root, 'docs/project/marketcraft.json'), 'utf8')) as JsonRecord;
  const records = ledger.records as JsonRecord[];
  assert.ok(records.some((record) => record.id === previous?.id));
  assert.ok(records.some((record) => record.supersedes === previous?.id && record.required === false));
});

test('required-check freezing includes working directory and unmapped required checks', async (t) => {
  for (const mutation of ['cwd', 'remove-unmapped']) {
    await t.test(mutation, async () => {
      const root = await project('extra-required-check');
      await advanceToBuild(root, 'Check configuration integrity');
      await runFactory(root);
      const configPath = path.join(root, '.foundry/project.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as { checks: JsonRecord[] };
      if (mutation === 'cwd') config.checks[0]!.cwd = 'src';
      else config.checks.pop();
      await writeFile(configPath, JSON.stringify(config));
      await assert.rejects(runFactory(root));
      assert.equal((await readFactoryState(root))?.ship, null);
    });
  }
});

test('Factory check mapping bytes remain frozen after Build', async () => {
  const root = await project();
  await advanceToBuild(root, 'Mapping drift');
  await runFactory(root);
  const mappingPath = path.join(root, 'docs/product/checks.json');
  const original = await readFile(mappingPath);
  await writeFile(mappingPath, Buffer.concat([original, Buffer.from('\n')]));
  await assert.rejects(runFactory(root), /check mapping changed after Build freeze/);
  const failed = await readFactoryState(root);
  assert.equal(failed?.status, 'failed');
  assert.equal(failed?.failure?.code, 'mapping');
  assert.equal(failed?.workflow_criteria.length, 1);
  await writeFile(mappingPath, original);
  const resumed = await runFactory(root);
  assert.equal(resumed.stage, 'release');
});

test('completed lifecycle recovery preserves shipping intent and rechecks review evidence', async () => {
  const root = await project('state-evidence');
  await advanceToBuild(root, 'Shipping recovery');
  await runFactory(root);
  await runFactory(root);
  await runFactory(root);
  const completed = await readFactoryState(root);
  assert.equal(completed?.status, 'completed');
  const controllerPath = path.join(root, '.foundry/state/factory/controller.json');
  const controller = JSON.parse(await readFile(controllerPath, 'utf8')) as JsonRecord;
  controller.status = 'shipping';
  await writeFile(controllerPath, JSON.stringify(controller));
  const lifecyclePath = path.join(root, '.foundry/state/runs', String(controller.lifecycle_run_id), 'state.json');
  const lifecycle = JSON.parse(await readFile(lifecyclePath, 'utf8')) as JsonRecord;
  const activePointer = JSON.stringify({ run_id: lifecycle.run_id, slug: lifecycle.slug });
  await writeFile(path.join(root, '.foundry/state/active.json'), activePointer);
  const reviewEvidencePath = path.join(root, '.foundry/state/factory/review.bin');
  const reviewEvidence = await readFile(reviewEvidencePath);
  await writeFile(reviewEvidencePath, Buffer.from([4, 3, 2, 1]));
  const blocked = await recoverFactory(root);
  assert.equal(blocked.status, 'shipping');
  assert.equal(blocked.ship?.path, '.foundry/state/factory/ship.json');
  await writeFile(reviewEvidencePath, reviewEvidence);
  const recovered = await recoverFactory(root);
  assert.equal(recovered.status, 'completed');
  assert.equal(recovered.ship?.path, '.foundry/state/factory/ship.json');
  await writeFile(reviewEvidencePath, Buffer.from([4, 3, 2, 1]));
  await assert.rejects(runFactory(root), /review evidence changed after review/);
  await assert.rejects(recoverFactory(root), /review evidence changed after review/);
  await writeFile(path.join(root, '.foundry/state/active.json'), activePointer);
  await assert.rejects(lifecycleRecover(root), /review evidence changed after review/);
  await assert.rejects(lifecycleComplete(root), /review evidence changed after review/);
});

test('factory freezes accepted verify IDs, expectations, and required-check mappings before Build', async (t) => {
  for (const [mode, error] of [
    ['workflow-drop', /criteria changed during Build/],
    ['workflow-reword', /criterion AC-001 changed during Build/],
    ['workflow-reclassify', /criteria changed during Build/],
    ['workflow-remap-check', /Required check configuration changed/],
  ] as const) {
    await t.test(mode, async () => {
      const root = await project(mode);
      await advanceToBuild(root, `Frozen ${mode}`);
      await assert.rejects(runFactory(root), error);
      const state = await readFactoryState(root);
      assert.equal(state?.stage, 'build');
      assert.equal(state?.status, 'failed');
      assert.equal(state?.workflow_criteria.length, 1);
      assert.notEqual(state?.workflow_criteria[0]?.id, 'AC-001');
      assert.equal(state?.workflow_criteria[0]?.approved_id, 'AC-001');
      assert.equal(state?.workflow_criteria[0]?.expected, 'A configured local check passes');
      assert.equal(state?.workflow_criteria[0]?.check_name, 'behavior');
    });
  }
});

test('Ship recovery retains its intent across both completion crash boundaries', async (t) => {
  for (const boundary of ['completing', 'pointer-removed']) {
    await t.test(boundary, async () => {
      const root = await project('state-evidence');
      await advanceToBuild(root, `Ship ${boundary}`);
      await runFactory(root);
      await runFactory(root);
      await runFactory(root);
      const controllerPath = path.join(root, '.foundry/state/factory/controller.json');
      const controller = JSON.parse(await readFile(controllerPath, 'utf8')) as JsonRecord;
      controller.status = 'shipping';
      await writeFile(controllerPath, JSON.stringify(controller));
      const lifecyclePath = path.join(root, '.foundry/state/runs', String(controller.lifecycle_run_id), 'state.json');
      const lifecycle = JSON.parse(await readFile(lifecyclePath, 'utf8')) as JsonRecord;
      if (boundary === 'completing') {
        lifecycle.status = 'completing';
        await writeFile(lifecyclePath, JSON.stringify(lifecycle));
        await writeFile(path.join(root, '.foundry/state/active.json'), JSON.stringify({
          run_id: lifecycle.run_id, slug: lifecycle.slug,
        }));
      }
      const evidencePath = path.join(root, '.foundry/state/factory/review.bin');
      const original = await readFile(evidencePath);
      await writeFile(evidencePath, Buffer.from([9, 9, 9]));
      assert.equal((await recoverFactory(root)).status, 'shipping');
      await writeFile(evidencePath, original);
      assert.equal((await recoverFactory(root)).status, 'completed');
      const intent = lifecycle.completion as { path: string };
      await rm(path.join(root, intent.path));
      await assert.rejects(lifecycleComplete(root));
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
  const prompts = JSON.parse(await readFile(path.join(root, '.foundry/state/factory/repair-prompts.json'), 'utf8')) as string[];
  assert.equal(prompts.length, 3);
  assert.doesNotMatch(prompts[0]!, /same required checks failed on unchanged/);
  for (const prompt of prompts.slice(1)) assert.match(prompt, /same required checks failed on unchanged/);
  assert.equal(await readFile(path.join(root, 'docs/product/tasks.md'), 'utf8'), '- [ ] Implement the local feature\n');
  const runId = state?.lifecycle_run_id;
  const recovered = await recoverFactory(root);
  assert.equal(recovered.lifecycle_run_id, runId);
  assert.equal(recovered.stage, 'build');
  assert.equal(recovered.build_tasks[0]?.status, 'failed');
});

test('changed repair inputs clear repetition guidance without extending the repair budget', async () => {
  const root = await project('repair-progress', false);
  await advanceToBuild(root, 'Changing repairs');
  await assert.rejects(runFactory(root), /three bounded repairs/);
  const prompts = JSON.parse(await readFile(path.join(root, '.foundry/state/factory/repair-prompts.json'), 'utf8')) as string[];
  assert.equal(prompts.length, 3);
  for (const prompt of prompts) assert.doesNotMatch(prompt, /same required checks failed on unchanged/);
});

test('an evidence-led repair can pass checks and checkpoint the task', async () => {
  const root = await project('repair-success', false);
  await advanceToBuild(root, 'Successful repair');
  await runFactory(root);
  const state = await readFactoryState(root);
  assert.equal(state?.stage, 'verify');
  assert.equal(state?.build_tasks[0]?.repair_attempts, 1);
  assert.equal(state?.build_tasks[0]?.status, 'done');
  assert.ok(state?.build_tasks[0]?.checkpoint);
});

test('repair receipts are bounded, tied to their run and summarized without log content', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-repair-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runId = '11111111-1111-4111-8111-111111111111';
  const directory = `.foundry/state/runs/${runId}/verification-fixture`;
  const relative = `${directory}/receipts.json`;
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  const receipt = {
    run_id: runId, passed: false, status: 'failed', inputs_before: 'a'.repeat(64), inputs_after: 'a'.repeat(64),
    checks: Array.from({ length: 25 }, (_, index) => ({
      name: `check-${index}`, required: true, status: 'failed', exit_code: 1,
      log: `${directory}/check-${index}.log`, log_sha256: 'b'.repeat(64), output: 'DO_NOT_INCLUDE_RAW_LOGS',
    })),
  };
  const save = (value: unknown) => writeFile(file, JSON.stringify(value));
  await save(receipt);
  const result = await readBuildFailure(root, runId, relative);
  assert.equal(result.evidence.receipt_sha256, digest(await readFile(file)));
  assert.equal(result.evidence.checks.length, 20);
  assert.equal(result.evidence.required_failures, 25);
  assert.equal(result.evidence.omitted_failures, 5);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_INCLUDE_RAW_LOGS/);
  assert.ok(result.signature);
  const longName = 'a'.repeat(200);
  await save({ ...receipt, checks: [{ ...receipt.checks[0], name: longName, log: `${directory}/${longName}.log` }] });
  assert.equal((await readBuildFailure(root, runId, relative)).evidence.checks[0]?.name, longName);
  await save({ ...receipt, checks: receipt.checks.map(check => ({ ...check, exit_code: 2 })) });
  assert.notEqual((await readBuildFailure(root, runId, relative)).signature, result.signature);
  await save({ ...receipt, inputs_after: 'c'.repeat(64) });
  assert.equal((await readBuildFailure(root, runId, relative)).signature, null);
  await save({ ...receipt, checks: receipt.checks.map(check => ({ ...check, required: false })) });
  assert.equal((await readBuildFailure(root, runId, relative)).evidence.required_failures, 0);
  for (const invalid of [
    {}, { ...receipt, run_id: '22222222-2222-4222-8222-222222222222' },
    { ...receipt, passed: true }, { ...receipt, status: 'running' },
    { ...receipt, checks: [{ ...receipt.checks[0], log: 'docs/other.log' }] },
    { ...receipt, checks: [{ ...receipt.checks[0], log: `${directory}/../other.log` }] },
  ]) {
    await save(invalid);
    await assert.rejects(readBuildFailure(root, runId, relative));
  }
  await writeFile(file, 'not json');
  await assert.rejects(readBuildFailure(root, runId, relative));
  await writeFile(file, 'x'.repeat(8 * 1024 * 1024 + 1));
  await assert.rejects(readBuildFailure(root, runId, relative));
  await assert.rejects(readBuildFailure(root, runId, 'docs/receipt.json'));
  await assert.rejects(readBuildFailure(root, runId, `${directory}/../other/receipts.json`));
  await rm(file);
  await assert.rejects(readBuildFailure(root, runId, relative));
});

test('checkpoint failure restores only the unchanged tick and preserves owner edits', async (t) => {
  await t.test('unchanged tick is rolled back', async () => {
    const root = await project();
    await advanceToBuild(root, 'Checkpoint failure');
    const hook = path.join(root, '.git/hooks/pre-commit');
    await writeFile(hook, '#!/bin/sh\nexit 1\n');
    await chmod(hook, 0o700);
    await assert.rejects(runFactory(root), /Build checkpoint could not commit/);
    assert.equal(await readFile(path.join(root, 'docs/product/tasks.md'), 'utf8'), '- [ ] Implement the local feature\n');
    assert.equal((await readFactoryState(root))?.build_tasks[0]?.status, 'working');
    const failed = await readFactoryState(root);
    assert.ok(failed?.verification_receipt);
    assert.equal(failed?.failure?.code, 'artifact');
    assert.match(failed?.failure?.message ?? '', /checks passed, but the Git checkpoint could not be saved/);
    assert.equal((await statusFactory(root)).ready_next_step.action, 'recover');
    await assert.rejects(runFactory(root), /Recover the unresolved factory stage/);
    await rm(hook);
    assert.equal((await recoverFactory(root)).status, 'interrupted');
    assert.equal((await runFactory(root)).stage, 'verify');
  });
  await t.test('owner edits are preserved', async () => {
    const root = await project();
    await advanceToBuild(root, 'Checkpoint owner edit');
    const hook = path.join(root, '.git/hooks/pre-commit');
    await writeFile(hook, '#!/bin/sh\nprintf "\\n- [ ] Owner addition\\n" >> docs/product/tasks.md\nexit 1\n');
    await chmod(hook, 0o700);
    await assert.rejects(runFactory(root), /Build checkpoint could not commit/);
    const tasks = await readFile(path.join(root, 'docs/product/tasks.md'), 'utf8');
    assert.match(tasks, /- \[x\] Implement the local feature/);
    assert.match(tasks, /- \[ \] Owner addition/);
  });
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
  const frozenCommand = JSON.stringify(JSON.parse(await readFile(path.join(root, '.foundry/project.json'), 'utf8')).checks[0].command);
  await writeFile(path.join(root, '.foundry/state/factory/check-pass'), '');
  const resumed = await runFactory(root);
  assert.equal(resumed.stage, 'verify');
  assert.equal(resumed.lifecycle_run_id, runId);
  assert.equal(JSON.stringify(JSON.parse(await readFile(path.join(root, '.foundry/project.json'), 'utf8')).checks[0].command), frozenCommand);
  await runFactory(root);
  const shipped = await runFactory(root);
  assert.equal(shipped.status, 'completed');
  assert.equal(shipped.lifecycle_run_id, runId);
});

test('partial Research output is canceled, recovered, and rerun at Research before progressing to Ship', async () => {
  const root = await project('research-hang');
  await initFactory(root, { name: 'Research recovery', idea: 'Preserve partial upstream work.', adapter: 'fixture' });
  const running = runFactory(root).then(() => null, (error: Error) => error);
  const pid = Number(await waitForFile(path.join(root, 'provider-child-started')));
  await cancelFactory(root);
  assert.match(String(await running), /cancel/i);
  await waitForPidExit(pid);
  assert.match(await readFile(path.join(root, 'docs/product/research.md'), 'utf8'), /Partial Research/);
  const failed = await readFactoryState(root);
  assert.equal(failed?.stage, 'research');
  assert.equal(failed?.completed_stages.length, 0);
  const recovered = await recoverFactory(root);
  assert.equal(recovered.stage, 'research');
  assert.equal(recovered.status, 'interrupted');
  assert.equal((await runFactory(root)).stage, 'scope');
  assert.match(await readFile(path.join(root, 'docs/product/research.md'), 'utf8'), /S1: docs\/product\/idea\.md/);
  await runFactory(root);
  const plan = await reviewFactory(root, 'plan');
  await approveFactory(root, 'plan', String(plan.revision));
  await runFactory(root);
  const design = await reviewFactory(root, 'design');
  await approveFactory(root, 'design', String(design.revision));
  await runFactory(root);
  await runFactory(root);
  const reviewed = await runFactory(root);
  assert.equal(reviewed.stage, 'release');
  const shipped = await runFactory(root);
  assert.equal(shipped.status, 'completed');
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
  await symlink('missing-target.json', path.join(root, '.foundry/state/factory/linked.json'));
  await assert.rejects(readBoundedBytes(root, '.foundry/state/factory/linked.json'), /Symlink paths are not allowed|not a regular file/);
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

test('Factory permits subscription setup without consent but requires consent before a run', async () => {
  const root = await project();
  await assert.rejects(initFactory(root, {
    name: 'Unsupported adapter',
    idea: 'Do not launch this adapter.',
    adapter: 'chatgpt',
  }), /ChatGPT execution is unsupported/);
  const state = await initFactory(root, {
    name: 'Unconfirmed subscription',
    idea: 'Set up without starting provider work.',
    adapter: 'codex',
    billing: 'subscription',
  });
  assert.deepEqual(state.billing, { mode: 'subscription', confirmed: false });
  await assert.rejects(runFactory(root), /Subscription billing requires explicit confirmation/);
  const unchanged = await readFactoryState(root);
  assert.equal(unchanged?.status, 'ready');
  assert.equal(unchanged?.provider_task_id, null);
});

test('role preferences apply only to the role assigned to the current stage', async () => {
  const root = await project();
  await initFactory(root, {
    name: 'Role settings',
    idea: 'Apply explicit role preferences only to assigned stages.',
    adapter: 'fixture',
    model: 'global-model',
    reasoning: 'medium',
    roles: ['research=backend'],
    roleSettings: { backend: { model: 'backend-model', reasoning: 'high' } },
  });
  await runFactory(root);
  let request = JSON.parse(await readFile(path.join(root, '.foundry/state/factory/last-provider-request.json'), 'utf8')) as JsonRecord;
  assert.equal(request.model, 'backend-model');
  assert.equal(request.reasoning, 'high');
  await runFactory(root);
  request = JSON.parse(await readFile(path.join(root, '.foundry/state/factory/last-provider-request.json'), 'utf8')) as JsonRecord;
  assert.equal(request.model, 'global-model');
  assert.equal(request.reasoning, 'medium');
});

test('role settings require known roles and adapter selection capabilities', async () => {
  const root = await project();
  await initFactory(root, {
    name: 'Role validation',
    idea: 'Reject unavailable role preferences.',
    adapter: 'fixture',
  });
  await assert.rejects(configureFactory(root, {
    roleSettings: { missing: { model: 'model-1' } },
  }), /Unknown role in role settings/);
  const providerConfigPath = path.join(root, '.foundry/providers.json');
  const providerConfig = JSON.parse(await readFile(providerConfigPath, 'utf8')) as { adapters: Array<JsonRecord> };
  for (const adapter of providerConfig.adapters) {
    adapter.capabilities = (adapter.capabilities as string[]).filter((item) => item !== 'model_selection');
  }
  await writeFile(providerConfigPath, JSON.stringify(providerConfig));
  await assert.rejects(configureFactory(root, {
    roleSettings: { backend: { model: 'model-1' } },
  }), /Adapter lacks model_selection capability/);
});

test('older Factory controller state defaults missing role settings to an empty map', async () => {
  const root = await project();
  await initFactory(root, {
    name: 'Backward-compatible role settings',
    idea: 'Preserve a controller written before role settings.',
    adapter: 'fixture',
  });
  const statePath = path.join(root, '.foundry/state/factory/controller.json');
  const stored = JSON.parse(await readFile(statePath, 'utf8')) as JsonRecord;
  delete stored.role_settings;
  await writeFile(statePath, JSON.stringify(stored));
  assert.deepEqual((await readFactoryState(root))?.role_settings, {});
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

test('the public CLI exposes one terminal surface and rejects legacy routes', async () => {
  const help = spawnSync(process.execPath, ['dist/runtime/foundry.cjs', '--help'], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /foundry work start/);
  assert.match(help.stdout, /foundry provider run/);
  const initialized = spawnSync(process.execPath, [
    'dist/runtime/foundry.cjs', 'factory',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(initialized.status, 2);
  assert.match(initialized.stderr, /Unknown command factory/);
});

test('preseeded Build task titles still receive the required bootstrap instructions', async () => {
  const root = await project();
  await advanceToBuild(root, 'Preseeded tasks');
  await writeFile(path.join(root, 'docs/product/tasks.md'), '- [ ] Implement the preseeded behavior\n');
  const result = await runFactory(root);
  assert.equal(result.stage, 'verify');
  assert.match(await readFile(path.join(root, 'src/product.js'), 'utf8'), /verified local feature/);
  assert.equal(JSON.parse(await readFile(path.join(root, 'docs/product/checks.json'), 'utf8')).criteria[0].id, 'AC-001');
});

test('Build freezes only exact mapped checks and rejects invalid bootstrap mapping before verification', async (t) => {
  await t.test('unrelated required check may omit the Plan input', async () => {
    const root = await project('extra-required-check');
    await advanceToBuild(root, 'Additional required check');
    const state = await runFactory(root);
    assert.equal(state.stage, 'verify');
    assert.equal(state.workflow_criteria[0]?.check_name, 'behavior');
    assert.deepEqual(state.workflow_criteria[0]?.check_inputs, ['docs/specs/product.md', 'src/product.js']);
  });
  await t.test('mapping must cover the approved Plan ID', async () => {
    const root = await project('bad-mapping');
    await advanceToBuild(root, 'Invalid mapping');
    await assert.rejects(runFactory(root), /map each approved criterion exactly once/);
    const state = await readFactoryState(root);
    assert.equal(state?.stage, 'build');
    assert.equal(state?.workflow_criteria.length, 0);
    assert.notEqual(state?.build_tasks[0]?.status, 'done');
  });
});

test('installed single-bin runtime bootstraps and ships two product-changing tasks', async () => {
  const providerWorkspace = await project();
  const installParent = await mkdtemp(path.join(os.tmpdir(), 'foundry-installed-factory-'));
  const root = path.join(installParent, 'framework');
  await installWorkspace(process.cwd(), root);
  const installedProject = JSON.parse(await readFile(path.join(root, '.foundry/project.json'), 'utf8')) as JsonRecord;
  assert.deepEqual(installedProject.checks, []);
  assert.ok((await readFile(path.join(root, '.foundry/runtime/foundry.cjs'))).length > 0);
  const roles = JSON.parse(await readFile(path.join(root, '.foundry/roles.json'), 'utf8')) as JsonRecord;
  assert.ok((roles.roles as JsonRecord[]).some((role) => role.name === 'quality-gate' && role.sandbox === 'read-only'));
  await writeFile(
    path.join(root, '.foundry/providers.json'),
    await readFile(path.join(providerWorkspace, '.foundry/providers.json')),
  );
  const products = path.join(installParent, 'products');
  const cli = path.join(root, '.foundry/runtime/foundry.cjs');
  const invoke = (...args: string[]): JsonRecord => {
    const result = spawnSync(process.execPath, [cli, ...args, '--products-dir', products, '--json'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, FOUNDRY_SOURCE_ROOT: root },
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout) as JsonRecord;
  };
  const createdProject = invoke('new', 'Installed journey', '--idea', 'Create two verified local behaviors.', '--adapter', 'fixture');
  const identifier = String(createdProject.id);
  const workspaceRoot = String(createdProject.path);
  invoke('run', identifier);
  invoke('run', identifier);
  const plan = invoke('review', identifier);
  invoke('approve', identifier, '--revision', String(plan.revision));
  invoke('run', identifier);
  const design = invoke('review', identifier);
  invoke('approve', identifier, '--revision', String(design.revision));
  const built = invoke('run', identifier);
  assert.equal(built.stage, 'verify');
  const first = await readFile(path.join(workspaceRoot, 'src/product.js'), 'utf8');
  const second = await readFile(path.join(workspaceRoot, 'src/second.js'), 'utf8');
  assert.match(first, /verified local feature/);
  assert.match(second, /verified second behavior/);
  invoke('run', identifier);
  const completed = invoke('run', identifier);
  assert.equal(completed.status, 'completed');
  await assert.rejects(configureFactory(workspaceRoot, { model: 'replacement' }), /Completed Factory work cannot be reconfigured/);
  assert.equal(JSON.parse(await readFile(path.join(workspaceRoot, '.foundry/project.json'), 'utf8')).checks.length, 1);
  assert.ok(await readFactoryState(workspaceRoot));
});
