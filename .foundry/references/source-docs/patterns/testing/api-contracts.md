# API Contract Testing Patterns

Testing oRPC procedures via Playwright request context. No browser, no mocks, real database.

## Framework

All API tests use the project's Playwright fixtures:

```typescript
import { test, expect } from './fixtures/auth'

test.describe('{Feature} API @api', () => {
  // authedRequest = API context with auth cookies pre-loaded
  test('GET list returns data', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/rpc/protected/{feature}/list')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('items')
  })
})
```

## What to Test Per Procedure

### Read procedures (list, get, search)
```typescript
// 1. Happy path — returns expected shape
const res = await authedRequest.get('/api/rpc/protected/{feature}/list')
const body = await res.json()
expect(body.items).toBeDefined()
expect(Array.isArray(body.items)).toBe(true)

// 2. Empty result — not an error
// (new user with no data should get empty array, not 500)

// 3. Pagination — if applicable
const page2 = await authedRequest.get('/api/rpc/protected/{feature}/list?cursor=abc')

// 4. Filters — each filter combination
const filtered = await authedRequest.post('/api/rpc/protected/{feature}/list', {
  data: { status: 'active', search: 'test' },
})
```

### Write procedures (create, update, delete)
```typescript
// 1. Happy path — create + verify
const createRes = await authedRequest.post('/api/rpc/protected/{feature}/create', {
  data: { title: 'Test Item' },
})
expect(createRes.ok()).toBeTruthy()
const { id } = (await createRes.json()).entity

// 2. Validation — empty/invalid input
const badRes = await authedRequest.post('/api/rpc/protected/{feature}/create', {
  data: { title: '' },
})
expect(badRes.status()).toBe(400)

// 3. Extra fields rejected (strict schemas)
const extraRes = await authedRequest.post('/api/rpc/protected/{feature}/create', {
  data: { title: 'Test', malicious: 'injected' },
})
expect(extraRes.status()).toBe(400)

// 4. Cleanup
await authedRequest.post('/api/rpc/protected/{feature}/delete', {
  data: { id },
})
```

### Auth checks (EVERY procedure)
```typescript
// Unauthenticated → 401+
test('rejects unauthenticated', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const res = await ctx.get('/api/rpc/protected/{feature}/list')
  expect(res.status()).toBeGreaterThanOrEqual(400)
  await ctx.dispose()
})
```

### Plan gating (paid procedures)
```typescript
// Free user → 403 on paidProcedure endpoints
// Only testable if test user is on free plan
test('free user gets 403 on paid endpoint', async ({ authedRequest }) => {
  const res = await authedRequest.post('/api/rpc/protected/{feature}/premium-action', {
    data: { id: 'test' },
  })
  expect(res.status()).toBe(403)
})
```

## Status Code Reference

| Code | Meaning | Test for |
|------|---------|----------|
| 200 | Success | Happy path |
| 400 | Validation error | Empty fields, wrong types, extra fields |
| 401 | Not authenticated | No auth cookies |
| 403 | Not authorized | Wrong user, wrong plan |
| 404 | Not found | Invalid ID |

## Tags

Every test.describe MUST have a tag:
- `@api` — all API tests
- `@smoke` — basic "doesn't crash" tests
- `@security` — auth gating, CORS, injection

## File Structure

```
webapp/tests/e2e/{feature}-api.spec.ts     # API contract tests
```

Max 10 tests per file. If more needed, split by concern: `{feature}-api.spec.ts` + `{feature}-api-edge.spec.ts`.
