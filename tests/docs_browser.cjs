const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.MARKETCRAFT_PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-docs-'));
const server = spawn(process.env.FOUNDRY_PYTHON || path.join(root, '.venv/bin/python'), ['-u', '-c', `
import functools, json, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from scripts.factory_ui import Service, make_server
class StaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
base = Path(sys.argv[1])
public = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(StaticHandler, directory='site/dist'))
threading.Thread(target=public.serve_forever, daemon=True).start()
local = make_server(Service(products_dir=base / 'products', data_dir=base / 'data'))
print(json.dumps({'public': public.server_port, 'local': local.server_port}), flush=True)
local.serve_forever()
`, temp], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

(async () => {
  let browser;
  try {
    const ports = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Docs servers did not start')), 15000);
      server.stderr.on('data', chunk => process.stderr.write(chunk));
      server.on('error', error => { clearTimeout(timeout); reject(error); });
      server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Docs servers exited: ${code}`)); });
      server.stdout.on('data', chunk => {
        output += chunk;
        if (!output.includes('\n')) return;
        clearTimeout(timeout);
        try { resolve(JSON.parse(output.split('\n')[0])); } catch (error) { reject(error); }
      });
    });
    browser = await chromium.launch({ headless: true, executablePath: process.env.MARKETCRAFT_BROWSER_EXECUTABLE || undefined });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    const publicRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => {
      if (new URL(request.url()).port === String(ports.public)) publicRequests.push(new URL(request.url()).pathname);
    });
    const publicOrigin = `http://127.0.0.1:${ports.public}`;
    await page.goto(publicOrigin);
    await page.getByRole('heading', { name: /Start with an idea\.\s*Make it real\./ }).waitFor();
    assert.equal(await page.locator('.bracketed').count(), 0);
    assert.equal(await page.locator('.landing-title-secondary').evaluate(el => getComputedStyle(el).color), 'rgb(163, 163, 163)');
    assert.equal(await page.locator('.product-walkthrough').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.getByRole('tab', { name: 'Describe it', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('heading', { name: 'Read the plan. Then decide.' }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Review it', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: 'Install Foundry', exact: true }).first().click();
    assert.equal(await page.locator('#landing-install').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.getByRole('button', { name: 'Open local browser view' }).count(), 0);
    assert.equal(await page.locator('meta[name="foundry-token"]').count(), 0);
    await page.getByRole('navigation', { name: 'Introduction' }).getByRole('link', { name: 'Docs' }).click();
    await page.waitForURL(`${publicOrigin}/docs/`);
    for (const port of [ports.public, ports.local]) {
      const origin = `http://127.0.0.1:${port}`;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/docs/`);
      for (const theme of ['light', 'dark']) {
        await page.locator('starlight-theme-select select:visible').selectOption(theme);
        const selected = await page.locator('[aria-current="page"]').first().evaluate(el => {
          const style = getComputedStyle(el);
          return { color: style.color, weight: style.fontWeight };
        });
        assert.deepEqual(selected, { color: theme === 'dark' ? 'rgb(245, 245, 245)' : 'rgb(23, 23, 23)', weight: '600' });
      }
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      assert.equal(await page.locator('dialog[open]').evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter), 'none');
      await page.locator('dialog input').fill('subscription');
      await page.getByRole('link', { name: /Support matrix and setup recipes/ }).click();
      await page.getByRole('heading', { name: 'Support matrix and setup recipes', exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('link', { name: 'Install & first project', exact: true }).click();
      await page.getByRole('heading', { name: 'Your first product with Foundry', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.equal(publicRequests.some(url => url.startsWith('/api/') || url === '/app.js'), false);
    assert.deepEqual(errors, []);
    console.log('Docs: public isolation, local CSP search, result navigation and mobile menus passed.');
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      const closed = once(server, 'close');
      server.kill('SIGKILL');
      await closed;
    }
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
