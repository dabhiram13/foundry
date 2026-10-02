#!/usr/bin/env node
/* Real browser acceptance suite. Uses an existing Playwright package and browser.
 * No dependency download, external account, live service or production workspace.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, values) => {
  if (i % 2 === 0) pairs.push([value.replace(/^--/, ''), values[i + 1]]);
  return pairs;
}, []));
if (!options.output) { process.stderr.write('--output is required\n'); process.exit(2); }
const output = path.resolve(options.output);
fs.mkdirSync(output, { recursive: true });
const report = {
  schema_version: 1, status: 'UNVERIFIED', kind: 'deterministic_fixture_browser',
  started_at: new Date().toISOString(), criteria: [], artifacts: [],
  limits: ['Fake outline provider and demo credits; no live billing or AI qualification.',
    'One local Chromium browser; targeted accessibility checks are not full WCAG conformance.',
    'A passing fixed fixture does not prove native agent-generated delivery.'],
};
const record = (id, observed) => report.criteria.push({ id, status: 'PASS', observed });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'marketcraft-browser-'));
let server, browser, context, page, tracing = false, began = false;
let serverLog = '';
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    report.interrupted = signal;
    if (server) server.kill('SIGTERM');
    if (browser) browser.close().catch(() => {});
  });
}

async function startServer(port = 0, failFirst = false) {
  const args = [path.join(__dirname, 'app.py'), '--db', path.join(temporary, 'app.sqlite3'), '--port', String(port)];
  if (failFirst) args.push('--fail-first-action');
  server = spawn(options.python || process.env.PYTHON || 'python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const child = server;
  child.stderr.on('data', (data) => { serverLog += data.toString(); });
  const lines = readline.createInterface({ input: child.stdout });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fixture server did not become ready within 10 seconds.')), 10_000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Fixture exited before readiness (${code}). ${serverLog}`)); });
    lines.once('line', (line) => {
      clearTimeout(timeout);
      try { resolve(JSON.parse(line).url); } catch (error) { reject(error); }
      lines.close();
    });
  });
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
  server = null;
}

async function visibleText(locator, text) {
  await locator.waitFor({ state: 'visible' });
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text),
    { selector: await locator.evaluate((element) => `#${element.id}`), text });
}

async function screenshot(name) {
  const filename = `${name}.png`;
  const viewport = page.viewportSize();
  const fullPage = viewport.width > 700;
  // Some Chrome builds tile stale content during tall mobile fullPage captures.
  // Preserve actual viewport pixels, with separate top/result views, on mobile.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(output, filename), fullPage });
  report.artifacts.push(filename);
  report.capture_frames ||= [];
  report.capture_frames.push({ file: filename, viewport, full_page: fullPage,
    ...await page.evaluate(() => ({ scroll_y: window.scrollY, document_height: document.documentElement.scrollHeight })) });
}

async function hasFocus(locator) {
  assert.equal(await locator.evaluate((element) => document.activeElement === element), true, 'Expected keyboard focus');
}

function gateNextRequest(pattern) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return page.route(pattern, async (route) => { await gate; await route.continue(); }, { times: 1 }).then(() => release);
}

(async () => {
  try {
    let playwright;
    const requested = process.env.MARKETCRAFT_PLAYWRIGHT_MODULE;
    if (requested) playwright = require(requested);
    else {
      try { playwright = require('playwright'); }
      catch { playwright = require('playwright-core'); }
    }
    if (!playwright.chromium) throw new Error('The selected package does not provide Playwright Chromium.');
    const resolved = require.resolve(requested || (() => {
      try { return require.resolve('playwright'); } catch { return require.resolve('playwright-core'); }
    })());
    try { report.playwright_version = JSON.parse(fs.readFileSync(path.join(path.dirname(resolved), 'package.json'), 'utf8')).version; }
    catch { report.playwright_version = null; }
    browser = await playwright.chromium.launch({
      headless: true,
      ...(process.env.MARKETCRAFT_BROWSER_EXECUTABLE ? { executablePath: process.env.MARKETCRAFT_BROWSER_EXECUTABLE } : {}),
    });
    report.browser = { name: 'chromium', version: browser.version(), node: process.version };
    const url = await startServer(0, true);
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    // Network is restricted to the fixture origin even if application code changes.
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === url) return route.continue();
      return route.abort('blockedbyclient');
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracing = true;
    page = await context.newPage();
    page.setDefaultTimeout(8000);
    const pageErrors = [], responses = [], consoleErrors = [], requestFailures = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', (response) => {
      if (response.status() >= 400) responses.push({ path: new URL(response.url()).pathname, status: response.status() });
    });
    page.on('requestfailed', (request) => {
      requestFailures.push({ path: new URL(request.url()).pathname, method: request.method(), error: request.failure()?.errorText });
    });
    began = true;
    const releaseInitial = await gateNextRequest('**/api/session');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await visibleText(page.locator('#status'), 'Loading your workspace');
    await screenshot('01-loading');
    releaseInitial();
    await page.getByRole('button', { name: 'Create account', exact: true }).waitFor();
    await page.keyboard.press('Tab');
    await hasFocus(page.getByRole('link', { name: 'Skip to main content' }));
    await page.keyboard.press('Enter');
    await hasFocus(page.getByRole('main'));
    record('UX-LOADING-KEYBOARD', 'Visible initial status and working keyboard skip link.');

    await page.getByLabel('Email address').fill('browser@example.test');
    await page.keyboard.press('Tab');
    await hasFocus(page.getByLabel('Password', { exact: true }));
    await page.keyboard.type('disposable-browser-password');
    await page.keyboard.press('Tab');
    await hasFocus(page.getByRole('button', { name: 'Create account', exact: true }));
    await page.keyboard.press('Enter');
    await page.locator('#empty').waitFor();
    await hasFocus(page.getByLabel('Workshop idea'));
    await screenshot('02-empty-desktop');
    record('AUTH-EMPTY', 'Keyboard signup establishes a session and exposes a useful empty state.');

    await page.getByLabel('Workshop idea').fill('   ');
    await page.getByRole('button', { name: 'Review brief', exact: true }).click();
    await hasFocus(page.getByLabel('Workshop idea'));
    assert.equal(await page.locator('#title').evaluate((input) => input.validity.valid), false);
    assert.equal((await (await context.request.get(`${url}/api/briefs`)).json()).briefs.length, 0);
    await page.getByLabel('Workshop idea').fill('An unfinished idea');
    await page.getByRole('button', { name: 'Review brief', exact: true }).click();
    await hasFocus(page.getByRole('heading', { name: 'Review your brief' }));
    await page.getByRole('button', { name: 'Back to edit' }).click();
    await hasFocus(page.getByLabel('Workshop idea'));
    assert.equal(await page.getByLabel('Workshop idea').inputValue(), 'An unfinished idea');
    await page.getByLabel('Workshop idea').fill('Teach a practical garden workshop');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Workshop idea').waitFor();
    assert.equal(await page.getByLabel('Workshop idea').inputValue(), 'Teach a practical garden workshop');
    await page.getByRole('button', { name: 'Review brief', exact: true }).click();
    await visibleText(page.locator('#review-title'), 'Teach a practical garden workshop');
    await screenshot('02b-review-resumed');
    await page.keyboard.press('Tab');
    await hasFocus(page.getByRole('button', { name: 'Save brief', exact: true }));
    let briefWrites = 0;
    const countBriefWrites = (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/briefs') briefWrites++;
    };
    page.on('request', countBriefWrites);
    await page.route('**/api/briefs', async (route) => {
      if (route.request().method() === 'GET') {
        await route.abort('failed');
        await page.unroute('**/api/briefs');
      } else await route.continue();
    });
    await page.keyboard.press('Enter');
    await visibleText(page.getByRole('alert'), 'connection was interrupted');
    await hasFocus(page.getByRole('alert'));
    assert.equal(await page.getByRole('button', { name: 'Back to edit' }).isDisabled(), true);
    assert.equal((await (await context.request.get(`${url}/api/briefs`)).json()).briefs.length, 1);
    await page.getByRole('button', { name: 'Refresh saved briefs', exact: true }).click();
    await page.getByRole('heading', { name: 'Teach a practical garden workshop', exact: true }).waitFor();
    assert.equal(briefWrites, 1, 'A failed display read must not repeat the committed brief POST');
    page.off('request', countBriefWrites);
    assert.equal((await (await context.request.get(`${url}/api/briefs`)).json()).briefs.length, 1);
    await hasFocus(page.getByLabel('Workshop idea'));
    record('GUIDED-EDIT-RESUME', 'Invalid whitespace cannot save; review/back/reload retain the draft, and a failed post-save refresh retries only the read with correct focus.');
    await page.getByRole('button', { name: 'Create outline', exact: true }).click();
    await visibleText(page.getByRole('alert'), 'needs the demo plan');
    await hasFocus(page.getByRole('alert'));
    await screenshot('03-entitlement');
    record('ENTITLEMENT', 'A saved brief is free; outline creation is denied before plan enablement.');

    await page.getByRole('button', { name: 'Enable demo plan (no charge)' }).click();
    await visibleText(page.locator('#balance'), '3 outline credits');
    const releaseAction = await gateNextRequest('**/api/briefs/*/outline');
    await page.getByRole('button', { name: 'Create outline', exact: true }).click();
    await visibleText(page.locator('#status'), 'Creating outline');
    assert.equal(await page.getByRole('button', { name: 'Creating outline…', exact: true }).isDisabled(), true);
    await screenshot('04-action-loading');
    releaseAction();
    await visibleText(page.getByRole('alert'), 'temporarily unavailable');
    await hasFocus(page.getByRole('alert'));
    assert.match(await page.locator('#balance').innerText(), /3 outline credits/);
    await screenshot('05-error-retry');
    assert.deepEqual(await (await context.request.get(`${url}/api/activation`)).json(), { event: 'first_outline_saved', count: 0 });
    record('PROVIDER-FAILURE', 'Injected deterministic-provider failure is announced; no credit is lost.');

    await page.getByRole('button', { name: 'Create outline', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.locator('.outline').waitFor();
    assert.match(await page.locator('.outline').innerText(), /Test the example with a participant/);
    assert.match(await page.locator('#balance').innerText(), /2 outline credits/);
    await hasFocus(page.getByRole('heading', { name: 'Your saved briefs' }));
    await screenshot('06-outline-desktop');
    record('SAVE-RETRY', 'Keyboard retry saves the outline and consumes exactly one demo credit.');

    const port = Number(new URL(url).port);
    await stopServer();
    assert.equal(await startServer(port), url);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.outline').waitFor();
    assert.match(await page.locator('.outline').innerText(), /practical garden workshop/);
    assert.match(await page.locator('#balance').innerText(), /2 outline credits/);
    assert.deepEqual(await (await context.request.get(`${url}/api/activation`)).json(), { event: 'first_outline_saved', count: 1 });
    record('RETURN-RESTART', 'The same authenticated browser returns to saved content after an actual server restart.');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Review brief', exact: true }).focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot('07-mobile-keyboard');
    await page.locator('.outline').scrollIntoViewIfNeeded();
    await screenshot('07b-mobile-result');
    const accessible = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      headings: document.querySelectorAll('h1').length,
      labelledInputs: [...document.querySelectorAll('input')].every((input) => input.labels.length > 0),
      touchTargets: [...document.querySelectorAll('button')].filter((button) => button.getClientRects().length)
        .every((button) => button.getBoundingClientRect().height >= 44),
      focusedOutline: getComputedStyle(document.activeElement).outlineWidth,
    }));
    assert.equal(accessible.horizontalOverflow, false);
    assert.equal(accessible.headings, 1);
    assert.equal(accessible.labelledInputs, true);
    assert.equal(accessible.touchTargets, true);
    assert.notEqual(accessible.focusedOutline, '0px');
    report.accessibility = accessible;
    record('MOBILE-A11Y', '375px layout has no horizontal overflow; labelled inputs, 44px buttons, one h1, visible keyboard focus.');

    await page.getByLabel('Workshop idea').fill('Private unfinished draft');
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith('briefroom-draft:'))), true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Create account', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith('briefroom-draft:'))), false);
    await page.getByLabel('Email address').fill('other-browser@example.test');
    await page.getByLabel('Password', { exact: true }).fill('another-disposable-password');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.locator('#empty').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Teach a practical garden workshop', exact: true }).count(), 0);
    assert.equal(await page.locator('.outline').count(), 0);
    await page.locator('#empty').scrollIntoViewIfNeeded();
    await screenshot('08-other-account-empty');
    assert.equal(await page.getByLabel('Workshop idea').inputValue(), '');
    assert.deepEqual(await (await context.request.get(`${url}/api/activation`)).json(), { event: 'first_outline_saved', count: 0 });
    record('TENANT-UI', 'Signout followed by another account shows no previous account content.');

    // A committed POST is not necessarily displayed: either follow-up read can
    // fail. The visible retry must reuse the completed operation, not charge again.
    await page.getByLabel('Workshop idea').fill('Retry-safe workshop');
    await page.getByRole('button', { name: 'Review brief', exact: true }).click();
    await page.getByRole('button', { name: 'Save brief', exact: true }).click();
    await page.getByRole('heading', { name: 'Retry-safe workshop', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Enable demo plan (no charge)' }).click();
    await visibleText(page.locator('#balance'), '3 outline credits');
    report.refresh_retry = [];
    for (const [readPath, expectedCredits, criterion, screenshotName] of [
      ['/api/session', 2, 'REFRESH-RETRY-SESSION', '09-session-refresh-error'],
      ['/api/briefs', 1, 'REFRESH-RETRY-LIST', '10-list-refresh-error'],
    ]) {
      let aborted = false;
      await page.route(`**${readPath}`, async (route) => {
        assert.equal(route.request().method(), 'GET');
        aborted = true;
        await route.abort('failed');
      }, { times: 1 });
      const committed = page.waitForResponse((response) =>
        response.request().method() === 'POST' && /\/outline$/.test(new URL(response.url()).pathname));
      await page.getByRole('button', { name: expectedCredits === 2 ? 'Create outline' : 'Create another outline', exact: true }).click();
      const firstResponse = await committed;
      assert.equal(firstResponse.status(), 200);
      const firstReceipt = await firstResponse.json();
      assert.equal(firstReceipt.credits, expectedCredits);
      await visibleText(page.getByRole('alert'), 'connection was interrupted');
      assert.equal(aborted, true, `Expected ${readPath} refresh to be aborted`);
      await hasFocus(page.getByRole('alert'));
      await screenshot(screenshotName);
      const replayed = page.waitForResponse((response) =>
        response.request().method() === 'POST' && /\/outline$/.test(new URL(response.url()).pathname));
      await page.getByRole('button', { name: expectedCredits === 2 ? 'Create outline' : 'Create another outline', exact: true }).click();
      const retryResponse = await replayed;
      assert.equal(retryResponse.status(), 200);
      const retryReceipt = await retryResponse.json();
      const actualAccount = await (await context.request.get(`${url}/api/session`)).json();
      const observed = {
        failed_refresh: readPath, committed_credits: firstReceipt.credits,
        retry_credits: retryReceipt.credits, stored_credits: actualAccount.account.credits,
        committed_key: firstResponse.request().headers()['idempotency-key'],
        retry_key: retryResponse.request().headers()['idempotency-key'],
      };
      report.refresh_retry.push(observed);
      assert.equal(observed.retry_key, observed.committed_key, `${readPath}: retry must reuse the committed operation key`);
      assert.equal(observed.stored_credits, expectedCredits, `${readPath}: display-refresh failure must not cause another debit`);
      assert.deepEqual(retryReceipt, firstReceipt);
      assert.deepEqual(await (await context.request.get(`${url}/api/activation`)).json(), { event: 'first_outline_saved', count: 1 });
      await visibleText(page.locator('#status'), 'Outline saved');
      await visibleText(page.locator('#balance'), `${expectedCredits} outline credits`);
      assert.equal(await page.getByRole('alert').isVisible(), false);
      assert.match(await page.locator('.outline').innerText(), /Retry-safe workshop/);
      record(criterion, `Committed outline survives failed ${readPath} refresh; retry preserves its key and ${expectedCredits}-credit balance.`);
    }
    await screenshot('11-refresh-retry-recovered');

    const unexpected = responses.filter(({ path: route, status }) =>
      !(route === '/api/session' && status === 401) &&
      !(/^\/api\/briefs\/\d+\/outline$/.test(route) && [402, 503].includes(status)));
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(requestFailures.map(({ path: failedPath, method }) => [failedPath, method]),
      [['/api/briefs', 'GET'], ['/api/session', 'GET'], ['/api/briefs', 'GET']]);
    report.network = { observed_errors: responses, unexpected_errors: unexpected, injected_request_failures: requestFailures };
    report.console = { page_errors: pageErrors, error_messages: consoleErrors };
    record('ACTIVATION-ONCE', 'No activation on provider failure; first saved outline activates once across restart, retries and later outlines, isolated per account.');
    record('BROWSER-RUNTIME', 'No uncaught page errors or unexpected failed application responses. Expected negative responses are retained.');
    report.status = report.interrupted ? 'FAIL' : 'PASS';
  } catch (error) {
    report.status = began ? 'FAIL' : 'UNVERIFIED';
    report.error = error.stack || String(error);
    if (page) {
      try { await screenshot('failure'); } catch { /* Preserve the original failure. */ }
    }
  } finally {
    if (tracing) {
      try { await context.tracing.stop({ path: path.join(output, 'trace.zip') }); report.artifacts.push('trace.zip'); }
      catch (error) { report.trace_error = String(error); report.status = 'FAIL'; }
    }
    if (browser) await browser.close();
    await stopServer();
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.writeFileSync(path.join(output, 'server.log'), serverLog);
    report.artifacts.push('server.log');
    report.finished_at = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'browser.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${report.status}: ${report.criteria.length} browser criteria; ${path.join(output, 'browser.json')}\n`);
    process.exitCode = report.status === 'PASS' ? 0 : report.status === 'UNVERIFIED' ? 2 : 1;
  }
})();
