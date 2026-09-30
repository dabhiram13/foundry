---
name: testing
description: >
  Write and run tests: API tests (Playwright request against running server),
  E2E (Playwright with real browser). No mocks. No vitest procedure tests.
  Use for "write tests", "test this", "e2e test", "playwright", "add coverage",
  "fix flaky test", "run tests".
---

# Testing

Everything runs against the **real dev server** (portless URL or fallback). The base URL is auto-detected by `playwright.config.ts` — never hardcode `localhost:3000`. No mocks. No factories. No recreated schemas.

## Stack

| Layer | Tool | What |
|-------|------|------|
| API | Playwright `request` | Hit real oRPC endpoints, test auth/validation/responses |
| E2E | Playwright browser | Full user journeys, real browser |

**Rule**: API tests for backend logic. E2E for UI. NO mocked procedure tests. NO per-component `.test.tsx`.

## Architecture

```
webapp/
├── tests/
│   ├── e2e/
│   │   ├── fixtures/auth.ts          ← authedPage fixture
│   │   ├── fixtures/constants.ts     ← test credentials
│   │   ├── pages/PostsPage.ts        ← Page Object Models
│   │   ├── auth.setup.ts             ← saves auth state
│   │   ├── posts.spec.ts             ← E2E spec
│   │   └── posts-api.spec.ts         ← API spec
│   └── setup.ts
└── playwright.config.ts
```

## What NOT To Create

- **NO `.test.ts` files next to procedures** — API tests hit the running server
- **NO mocks** — no `vi.fn()`, no MSW, no mock supabase contexts
- **NO recreated schemas** — the server validates with its own
- **NO `.test.tsx` files for components** — E2E covers UI
- **NO factory files** — use Supabase MCP for real data

## What TO Test

| Type | Where | What |
|------|-------|------|
| API tests | `tests/e2e/{feature}-api.spec.ts` | Auth gating, input validation, response shape, business rules |
| E2E tests | `tests/e2e/{feature}.spec.ts` | Page loads, buttons, forms, navigation, auth gating |

## API Test Pattern

```typescript
import { test, expect } from '@playwright/test'

// Use baseURL from playwright config (auto-detects portless) — never hardcode localhost:3000

// Authenticated tests
test.describe('Feature API — authenticated', () => {
  test.use({ storageState: '.auth/state.json' })

  test('returns correct data', async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/rpc/protected/feature/action`, {
      data: { /* real input */ }
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // assert on real response shape
  })
})

// Unauthenticated tests
test.describe('Feature API — unauthorized', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('rejects without auth', async ({ request }) => {
    const res = await request.post(`${BASE}/protected/feature/action`)
    expect(res.ok()).toBeFalsy()
  })
})
```

## Selector Priority (E2E)

1. `getByRole('button', { name: 'Submit' })` — always first
2. `getByLabel('Email')` — form fields
3. `getByText('Welcome')` — visible text
4. `getByPlaceholder('Search...')` — inputs
5. `getByTestId('x')` — last resort

**Never** CSS classes, DOM structure, nth-child.

## Waiting (E2E)

```typescript
// WRONG
await page.waitForTimeout(3000);
// RIGHT
await expect(page.getByText('Dashboard')).toBeVisible();
await page.waitForURL('/dashboard');
```

## Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| API spec | `{feature}-api.spec.ts` in `tests/e2e/` | `posts-api.spec.ts` |
| E2E spec | `{feature}.spec.ts` in `tests/e2e/` | `posts.spec.ts` |
| Page Object | `{Feature}Page.ts` in `tests/e2e/pages/` | `PostsPage.ts` |
| Fixture | named export in `tests/e2e/fixtures/` | `auth.ts` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Flaky timeouts | `expect().toBeVisible()` not `waitForTimeout` |
| Element not found | `waitForLoadState('networkidle')` first |
| Auth state bleeds | Separate browser contexts per test |
| API 404 | Check endpoint path: `/api/rpc/protected.{feature}.{action}` |
