# Playwright Reference

Use the project's installed Playwright version and existing configuration. Add or upgrade packages
only when the task explicitly requires setup and the owner authorizes the dependency change.

## Install (only when setup is requested)

```bash
npm i -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

## Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results/playwright-report.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

## Page Object Model

```typescript
// tests/e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private page: Page) {
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByRole('alert');
  }

  async goto() { await this.page.goto('/auth/login'); }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
```

## Auth Fixture

```typescript
// tests/e2e/fixtures/auth.ts
import { test as base, Page } from '@playwright/test';

type Fixtures = { authenticatedPage: Page };

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/protected/**');
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

## Third-party boundary control

Keep owned application flows real. Route interception is useful for deterministic failure states or
unavailable third-party systems; scope it to the exact external URL and assert the contract.

```typescript
// Isolate a third-party sandbox that is not part of the behavior under test.
await page.route('https://payments.example.test/**', route =>
  route.fulfill({ status: 200, body: JSON.stringify({ status: 'succeeded' }) })
);

// Intercept and inspect
const [response] = await Promise.all([
  page.waitForResponse(r => r.url().includes('/api/user')),
  page.getByRole('button', { name: 'Load' }).click(),
]);
const data = await response.json();
```

## Accessibility

```typescript
import AxeBuilder from '@axe-core/playwright';

test('no a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

## Visual Regression

```typescript
test('homepage visual', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', { fullPage: true });
});
```

## CI Sharding

```bash
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

## Debugging

```bash
npx playwright test --headed          # See browser
npx playwright test --debug           # Step debugger
npx playwright test path/to/spec --trace on --repeat-each=5
npx playwright show-report            # HTML report
```

```typescript
// In test: pause and inspect
await page.pause();

// Named steps for better reports
await test.step('Fill login form', async () => {
  await page.getByLabel('Email').fill('test@test.com');
});
```
