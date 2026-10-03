// Exercise the actual UI + HTTP + Factory lifecycle with bounded local doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.MARKETCRAFT_PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const suppliedFixture = process.env.FOUNDRY_BROWSER_FIXTURE_DIR;
const temp = suppliedFixture ? path.resolve(suppliedFixture) : fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'foundry-browser-'));
fs.mkdirSync(temp, {recursive:true});
const python = process.env.FOUNDRY_PYTHON || path.join(root, '.venv/bin/python');
const source = `
import json, sys
from pathlib import Path
from scripts.factory_ui import Service, make_server
sys.path.insert(0, 'tests')
from test_factory import FAKE

base = Path(sys.argv[1]).resolve()
fake = base / 'fake.py'
control = r'''
slow_once = root / "SLOW_PROVIDER_ONCE"
if slow_once.exists():
    slow_once.unlink()
    import time
    print(json.dumps({"type": "session.started", "session_id": "fixture-slow-session"}), flush=True)
    time.sleep(20)
'''
fake.write_text(FAKE.replace('root = Path.cwd()\\n', 'root = Path.cwd()\\n' + control).replace('"session_id": "fixture-session"', '"session_id": request.get("session_id") or "fixture-session"'))

class FakeAuth:
    connected = False
    @classmethod
    def status(cls, state_dir):
        return {"connected": cls.connected, "sharing": cls.connected,
                "email": "fixture@example.test" if cls.connected else None}
    @classmethod
    def sign_in(cls, state_dir):
        cls.connected = True
        return cls.status(state_dir)
    @classmethod
    def sign_out(cls, state_dir):
        cls.connected = False
        return cls.status(state_dir)
    @classmethod
    def models(cls, state_dir):
        return [{"id": "fixture-model", "slug": "fixture-model", "display_name": "Fixture model"}]
    @classmethod
    def access_token(cls, state_dir):
        if not cls.connected:
            raise RuntimeError("ChatGPT sign-in is required")
        raise RuntimeError("The browser fixture never supplies a live access token")

class FixtureService(Service):
    def auth(self):
        return FakeAuth
    def snapshot(self):
        result = super().snapshot()
        providers = list(result.get('providers') or [])
        if not any((item if isinstance(item, str) else item.get('name')) == 'fixture-error' for item in providers):
            providers.append({'name': 'fixture-error'})
        result['providers'] = providers
        for providers in result.get('project_providers', {}).values():
            providers.append({'name': 'fixture-error'})
        return result
    def dispatch(self, action, data):
        if action == 'configure' and data.get('adapter') == 'fixture-error':
            raise ValueError('Fixture runtime rejected these settings')
        if action == 'control':
            project = next((item for item in self.factory.snapshot()['projects'] if item['id'] == data.get('id')), None)
            if not project:
                raise ValueError('Unknown fixture product')
            if data.get('op') == 'marker':
                name = data.get('name')
                if name not in {'SLOW_PROVIDER_ONCE', 'NO_CHECKS'}:
                    raise ValueError('Unknown fixture marker')
                marker = Path(project['path']) / name
                if data.get('present', True):
                    marker.write_text('fixture control')
                else:
                    marker.unlink(missing_ok=True)
                return {'ok': True}
            if data.get('op') == 'approve':
                return self.factory.approve(project['id'])
            if data.get('op') == 'append_artifact':
                target = (Path(project['path']) / data.get('path', '')).resolve()
                docs = (Path(project['path']) / 'docs').resolve()
                if docs not in target.parents or not target.is_file():
                    raise ValueError('Fixture artifact must be an existing document')
                with target.open('a') as handle:
                    handle.write(str(data.get('text', '\\nFixture review change.\\n')))
                return {'ok': True}
            raise ValueError('Unknown fixture control')
        result = super().dispatch(action, data)
        if action == 'create':
            project = Path(result['path'])
            (project / '.foundry/providers.json').write_text(json.dumps({'adapters': [{
                'name': 'fixture', 'kind': 'agent-runtime', 'command': [sys.executable, str(fake)],
                'capabilities': ['jsonl', 'cancel', 'permissions', 'resume', 'tools'], 'billing_modes': ['local']
            }]}))
            result = self.factory.configure(result['id'], adapter='fixture')
        return result

service = FixtureService(products_dir=base / 'products', data_dir=base / 'data')
server = make_server(service)
print('http://127.0.0.1:' + str(server.server_port), flush=True)
server.serve_forever()
`;

const server = spawn(python, ['-u', '-c', source, temp], {cwd:root, stdio:['ignore', 'pipe', 'pipe']});
let browser, page, diagnostics = '';
const pendingRequests = new Set();
server.stderr.on('data', chunk => { diagnostics += chunk; });

async function control(page, data) {
  return page.evaluate(async payload => {
    const response = await fetch('/api/control', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'X-Foundry-Token':document.querySelector('meta[name="foundry-token"]').content},
      body: JSON.stringify(payload)
    });
    const value = await response.json();
    if (!response.ok) throw Error(value.error);
    return value;
  }, data);
}

