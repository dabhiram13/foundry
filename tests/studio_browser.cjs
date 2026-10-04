// Focused checks against the real HTTP app, without AI execution or account access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-studio-'));
const server = spawn(process.env.FOUNDRY_PYTHON || path.join(root, '.venv/bin/python'), ['-u', '-c', `
import sys
from pathlib import Path
from scripts.factory_ui import Service, make_server
base = Path(sys.argv[1])
server = make_server(Service(products_dir=base / 'products', data_dir=base / 'data'), port=0)
print(server.server_address[1], flush=True)
server.serve_forever()
`, temp], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

(async () => {
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Studio server did not start')), 15000);
      server.stderr.on('data', chunk => process.stderr.write(chunk));
      server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
      server.stdout.on('data', chunk => { output += chunk; const match = output.match(/^\d+$/m); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.studioCspErrors = [];
      document.addEventListener('securitypolicyviolation', event => window.studioCspErrors.push(event.violatedDirective));
    });
    await page.goto(`http://127.0.0.1:${port}/#welcome`);
    await page.getByRole('heading', {name:/Start with an idea\.\s*Make it real\./}).waitFor();
    for (const asset of ['/assets/foundry-wordmark.svg', '/assets/inter-latin-wght-normal.woff2']) {
      assert.equal((await page.request.get(`http://127.0.0.1:${port}${asset}`)).status(), 200, `New brand asset not served: ${asset}`);
    }
    assert.equal(await page.locator('.sky-background').count(), 0, 'The retired sky must not remain behind the dark design');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');
    const mutations = [];
    page.on('request', request => { if (request.method() === 'POST') mutations.push(request.url()); });
    const walkthrough = page.getByRole('region', {name:'Terminal getting-started example'});
    await walkthrough.getByText('Example commands', {exact:true}).waitFor();
    assert.equal(await walkthrough.getByRole('tab').count(), 3, 'Terminal walkthrough must expose all three steps');
    await walkthrough.getByRole('tab', {name:'Describe it',exact:true}).focus();
    await page.keyboard.press('ArrowDown');
    await walkthrough.getByRole('heading', {name:'Read the plan. Then decide.'}).waitFor();
    await page.keyboard.press('ArrowDown');
    await walkthrough.getByRole('heading', {name:'Build it. Check it. Keep it.'}).waitFor();
    await page.keyboard.press('Home');
    await walkthrough.getByRole('heading', {name:'Your idea. A folder of its own.'}).waitFor();
    assert.deepEqual(mutations, [], 'Exploring the example must not write data or start AI');
    const install = 'git clone https://github.com/dabhiram13/foundry.git\ncd foundry\n./foundry --help';
    assert.equal(await page.getByLabel('Installation commands').textContent(), install);
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({width, height:900});
      assert.ok(await page.getByRole('button', {name:'Install Foundry', exact:true}).last().evaluate(el => el.getBoundingClientRect().height >= 48));
      assert.ok(await page.getByRole('button', {name:'Copy commands', exact:true}).evaluate(el => el.getBoundingClientRect().height >= 44));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const name of ['Describe it', 'Review it', 'Build and check']) {
        await walkthrough.getByRole('tab', {name, exact:true}).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflows at ${width}px`);
      }
    }
    await page.setViewportSize({width:1440, height:1000});
    assert.equal(await page.locator('.landing-header').getByRole('button', {name:'Projects', exact:true}).count(), 0, 'Landing header must not expose project controls');
    assert.equal(await page.locator('.landing-header').getByRole('button', {name:'Settings', exact:true}).count(), 0, 'Landing header must not expose settings controls');
    assert.equal(await page.locator('.landing-header').getByRole('button', {name:'Create product', exact:true}).count(), 0, 'Landing header must not expose product creation');
    assert.equal(await page.getByRole('button', {name:'Install Foundry', exact:true}).count(), 2);
    await page.getByRole('button', {name:'Install Foundry', exact:true}).first().click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'landing-install');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: {writeText: async text => { window.copiedInstall = text; }}
    }));
    await page.getByRole('button', {name:'Copy commands', exact:true}).click();
    await page.getByText('Copied to clipboard.', {exact:true}).waitFor({state:'attached'});
    assert.equal(await page.evaluate(() => window.copiedInstall), install);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: {writeText: async () => { throw new Error('Clipboard denied'); }}
    }));
    await page.getByRole('button', {name:'Copy commands', exact:true}).click();
    await page.getByText('Could not copy. Select and copy the text instead.', {exact:true}).waitFor();
    await page.getByRole('button', {name:'Which AI can I use?', exact:true}).click();
    await page.getByText(/Adding an API key or model URL alone is not enough/).waitFor();
    await page.getByRole('button', {name:'Does my code stay on my computer?', exact:true}).click();
    await page.getByText(/Local storage does not mean local AI processing/).waitFor();
    for (const href of await page.locator('a[href*="/blob/main/docs/"]').evaluateAll(links => links.map(link => link.href))) {
      const file = new URL(href).pathname.split('/blob/main/')[1];
      assert.ok(fs.existsSync(path.join(root, file)), `Missing documentation target: ${file}`);
    }
    await page.getByRole('button', {name:'Open local browser view', exact:true}).click();
    await page.getByLabel('Describe your idea').waitFor();
    await page.goto(`http://127.0.0.1:${port}/#workspace`);
    await page.getByRole('heading', { name: 'What do you want to build?', exact: true }).waitFor();
    await page.locator('.specialist-intro[data-playing=false]').waitFor();
    assert.equal(await page.getByRole('group', {name:'Meet the specialists'}).getByRole('button').count(), 6);
    await page.getByRole('button', { name: 'Replay intro', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    assert.equal(await page.getByRole('button', { name:'Replay intro', exact:true }).evaluate(el => el === document.activeElement), true);
    const replay = page.getByRole('button', {name:'Replay intro', exact:true});
    await replay.click();
    await page.getByRole('button', {name:'Stop', exact:true}).focus();
    await replay.waitFor();
    assert.equal(await replay.evaluate(el => el === document.activeElement), true, 'Timer expiry must preserve control focus');
    await replay.click();
    await page.getByRole('button', {name:'Stop', exact:true}).focus();
    await page.emulateMedia({reducedMotion:'reduce'});
    await replay.waitFor();
    assert.equal(await replay.evaluate(el => el === document.activeElement), true, 'Reduced motion must preserve control focus');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.specialist-intro').getAttribute('data-playing'), 'false');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await replay.click();
    await page.getByRole('button', {name:'Stop', exact:true}).focus();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await replay.waitFor();
    assert.equal(await replay.evaluate(el => el === document.activeElement), true, 'Leaving view must preserve control focus');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Planner', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('button', {name:'Planner',exact:true}).getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.radial-description').textContent(), /Keeps the first version focused/);
    await page.getByRole('switch', {name:'Quiet motion',exact:true}).click();
    await page.reload();
    await page.locator('html[data-motion=quiet]').waitFor();
    assert.equal(await page.getByRole('button', {name:'Replay intro',exact:true}).isDisabled(), true);
    await page.getByRole('switch', {name:'Quiet motion',exact:true}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('html[data-motion=quiet]').waitFor();
    assert.equal(await page.getByRole('button', {name:'Replay intro',exact:true}).isDisabled(), true);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('html[data-motion=studio]').waitFor();
    await page.getByRole('button', {name:'Client portal',exact:true}).click();
    await page.getByLabel('Name', {exact:true}).fill('Motion check');
    await page.getByRole('button', {name:'Create product',exact:true}).click();
    await page.getByRole('heading', {name:'Motion check',exact:true}).waitFor();
    await page.locator('.context-activity').getByText('Workspace created', {exact:true}).waitFor();
    assert.equal(await page.locator('.context-activity').getByText('Research · Completed', {exact:true}).count(), 0);
    await page.getByRole('tab', {name:/^Activity/}).click();
    await page.locator('#activity').getByText('Workspace created', {exact:true}).waitFor();
    await page.getByRole('tab', {name:'Work',exact:true}).click();
    assert.equal(await page.getByRole('progressbar', {name:'Progress',exact:true}).getAttribute('aria-valuenow'), '0');
    // Local suggestion fixtures exercise the picker, not account/provider access.
    await page.route('**/api/snapshot', async route => {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({response,json:{...data,account:{...data.account,sharing:true}}});
    });
    await page.route('**/api/models', route=>route.fulfill({json:[{id:'fixture-alpha'},{id:'fixture-beta'}]}));
    await page.reload();
    await page.locator('#settings-button').click();
    await page.waitForFunction(() => {
      const el = document.getElementById('settings');
      const style = el && getComputedStyle(el);
      return style && style.transform === 'none' && Number(style.opacity) === 1;
    });
    for (const tab of await page.locator('.settings-tabs [role=tab]').all()) {
      const box = await tab.boundingBox();
      assert.ok(box.width >= 43.99 && box.height >= 43.99, 'Settings tabs need usable hit targets');
    }
    assert.equal(await page.locator('.settings-tabs').evaluate(el => el.scrollHeight > el.clientHeight), false, 'Settings tabs must not have a vertical scrollbar');
    const codex = page.getByRole('radio', {name:/Codex \(your login\)/});
    await codex.click();
    const consent = page.getByRole('checkbox', {name:/Use my existing Codex subscription login/});
    assert.equal(await consent.isChecked(), false);
    await consent.focus();
    await page.keyboard.press('Space');
    assert.equal(await consent.isChecked(), true);
    await codex.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#adapter [role="radio"][value="chatgpt"]')?.getAttribute('aria-checked') === 'true');
    assert.equal(await page.getByRole('radio', {name:/ChatGPT plan/}).isChecked(), true);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('#adapter [role="radio"][value="codex"]')?.getAttribute('aria-checked') === 'true');
    assert.equal(await consent.isChecked(), false, 'Changing engines must clear consent');
    const advanced = page.getByRole('button', {name:'Model and reasoning',exact:true});
    await page.getByLabel('Model', {exact:true}).waitFor({state:'hidden'});
    await advanced.press('Enter');
    await page.getByLabel('Model', {exact:true}).waitFor();
    const model = page.getByLabel('Model', {exact:true});
    await model.fill('fixture-');
    await model.press('ArrowDown');
    await page.getByRole('option', {name:'fixture-alpha',exact:true}).waitFor();
    await model.press('Enter');
    assert.equal(await model.inputValue(), 'fixture-alpha');
    assert.equal(await page.locator('#settings').isVisible(), true, 'Choosing a model must not submit settings');
    await page.getByRole('button', {name:'Save settings',exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.locator('#settings-button').click();
    await advanced.click();
    assert.equal(await model.inputValue(), 'fixture-alpha');
    await model.fill('custom-owner-model');
    await model.press('Enter');
    assert.equal(await page.locator('#settings').isVisible(), true, 'Typing a custom model must not submit settings');
    const modelPopup = page.locator('[data-slot=model-popup]');
    await model.press('ArrowDown');
    await modelPopup.waitFor({state:'visible'});
    assert.equal(await page.locator('.model-control').first().getAttribute('data-popup-open'), 'true');
    await model.press('Escape');
    await modelPopup.waitFor({state:'detached'});
    assert.equal(await page.locator('#settings').getAttribute('data-state'), 'open', 'First Escape only closes model suggestions');
    await page.getByLabel('Reasoning', {exact:true}).press('Enter');
    await page.getByRole('option', {name:'High',exact:true}).click();
    await page.getByRole('button', {name:'Save settings',exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.locator('#settings-button').click();
    await advanced.click();
    assert.equal(await model.inputValue(), 'custom-owner-model');
    assert.equal(await page.getByLabel('Reasoning', {exact:true}).textContent(), 'High');
    await model.fill('');
    await page.getByLabel('Reasoning', {exact:true}).click();
    await page.getByRole('option', {name:'Use the default',exact:true}).click();
    await page.getByRole('button', {name:'Save settings',exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.locator('#settings-button').click();
    await advanced.click();
    assert.equal(await model.inputValue(), '');
    assert.equal(await page.getByLabel('Reasoning', {exact:true}).textContent(), 'Use the default');
    await advanced.click();
    await model.waitFor({state:'hidden'});
    await page.keyboard.press('Escape');
    await page.locator('#settings').waitFor({state:'detached'});
    assert.equal(await page.locator('#settings-button').evaluate(el => el === document.activeElement), true);
    await page.locator('#settings-button').click();
    await page.getByRole('tab', {name:'Roles',exact:true}).click();
    const roleModel = page.locator('.role-row input[data-role]').first();
    await roleModel.waitFor();
    await roleModel.fill('fixture-');
    await roleModel.press('ArrowDown');
    await page.getByRole('option', {name:'fixture-alpha',exact:true}).waitFor();
    await roleModel.press('Enter');
    assert.equal(await roleModel.inputValue(), 'fixture-alpha');
    assert.equal(await page.locator('#settings').isVisible(), true, 'Choosing a role model must not submit settings');
    await page.getByRole('button', {name:'Save settings',exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.locator('#settings-button').click();
    await page.getByRole('tab', {name:'Roles',exact:true}).click();
    const reopenedRoleModel = page.locator('.role-row input[data-role]').first();
    await reopenedRoleModel.waitFor();
    assert.equal(await reopenedRoleModel.inputValue(), 'fixture-alpha');
    await reopenedRoleModel.fill('custom-role-model');
    await reopenedRoleModel.press('Enter');
    assert.equal(await page.locator('#settings').isVisible(), true, 'Typing a custom role model must not submit settings');
    await page.getByRole('button', {name:'Save settings',exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.locator('#settings-button').click();
    await page.getByRole('tab', {name:'Roles',exact:true}).click();
    const savedRoleModel = page.locator('.role-row input[data-role]').first();
    await savedRoleModel.waitFor();
    assert.equal(await savedRoleModel.inputValue(), 'custom-role-model');
    await savedRoleModel.fill('');
    await page.getByRole('button', {name:'Save settings',exact:true}).click();
    await page.locator('#settings').waitFor({state:'detached'});
    await page.locator('#settings-button').click();
    await page.getByRole('tab', {name:'Roles',exact:true}).click();
    const blankRoleModel = page.locator('.role-row input[data-role]').first();
    await blankRoleModel.waitFor();
    assert.equal(await blankRoleModel.inputValue(), '');
    await page.keyboard.press('Escape');
    await page.locator('#settings').waitFor({state:'detached'});
    assert.equal(await page.locator('#settings-button').evaluate(el => el === document.activeElement), true);
    await page.getByText('Product folder', {exact:true}).click();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Clipboard denied')) } }));
    await page.getByRole('button', {name:'Copy folder path',exact:true}).click();
    await page.getByText('Could not copy. Select and copy the text instead.', {exact:true}).waitFor();
    await page.locator('#home-button').click();
    for (const width of [768, 390, 360]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
      if (width < 740) {
        const form = await page.locator('.new-product-section').boundingBox();
        const crew = await page.locator('.home-specialists').boundingBox();
        assert.ok(form.y + form.height <= crew.y, 'Mobile should put the idea form before the role introduction');
      }
      for (const button of await page.locator('.radial-person').all()) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44);
      }
    }
    assert.deepEqual(await page.evaluate(() => window.studioCspErrors), []);
    assert.deepEqual(errors, []);
    console.log('PASS: real studio app, radial/keyboard, motion preferences, mobile, selection/consent, dialogs, clipboard failure and CSP');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
