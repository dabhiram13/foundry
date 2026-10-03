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
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        if (this instanceof HTMLCanvasElement) this.dataset.animationStarts = String(Number(this.dataset.animationStarts || 0) + 1);
        return animate.apply(this, args);
      };
    });
    await page.goto(`http://127.0.0.1:${port}/#welcome`);
    await page.locator('.sky-background canvas[data-animation-starts="1"]').waitFor();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => document.querySelector('.sky-background canvas').getAnimations().length === 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.sky-background canvas').getAttribute('data-animation-starts'), '1', 'Scrolling back must not restart the sky');
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
    await page.getByRole('button', {name:'Quiet motion',exact:true}).click();
    await page.reload();
    await page.locator('html[data-motion=quiet]').waitFor();
    assert.equal(await page.getByRole('button', {name:'Replay intro',exact:true}).isDisabled(), true);
    await page.getByRole('button', {name:'Quiet motion',exact:true}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('html[data-motion=quiet]').waitFor();
    assert.equal(await page.getByRole('button', {name:'Replay intro',exact:true}).isDisabled(), true);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('html[data-motion=studio]').waitFor();
    await page.getByRole('button', {name:'Client portal',exact:true}).click();
    await page.getByLabel('Name', {exact:true}).fill('Motion check');
    await page.getByRole('button', {name:'Create product',exact:true}).click();
    await page.getByRole('heading', {name:'Motion check',exact:true}).waitFor();
    assert.equal(await page.getByRole('progressbar', {name:'Progress',exact:true}).getAttribute('aria-valuenow'), '0');
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
    await advanced.click();
    await page.getByLabel('Model', {exact:true}).waitFor({state:'hidden'});
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
