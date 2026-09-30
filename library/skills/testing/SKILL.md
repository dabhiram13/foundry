---
name: testing
description: >
  Choose, write, and run the smallest meaningful test for the project's actual stack,
  including unit, integration, API, component, and browser tests.
  Use for "write tests", "test this", "e2e test", "playwright", "add coverage",
  "fix flaky test", "run tests".
---

# Testing

Use the repository's existing test runner, scripts, fixtures, and configuration. Inspect the
package or build files before choosing a test level. Do not impose a Next.js, oRPC, Supabase,
Playwright, port, or folder layout on a project that uses something else.

## Stack

| Level | Best for | Boundary |
|-------|----------|----------|
| Unit | Pure logic and edge cases | One function or module |
| Component | Interactive UI states that do not need the whole app | Rendered component |
| Integration/API | Contracts among application modules, storage, or HTTP | Real owned boundary where practical |
| Browser/E2E | Critical user journeys and browser-visible behavior | Running application in a real browser |

Prefer the lowest level that proves the behavior. A small unit or integration test is often
clearer and faster than reproducing every rule through a browser. Use browser tests for behavior
that depends on navigation, rendering, accessibility, browser APIs, or a full user journey.

## Test Boundaries

- Exercise the application's own critical path with its real implementation and configured test
  services when practical.
- A narrow fake or route interception is appropriate at an unstable, expensive, destructive, or
  unavailable third-party boundary. Keep the contract shape realistic and cover the owned
  integration separately when the risk warrants it.
- Do not mock the code under test, recreate production schemas in the test, or assert private
  implementation details.
- Reuse existing factories and fixtures. Add the smallest deterministic fixture only when the
  repository has no suitable one.

## What TO Test

| Type | Where | What |
|------|-------|------|
| Unit/component | Project convention | Logic branches, state transitions, accessible UI behavior |
| Integration/API | Project convention | Auth, validation, persistence, response and error contracts |
| Browser/E2E | Existing Playwright location | Critical navigation, forms, rendering, and browser behavior |

## Browser Pattern

```typescript
import { test, expect } from '@playwright/test';

test('submits the form', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Display name').fill('Ada');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
});
```

## Selector Priority (E2E)

1. `getByRole('button', { name: 'Submit' })` — prefer how users and assistive technology perceive it
2. `getByLabel('Email')` — form fields
3. `getByText('Welcome')` — visible text
4. `getByPlaceholder('Search...')` — inputs
5. `getByTestId('x')` — last resort

Prefer semantic contracts and stable test IDs. Use a CSS locator when no useful user-facing
contract exists and the selector is intentionally stable; avoid selectors coupled to styling,
DOM depth, or `nth-child`.

## Readiness and Waiting

Playwright locators, actions, and web-first assertions already wait for actionability and expected
state. Wait for the user-visible result, URL, or specific response that proves readiness.

```typescript
// WRONG
await page.waitForTimeout(3000);
// RIGHT
await expect(page.getByText('Dashboard')).toBeVisible();
await page.waitForURL('/dashboard');
```

Do not use fixed sleeps in committed tests. Do not use `networkidle` as a general readiness signal;
live connections, polling, and analytics can prevent it, while an idle network does not prove the UI
is usable.

## Flaky Failures

1. Read the original error and the trace from the failing environment before editing.
2. Classify timing/readiness, shared state, hydration, environment drift, or resource contention.
3. Fix the narrow cause. Do not lengthen a timeout until evidence shows the operation legitimately
   needs a different budget.
4. Re-run the focused test repeatedly and with CI-like worker settings. A retry pass is evidence of
   a flake, not evidence of a fix.

```bash
npx playwright test path/to/spec --trace on --repeat-each=5
npx playwright test path/to/spec --workers=4 --repeat-each=5
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Flaky timeout | Inspect trace; wait for the observable state, not elapsed time |
| Element not found | Check route, frame, accessible name, rendering state, and trace |
| Auth state bleeds | Separate browser contexts per test |
| CI-only failure | Match CI workers/env and inspect its retained trace/video |
