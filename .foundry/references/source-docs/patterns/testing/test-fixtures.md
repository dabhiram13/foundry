# Test Fixtures — Multi-User Personas

4 test users exist for comprehensive testing. Each has different roles and plan levels.

## User Matrix

| Fixture | Email | Role | Plan | Use for |
|---------|-------|------|------|---------|
| `ownerRequest` / `ownerPage` | `test-owner@example.dev` | owner/admin | free* | Happy paths, admin features, self-operation tests |
| `memberRequest` / `memberPage` | `test-member@example.dev` | member | free* | RBAC rejection, non-admin paths |
| `proRequest` / `proPage` | `test-pro@example.dev` | owner | pro | Paid feature access, premium flows |
| `freeRequest` / `freePage` | `test-free@example.dev` | owner | free | Plan gating, upgrade walls, free-plan limits |

*Owner defaults to free unless Stripe is configured. Pro user requires Stripe setup (Phase 4i3).

`authedRequest` / `authedPage` are backwards-compatible aliases for the owner persona.

## Usage

```typescript
import { test, expect } from './fixtures/auth'

test.describe('Feature API @api', () => {
  // Happy path — owner (admin)
  test('list returns items', async ({ ownerRequest }) => {
    const res = await ownerRequest.get('/api/rpc/protected/feature/list')
    expect(res.ok()).toBeTruthy()
  })

  // RBAC — member can't access admin endpoint
  test('member gets 403 on admin endpoint', async ({ memberRequest }) => {
    const res = await memberRequest.post('/api/rpc/protected/feature/admin-action', {
      data: { id: 'test' },
    })
    expect(res.status()).toBe(403)
  })

  // Plan gating — free user hits upgrade wall
  test('free user gets 403 on paid endpoint', async ({ freeRequest }) => {
    const res = await freeRequest.post('/api/rpc/protected/feature/premium-action', {
      data: { id: 'test' },
    })
    expect(res.status()).toBe(403)
  })

  // Auth — unauthenticated request rejected
  test('unauthenticated gets 401', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL })
    const res = await ctx.get('/api/rpc/protected/feature/list')
    expect(res.status()).toBeGreaterThanOrEqual(400)
    await ctx.dispose()
  })
})
```

## Flow Tests with Multiple Personas

```typescript
test('free user sees upgrade wall', async ({ freePage }) => {
  await freePage.goto('/protected/premium-feature')
  await expect(freePage.getByText(/upgrade/i)).toBeVisible()
})
```

## Auth State Files

Each persona has a separate auth state file (created by `npx playwright test --project=setup`):

| Persona | State File |
|---------|-----------|
| Owner (default) | `tests/e2e/.auth/state.json` + `state-owner.json` |
| Member | `tests/e2e/.auth/state-member.json` |
| Pro | `tests/e2e/.auth/state-pro.json` |
| Free | `tests/e2e/.auth/state-free.json` |

## When Personas Aren't Configured

If `TEST_MEMBER_EMAIL` (etc.) is not in `.env`, the auth setup skips that persona. Tests requesting `memberRequest` will use an empty context (no auth) — they'll get 401s. This is by design: the test still runs and reveals the gap.

## Setup

Run `/setup` Phase 4i to create all 4 users. Credentials go in `webapp/.env`.