async function assertNoOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} layout overflows`);
}

(async () => {
  try {
    const url = await new Promise((resolve, reject) => {
      let data = '';
      server.stdout.on('data', chunk => { data += chunk; if (data.includes('\n')) resolve(data.trim().split('\n')[0]); });
      server.once('exit', code => reject(Error(`Server stopped ${code}: ${diagnostics}`)));
      setTimeout(() => reject(Error(`Server startup timed out: ${diagnostics}`)), 20000).unref();
    });
    browser = await chromium.launch({headless:true, ...(process.env.MARKETCRAFT_BROWSER_EXECUTABLE ? {executablePath:process.env.MARKETCRAFT_BROWSER_EXECUTABLE} : {})});
    page = await browser.newPage({viewport:{width:1380, height:950}});
    await page.addInitScript(() => {
      window.__foundryCspViolations=[];
      document.addEventListener('securitypolicyviolation', event => window.__foundryCspViolations.push(event.effectiveDirective));
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if(request.url().includes('/api/')) pendingRequests.add(request); });
    page.on('requestfinished', request => pendingRequests.delete(request));
    page.on('requestfailed', request => pendingRequests.delete(request));
    // Slow transports must deliver initial state even beyond the two-second poll cadence.
    let initialSnapshots=0;
    const slowInitial=async route=>{
      initialSnapshots++;
      const response=await route.fetch();
      await new Promise(resolve=>setTimeout(resolve,2600));
      await route.fulfill({response});
    };
    await page.route('**/api/snapshot',slowInitial);
    await page.goto(url);
    // Standalone entry is the real landing; the embedded panel opens the workspace directly.
    await page.getByRole('heading', {name:'A good idea. A clear way to build it.', exact:true}).waitFor();
    await page.getByRole('tab', {name:'03 Design', exact:true}).click();
    await page.getByRole('heading', {name:'Give the idea a clear shape.', exact:true}).waitFor();
    await page.getByRole('button', {name:'Open workspace', exact:true}).first().click();

    await page.getByRole('button',{name:'Create product',exact:true}).waitFor({timeout:10000});
    await page.unroute('**/api/snapshot',slowInitial);
    assert.equal(initialSnapshots,1,'Periodic snapshots overlapped on a slow connection');

    // The shared Soft studio system is local, including its font and portraits.
    await page.locator('#mobile-menu').click();
    await page.getByRole('button', {name:'About Foundry', exact:true}).click();
    await page.getByRole('heading', {name:'A good idea. A clear way to build it.', exact:true}).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Manrope/);
    assert.equal(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Manrope' && font.status === 'loaded')), true);
    assert.ok(await page.locator('img.role-avatar').count() > 0, 'Requested specialist portraits are missing');
    assert.equal(await page.locator('.role-avatar svg').count(), 0, 'Role glyph replacement is still rendered');
    await page.getByText('Plan review · example', {exact:true}).waitFor();
    for (const width of [1280, 768, 390, 360]) {
      await page.setViewportSize({width, height:900});
      await assertNoOverflow(page, `Introduction ${width}px`);
    }
    await page.setViewportSize({width:1280,height:900});
    await page.getByRole('button', {name:'Meet all 28 roles', exact:true}).click();
    assert.equal(await page.locator('.landing-role:visible').count(), 28);
    await page.getByRole('button', {name:'Show fewer roles', exact:true}).click();
    await page.getByRole('button', {name:'Open workspace', exact:true}).first().click();
    await page.getByRole('button', {name:'Create product', exact:true}).waitFor();

    // Account controls are available before a product exists, without live credentials.
    await page.locator('#account-button').click();
    assert.equal(await page.getByRole('tab', {name:'AI', exact:true}).isHidden(), true);
    await page.getByRole('button', {name:'Continue with ChatGPT', exact:true}).click();
    await page.getByText(/fixture@example\.test.*plan usage enabled/).waitFor({timeout:10000});
    await page.getByRole('button', {name:'Sign out', exact:true}).click();
    await page.getByText('Not connected to Foundry', {exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.id === 'account-button');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'account-button', 'Settings Escape did not restore focus');

    // Example actions fill the real composer and create a real product workspace.
    await page.getByRole('button', {name:'Client portal', exact:true}).click();
    assert.equal(await page.getByLabel('Name', {exact:true}).inputValue(), 'Client portal');
    assert.match(await page.getByLabel('Describe your idea').inputValue(), /approve deliverables/);
    await page.getByLabel('Name', {exact:true}).fill('Recovery workspace');
    await page.getByLabel('Describe your idea').fill('Help a studio owner keep evidence-backed client decisions and release notes in one local workspace.');
    await page.getByRole('button', {name:'Create product', exact:true}).click();
    await page.getByRole('heading', {name:'Recovery workspace', exact:true}).waitFor();
    const recoveryId = await page.evaluate(async () => {
      const response = await fetch('/api/snapshot', {headers:{'X-Foundry-Token':document.querySelector('meta[name="foundry-token"]').content}});
      return (await response.json()).projects.find(item => item.name === 'Recovery workspace').id;
    });
    await page.locator('#settings-button').click();
    await page.getByRole('tab', {name:'AI', exact:true}).click();
    await page.getByLabel('AI engine').selectOption('chatgpt');
    await page.getByRole('button', {name:'Save settings', exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.getByRole('button', {name:'Start Research', exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#notice[role="alert"]')?.textContent.includes('ChatGPT sign-in is required'));
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    assert.equal(await page.getByRole('button', {name:'Start Research', exact:true}).isEnabled(), true);
    assert.doesNotMatch(await page.locator('#notice').textContent(), /Foundry is working/);
    await page.waitForTimeout(4200);
    assert.match(await page.locator('#notice').textContent(), /ChatGPT sign-in is required/);
    await page.getByRole('button', {name:'Start Research', exact:true}).click();
    await page.waitForTimeout(4200);
    assert.match(await page.locator('#notice').textContent(), /ChatGPT sign-in is required/, 'Repeated identical preflight failure lost the error');
    assert.doesNotMatch(await page.locator('#notice').textContent(), /working|Trying again/);
    await page.locator('#settings-button').click();
    await page.getByRole('tab', {name:'AI', exact:true}).click();
    await page.getByLabel('AI engine').selectOption('fixture');
    await page.getByRole('button', {name:'Save settings', exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.getByRole('button', {name:'Start Research', exact:true}).click();
    await page.getByRole('button', {name:'Review Plan', exact:true}).waitFor({timeout:30000});
    assert.equal(await page.locator('#notice').count(), 0, 'Explicit retry retained the prior preflight error');

    // Stage inspection is navigation only: it cannot advance or approve the workflow.
    const stageRail = page.getByRole('list', {name:'Product stages'});
    assert.equal(await stageRail.getByRole('button').count(), 6);
    assert.equal(await stageRail.locator('[aria-current="step"]').textContent(), '2PlanYour review');
    await stageRail.getByRole('button', {name:'Design Coming up', exact:true}).click();
    await page.getByRole('heading', {name:'Shape how it works', exact:true}).waitFor();
    assert.equal(await page.locator('#stage-work-panel #actions button').count(), 0, 'Future stage offered execution');
    assert.match(await page.locator('#owner-guidance').textContent(), /Nothing here yet/);
    assert.equal(await stageRail.locator('[aria-current="step"]').getAttribute('aria-pressed'), 'false');
    await stageRail.getByRole('button', {name:'Research Done', exact:true}).click();
    await page.locator('#stage-work-panel #actions').getByRole('button', {name:'Open Research', exact:true}).click();
    await page.locator('#artifact-content').waitFor();
    assert.equal(await page.locator('#artifact-approve').count(), 0, 'Past stage offered approval');
    await page.getByRole('button', {name:'Close document'}).click();
    await page.locator('#artifact').waitFor({state:'detached'});
    await stageRail.getByRole('button', {name:'Research Done', exact:true}).click();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-current')), 'step');
    await page.keyboard.press('Enter');
    await page.getByRole('button', {name:'Review Plan', exact:true}).waitFor();
    const keyboardFocus = await stageRail.locator('[aria-current="step"]').evaluate(el => ({visible:el.matches(':focus-visible'), outline:getComputedStyle(el).outlineWidth}));
    assert.deepEqual(keyboardFocus, {visible:true, outline:'2px'});
    await page.locator('#stage-title').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#stages [aria-pressed="true"]')).backgroundColor === 'rgb(255, 254, 250)');
    const selection = await stageRail.locator('[aria-pressed="true"]').evaluate(el => {
      const style=getComputedStyle(el);
      return {height:el.getBoundingClientRect().height, background:style.backgroundColor, border:style.borderBottomWidth, shadow:style.boxShadow, focus:el.matches(':focus-visible'), before:getComputedStyle(el,'::before').content, after:getComputedStyle(el,'::after').content};
    });
    assert.deepEqual(selection, {height:66, background:'rgb(255, 254, 250)', border:'2px', shadow:'none', focus:false, before:'none', after:'none'}, 'Stage selection differs from the Soft studio underline-selection contract');
    assert.equal(await page.locator('#stage-work-panel .surface').count(), 0, 'Work panel contains nested cards');
    assert.equal(await page.locator('.page-tabs').evaluate(el => el.scrollHeight <= el.clientHeight), true, 'Product tabs have an unnecessary vertical scrollbar');

    // A pending review also belongs to its visible stage and product tab.
    for (const navigation of ['stage','tab']) {
      await page.locator('.preview-reading').waitFor();
      let releaseDocument, documentStarted, documentFinished;
      const gate=new Promise(resolve=>{releaseDocument=resolve;});
      const started=new Promise(resolve=>{documentStarted=resolve;});
      const finished=new Promise(resolve=>{documentFinished=resolve;});
      await page.route('**/api/artifact?*',async route=>{
        const response=await route.fetch();documentStarted();await gate;
        await route.fulfill({response});documentFinished();
      },{times:1});
      await page.getByRole('button',{name:'Review Plan',exact:true}).click();
      await started;
      if(navigation==='stage') await stageRail.getByRole('button',{name:'Design Coming up',exact:true}).click();
      else await page.getByRole('tab',{name:/Documents/}).click();
      releaseDocument();await finished;
      await page.waitForFunction(()=>document.getElementById('main').getAttribute('aria-busy')==='false');
      assert.equal(await page.locator('#artifact').count(),0,`Delayed review reopened after ${navigation} navigation`);
      await page.getByRole('tab',{name:'Work',exact:true}).click();
      if(navigation==='stage') await page.getByRole('button',{name:'Back to Plan',exact:true}).click();
      await page.getByRole('button',{name:'Review Plan',exact:true}).waitFor();
    }

    // Identical two-second polls keep keyboard focus and home/recent navigation works.
    await page.getByRole('button', {name:'Settings', exact:true}).focus();
    await page.waitForTimeout(2300);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'settings-button', 'Polling replaced the focused control');
    await page.locator('#home-button').click();
    await page.getByText('How Foundry works', {exact:true}).click();
    await page.getByText('Publishing is always your call.', {exact:false}).waitFor();
    await page.locator('#recent-products').getByRole('button', {name:/Recovery workspace/}).click();
    assert.equal(await page.locator('#heading').textContent(), 'Recovery workspace');

    // A delayed document cannot reopen after Home or browser history navigation.
    for (const navigation of ['home', 'back']) {
      await page.locator('.preview-reading').waitFor();
      let releaseDocument, documentStarted, documentFinished;
      const gate = new Promise(resolve => { releaseDocument=resolve; });
      const started = new Promise(resolve => { documentStarted=resolve; });
      const finished = new Promise(resolve => { documentFinished=resolve; });
      await page.route('**/api/artifact?*', async route => {
        const response=await route.fetch(); documentStarted(); await gate;
        await route.fulfill({response}); documentFinished();
      }, {times:1});
      await page.getByRole('button', {name:'Review Plan', exact:true}).click();
      await started;
      if (navigation==='home') await page.locator('#home-button').click();
      else await page.goBack();
      await page.getByRole('heading', {name:'What do you want to build?', exact:true}).waitFor();
      releaseDocument(); await finished;
      await page.getByRole('button', {name:'Create product', exact:true}).waitFor();
      await page.waitForFunction(() => document.getElementById('main').getAttribute('aria-busy') === 'false');
      assert.equal(await page.locator('#artifact').count(), 0, `Delayed review reopened after ${navigation}`);
      await page.waitForFunction(() => document.activeElement?.id==='heading');
      await page.locator('#recent-products').getByRole('button', {name:/Recovery workspace/}).click();
      await page.waitForFunction(() => document.activeElement?.id==='heading');
    }

    // Document rendering is sanitized; Escape and stale approvals are safe.
    fs.appendFileSync(path.join(temp, 'products/recovery-workspace/docs/specs/product.md'), '\n\n<img src=x onerror="window.__unsafe=1">\n<script>window.__unsafe=2</script>\n[Unsafe](javascript:alert(1))\n');
    await page.getByRole('button', {name:'Review Plan', exact:true}).click();
    await page.locator('#artifact-content').filter({hasText:'Acceptance criteria'}).waitFor();
    assert.equal(await page.locator('#artifact-content img, #artifact-content script').count(), 0);
    assert.equal(await page.locator('#artifact-content a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.__unsafe), undefined);
    // Approval is bound to the exact reviewed bytes, even when stage/status stay unchanged.
    await control(page, {op:'append_artifact', id:recoveryId, path:'docs/specs/product.md', text:'\n\nOwner-visible scope clarification added after the review opened.\n'});
    await page.getByRole('button', {name:'Approve and continue', exact:true}).click();
    await page.locator('#artifact-notice:visible').waitFor();
    assert.equal(await page.locator('#stage-caption').textContent(), 'Step 2 · Plan');
    assert.equal(await page.locator('#artifact').isVisible(), true, 'Changed artifact closed instead of requiring review');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Review Plan'));
    await page.getByRole('button', {name:'Review Plan', exact:true}).click();
    await control(page, {op:'approve', id:recoveryId});
    await page.locator('#stage-caption').filter({hasText:'Step 3 · Design'}).waitFor({timeout:10000});
    await page.getByRole('button', {name:'Approve and continue', exact:true}).click();
    await page.getByText('This review is no longer current.', {exact:false}).waitFor();
    await page.getByRole('button', {name:'Start Design', exact:true}).click();
    await page.getByRole('button', {name:'Review Design', exact:true}).waitFor({timeout:30000});
    await page.locator('#notice:not(.error)').waitFor({state:'detached'});
    await page.getByRole('button', {name:'Review Design', exact:true}).click();
    await page.route('**/api/run', route => route.fulfill({status:503, contentType:'application/json', body:JSON.stringify({error:'Fixture could not start the next stage'})}), {times:1});
    await page.getByRole('button', {name:'Approve and continue', exact:true}).click();
    await page.getByText('Approved, but the next step could not start:', {exact:false}).waitFor();
    await page.locator('#artifact').waitFor({state:'hidden'});
    assert.equal(await page.locator('#artifact').isVisible(), false, 'Successful approval left a stale review dialog open');
    await page.locator('#stage-caption').filter({hasText:'Step 4 · Build'}).waitFor();
    await control(page, {op:'marker', id:recoveryId, name:'NO_CHECKS'});
    await page.getByRole('button', {name:'Start Build', exact:true}).click();
    await page.getByRole('button', {name:'Try again', exact:true}).waitFor({timeout:30000});
    assert.ok((await page.locator('#progress').textContent()).trim(), 'Build integration failure was not explained');
    await control(page, {op:'marker', id:recoveryId, name:'NO_CHECKS', present:false});
    await page.getByRole('button', {name:'Try again', exact:true}).click();
    await page.locator('#outputs').filter({hasText:'docs/product/release.md'}).waitFor({timeout:45000});
    assert.equal(await page.locator('#status').textContent(), 'Completed');
    await page.locator('#notice:not(.error)').waitFor({state:'detached'});
    assert.equal(await page.locator('#completed-count').textContent(), '6 of 6 done');
    await page.getByRole('tab', {name:/Documents/}).click();
    await page.locator('#outputs').filter({hasText:'docs/product/release.md'}).waitFor();
    await page.getByRole('tab', {name:/Activity/}).click();
    assert.ok(await page.locator('#activity li').count(), 'Completed product did not expose its activity history');
    await page.getByRole('tab', {name:'Work', exact:true}).click();
    const checkpointResponse = async route => {
      const response = await route.fetch();
      const snapshot = await response.json();
      const project = snapshot.projects.find(item => item.id === recoveryId);
      project.stage = 'build';
      project.status = 'failed';
      project.stage_verification.build.status = 'checkpoint_failed';
      project.stage_verification.build.tasks = project.stage_verification.build.tasks.map(task =>
        ({...task, status:'failed', checks:'passed', fix_attempts:1}));
      await route.fulfill({response, json:snapshot});
    };
    await page.route('**/api/snapshot', checkpointResponse);
    await page.locator('#build-tasks').filter({hasText:'Tests pass · could not save this step in Git'}).waitFor();
    assert.doesNotMatch(await page.locator('#build-tasks').textContent(), /Tests still failing/);
    assert.match(await page.locator('#build-tasks').textContent(), /0 of 1 done/);
    await page.unroute('**/api/snapshot', checkpointResponse);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'Completed');
    await page.getByRole('list', {name:'Product stages'}).getByRole('button', {name:'Build Done', exact:true}).click();
    await page.locator('#build-tasks').filter({hasText:'Build the approved plan'}).waitFor();
    assert.match(await page.locator('#build-tasks').textContent(), /1 of 1 done/);
    await page.getByRole('button', {name:'Back to Ship', exact:true}).click();
    await page.getByRole('button', {name:'Read the ship summary', exact:true}).click();
    await page.locator('#artifact-content').filter({hasText:'Publication and deployment are not authorized'}).waitFor();
    await page.getByRole('button', {name:'Close document'}).click();
    await page.getByRole('button', {name:'Open Research', exact:true}).click();
    await page.locator('#artifact-content').filter({hasText:'fixture URL is only a reference'}).waitFor();
    await page.getByRole('button', {name:'Close document'}).click();

    // Runtime and one specialist persist, a failed save keeps values, and blanks restore inheritance.
    await page.getByRole('button', {name:'Settings', exact:true}).click();
    await page.getByRole('tab', {name:'AI', exact:true}).click();
    await page.getByLabel('Model', {exact:true}).fill('owner-selected-model');
    await page.getByLabel('Reasoning', {exact:true}).selectOption('high');
    await page.locator('#adapter').selectOption('fixture-error');
    await page.getByRole('button', {name:'Save settings', exact:true}).click();
    await page.locator('#settings-notice:visible').waitFor();
    assert.equal(await page.getByLabel('Model', {exact:true}).inputValue(), 'owner-selected-model');
    await page.locator('#adapter').selectOption('fixture');
    await page.getByRole('tab', {name:'Roles', exact:true}).click();
    const roleRows = page.locator('.role-row');
    const allRoleCount = await roleRows.count();
    await page.getByLabel('Find a role').fill('backend');
    const visibleRoleCount = await page.locator('.role-row:visible').count();
    assert.ok(visibleRoleCount > 0 && visibleRoleCount < allRoleCount, 'Specialist search did not filter');
    await page.getByLabel('Backend', {exact:true}).fill('backend-specialist-model');
    await page.getByLabel('Backend reasoning', {exact:true}).selectOption('medium');
    await page.getByRole('button', {name:'Save settings', exact:true}).click();
    await page.getByText('Settings saved.').waitFor();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.getByRole('button', {name:'Settings', exact:true}).click();
    await page.getByRole('tab', {name:'AI', exact:true}).click();
    assert.equal(await page.getByLabel('Model', {exact:true}).inputValue(), 'owner-selected-model');
    assert.equal(await page.getByLabel('Reasoning', {exact:true}).inputValue(), 'high');
    await page.getByRole('tab', {name:'Roles', exact:true}).click();
    assert.equal(await page.getByLabel('Backend', {exact:true}).inputValue(), 'backend-specialist-model');
    await page.getByLabel('Backend', {exact:true}).fill('');
    await page.getByLabel('Backend reasoning', {exact:true}).selectOption('');
    await page.getByRole('tab', {name:'AI', exact:true}).click();
    await page.getByLabel('Model', {exact:true}).fill('');
    await page.getByLabel('Reasoning', {exact:true}).selectOption('');
    await page.getByRole('button', {name:'Save settings', exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.getByRole('button', {name:'Settings', exact:true}).click();
    await page.getByRole('tab', {name:'AI', exact:true}).click();
    assert.equal(await page.getByLabel('Model', {exact:true}).inputValue(), '');
    await page.getByRole('tab', {name:'Roles', exact:true}).click();
    assert.equal(await page.getByLabel('Backend', {exact:true}).inputValue(), '');
    await page.getByRole('button', {name:'Close settings'}).click();

    // A second product proves stop/interrupted/retry and account switching is blocked while running.
    await page.locator('#new-product').click();
    await page.getByLabel('Name', {exact:true}).fill('Pause recovery');
    await page.getByLabel('Describe your idea').fill('Prepare a reviewed incident brief while letting the owner stop and safely resume long-running work.');
    assert.equal(await page.getByLabel('Name', {exact:true}).inputValue(), 'Pause recovery', 'Navigation stole focus while entering the brief');
    assert.equal(await page.getByLabel('Describe your idea').inputValue(), 'Prepare a reviewed incident brief while letting the owner stop and safely resume long-running work.');
    // Hold an older polling snapshot until after creation has returned fresh state.
    let releaseSnapshot, snapshotStarted, snapshotFinished;
    const snapshotGate=new Promise(resolve=>{releaseSnapshot=resolve;});
    const snapshotPending=new Promise(resolve=>{snapshotStarted=resolve;});
    const snapshotDone=new Promise(resolve=>{snapshotFinished=resolve;});
    let snapshotHeld=false;
    const holdSnapshot=async route=>{
      if(snapshotHeld) return route.continue();
      snapshotHeld=true;
      const response=await route.fetch(); snapshotStarted(); await snapshotGate;
      await route.fulfill({response}); snapshotFinished();
    };
    await page.route('**/api/snapshot',holdSnapshot);
    await snapshotPending;
    let createRequests=0;
    const countCreate=request=>{if(request.method()==='POST'&&request.url().endsWith('/api/create')) createRequests++;};
    page.on('request',countCreate);
    await page.route('**/api/create',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.continue();},{times:1});
    await page.getByRole('button', {name:'Create product', exact:true}).click();
    await page.getByRole('button', {name:'Create product', exact:true}).evaluate(button=>button.click());
    await page.getByRole('heading', {name:'Pause recovery', exact:true}).waitFor();
    releaseSnapshot(); await snapshotDone;
    await page.unroute('**/api/snapshot',holdSnapshot);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#heading').textContent(),'Pause recovery','An old poll replaced the newly created product');
    assert.equal(createRequests,1,'Repeated create dispatched more than once');
    page.off('request',countCreate);
    const pauseId = await page.evaluate(async () => {
      const response = await fetch('/api/snapshot', {headers:{'X-Foundry-Token':document.querySelector('meta[name="foundry-token"]').content}});
      return (await response.json()).projects.find(item => item.name === 'Pause recovery').id;
    });
    await control(page, {op:'marker', id:pauseId, name:'SLOW_PROVIDER_ONCE'});
    await page.getByRole('button', {name:'Start Research', exact:true}).click();
    await page.getByRole('button', {name:'Stop', exact:true}).waitFor();
    await page.waitForTimeout(700);
    await page.getByRole('button', {name:'Settings', exact:true}).click();
    await page.getByRole('tab', {name:'Account', exact:true}).click();
    await page.getByRole('button', {name:'Continue with ChatGPT', exact:true}).click();
    await page.locator('#settings-notice:visible').filter({hasText:'Stop running jobs'}).waitFor();
    await page.getByRole('button', {name:'Close settings'}).click();
    await page.getByRole('button', {name:'Stop', exact:true}).click();
    await page.getByRole('button', {name:'Try again', exact:true}).waitFor({timeout:20000});
    await page.getByRole('button', {name:'Try again', exact:true}).click();
    await page.getByRole('button', {name:'Review Plan', exact:true}).waitFor({timeout:30000});
    await page.locator('#product-drawer[data-state="closed"]').waitFor({state:'detached'});
    if(!await page.locator('#products').isVisible()) await page.locator('#mobile-menu').click();
    await page.locator('#products').getByRole('button', {name:'Recovery workspace', exact:true}).click();
    await page.locator('#product-drawer').waitFor({state:'detached'});
    assert.equal(await page.locator('#status').textContent(), 'Completed');
    await page.locator('#product-drawer[data-state="closed"]').waitFor({state:'detached'});
    if(!await page.locator('#products').isVisible()) await page.locator('#mobile-menu').click();
    await page.locator('#products').getByRole('button', {name:'Pause recovery', exact:true}).click();
    await page.locator('#product-drawer').waitFor({state:'detached'});
    assert.equal(await page.locator('#stage-caption').textContent(), 'Step 2 · Plan');

    // Desktop, tablet, mobile, and narrow embedded-panel widths remain operable.
    const output = path.join(root, 'output/playwright');
    fs.mkdirSync(output, {recursive:true});
    await page.locator('#product-drawer[data-state="closed"]').waitFor({state:'detached'});
    if(!await page.locator('#products').isVisible()) await page.locator('#mobile-menu').click();
    await page.locator('#products').getByRole('button', {name:'Recovery workspace', exact:true}).click();
    await page.locator('#product-drawer').waitFor({state:'detached'});
    await control(page, {op:'append_artifact', id:recoveryId, path:'docs/product/research.md', text:'\n\n## Extended fixture evidence\n' + 'A reviewed local fixture observation keeps the document reader scrollable without representing live research.\n\n'.repeat(30)});
    await page.screenshot({path:path.join(output, 'factory-desktop.png'), fullPage:true});
    for (const [width, height, label] of [[1024,900,'Tablet landscape'], [900,800,'Tablet'], [768,1024,'Tablet portrait'], [480,800,'MCP panel'], [390,844,'Mobile'], [360,760,'Narrow panel']]) {
      await page.setViewportSize({width, height});
      await assertNoOverflow(page, label);
      if (width <= 480) {
        const settingsTarget=await page.locator('#settings-button').boundingBox();
        assert.ok(settingsTarget.width>=44&&settingsTarget.height>=44,`${label} Settings target is too small`);
        await page.locator('#settings-button').click();
        const closeTarget=await page.getByRole('button',{name:'Close settings',exact:true}).boundingBox();
        assert.ok(closeTarget.width>=44&&closeTarget.height>=44,`${label} Close settings target is too small`);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.activeElement?.id === 'settings-button');
        const navigationTarget=await page.locator('#mobile-menu').boundingBox();
        assert.ok(navigationTarget.width>=44&&navigationTarget.height>=44,`${label} navigation target is too small`);
        const breadcrumbTarget=await page.getByRole('button',{name:'Workspace',exact:true}).boundingBox();
        assert.ok(breadcrumbTarget.height>=44,`${label} breadcrumb target is too small`);
        await page.waitForFunction(() => {
          const rail = document.getElementById('stages');
          const step = rail?.querySelector('[aria-current="step"]');
          if (!rail || !step) return false;
          const railBox = rail.getBoundingClientRect();
          const stepBox = step.getBoundingClientRect();
          return stepBox.left >= railBox.left - 1 && stepBox.right <= railBox.right + 1;
        });
        await page.getByRole('button', {name:'Open Research', exact:true}).click();
        await page.locator('#artifact-content').filter({hasText:'Extended fixture evidence'}).waitFor();
        assert.equal(await page.locator('#artifact-content').evaluate(element => element.scrollHeight > element.clientHeight), true, `${label} document did not create a scroll region`);
        assert.equal(await page.locator('.artifact-footer').evaluate(element => { const box = element.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight; }), true, `${label} review footer left the viewport`);
        await page.getByRole('button', {name:'Close document'}).click();
        await page.locator('#artifact').waitFor({state:'detached'});
        await page.evaluate(id=>{location.hash='product/'+id;},pauseId);
        await page.getByRole('button',{name:'Review Plan',exact:true}).click();
        const approval=page.locator('#artifact-approve');
        await approval.waitFor();
        assert.ok(await approval.evaluate(el=>el.scrollWidth<=el.clientWidth),`${label} approval label overflows`);
        assert.ok(await page.locator('.artifact-footer').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),`${label} approval footer is obscured`);
        await page.getByRole('button', {name:'Close document'}).click();
        await page.locator('#artifact').waitFor({state:'detached'});
        await page.evaluate(id=>{location.hash='product/'+id;},recoveryId);
        await page.getByRole('button',{name:'Read the ship summary',exact:true}).waitFor();
      }
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('color-scheme')), /light/);
    await page.getByRole('button', {name:'Your products'}).click();
    assert.equal(await page.locator('#products').count(), 1, 'Product drawer duplicated the product navigation');
    for (const target of await page.locator('.product-drawer .product-link').all()) {
      const box=await target.boundingBox();
      assert.ok(box.width>=44&&box.height>=44,'Product drawer target is too small');
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.id === 'mobile-menu');
    await page.locator('#account-button').click();
    await page.getByRole('dialog').getByRole('tab', {name:'Account', exact:true}).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 1, 'Product navigation remained open behind settings');
    await page.getByRole('button', {name:'Close settings'}).click();
    await page.waitForFunction(() => document.activeElement?.id === 'account-button');
    await page.getByRole('button', {name:'Your products'}).click();
    await page.getByRole('button', {name:'Close products'}).click();
    await page.waitForFunction(() => document.activeElement?.id === 'mobile-menu');
    await page.getByRole('button', {name:'Your products'}).click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.id === 'mobile-menu');
    await page.getByRole('button', {name:'Your products'}).click();
    const sheetBackdrop = page.locator('[data-slot="sheet-overlay"]');
    await sheetBackdrop.click({position:{x:(await sheetBackdrop.boundingBox()).width - 24, y:420}});
    await sheetBackdrop.waitFor({state:'detached'});
    await page.waitForFunction(() => document.activeElement?.id === 'mobile-menu');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'mobile-menu');
    await page.screenshot({path:path.join(output, 'factory-mobile.png'), fullPage:true});
    await page.reload();
    await page.getByRole('heading', {name:'Recovery workspace', exact:true}).waitFor();
    await page.getByRole('button', {name:'Workspace', exact:true}).click();
    await page.getByRole('heading', {name:'What do you want to build?', exact:true}).waitFor();
    await page.getByRole('button', {name:'Your products'}).click();
    if(!await page.locator('#products').isVisible()) await page.locator('#mobile-menu').click();
    await page.locator('#products').getByRole('button', {name:'Recovery workspace', exact:true}).click();

    // The same app controller routes through the MCP Apps bridge without HTTP API calls.
    const bridgeContext = await browser.newContext({viewport:{width:480, height:800}, reducedMotion:'reduce'});
    await bridgeContext.addInitScript(() => {
      const state = {schema_version:1, products_dir:'/fixture/products', projects:[], roles:[], providers:[{name:'codex'}], account:{connected:false, sharing:false}, jobs:{}};
      window.__foundryBridgeCalls = [];
      window.foundryBridgePromise = Promise.resolve({callServerTool: async request => {
        window.__foundryBridgeCalls.push(request);
        if (request.name === 'foundry_snapshot') return {structuredContent:state, content:[]};
        if (request.name === 'foundry_create') {
          const product = {id:'bridge-product', name:request.arguments.name, idea:request.arguments.idea, path:'/fixture/products/bridge-product', adapter:'codex', stage:'research', status:'completed', artifacts:[], history:[], created_at:'2026-10-02T00:00:00Z', updated_at:'2026-10-02T00:00:00Z'};
          state.projects.push(product); return {structuredContent:product, content:[]};
        }
        return {isError:true, content:[{type:'text', text:'Unexpected fixture MCP tool'}]};
      }});
    });
    const bridgePage = await bridgeContext.newPage();
    const bridgeErrors = [];
    bridgePage.on('pageerror', error => bridgeErrors.push(error.message));
    await bridgePage.goto(url);
    await bridgePage.getByRole('button', {name:'Research brief', exact:true}).click();
    await bridgePage.getByRole('button', {name:'Create product', exact:true}).click();
    await bridgePage.getByRole('heading', {name:'Research brief', exact:true}).waitFor();
    const bridgeCalls = await bridgePage.evaluate(() => window.__foundryBridgeCalls.map(call => call.name));
    assert.ok(bridgeCalls.includes('foundry_snapshot') && bridgeCalls.includes('foundry_create'));
    await assertNoOverflow(bridgePage, 'MCP bridge');
    assert.deepEqual(bridgeErrors, []);
    await bridgeContext.close();

    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.__foundryCspViolations), [], 'Dialogs or navigation violated the content security policy');
    console.log('Factory browser journey passed: account simulation, examples, two products, provider failure/retry, stop/retry, stale review defense, sanitized documents, release, settings recovery and inheritance, responsive/keyboard/reduced-motion checks, persistence, and MCP bridge routing. No live inference or credentials.');
    if (process.env.FOUNDRY_KEEP_BROWSER_FIXTURE) console.log(`Fixture preserved at ${temp}`);
  } catch (error) {
    console.error('Pending API requests:', [...pendingRequests].map(request => new URL(request.url()).pathname));
    if (page) { await page.screenshot({path:'/tmp/foundry-ui-failure.png',fullPage:true}).catch(()=>{}); console.error('UI failure state:', await page.locator('body').innerText().catch(()=>'')); }
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    if (!process.env.FOUNDRY_KEEP_BROWSER_FIXTURE && !suppliedFixture) fs.rmSync(temp, {recursive:true, force:true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
