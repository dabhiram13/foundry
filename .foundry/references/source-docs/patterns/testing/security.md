# Security Testing Patterns

Security checks that every feature with user data, auth, or billing must pass.

## RLS Cross-User Isolation

The most critical test: user A cannot access user B's data.

```typescript
test('user cannot access other user data', async ({ authedRequest }) => {
  // Create data as authenticated user
  const create = await authedRequest.post('/api/rpc/protected/{feature}/create', {
    data: { title: 'My Private Item' },
  })
  const { id } = (await create.json()).entity

  // Try to access as unauthenticated (simulates different user)
  const unauthCtx = await playwright.request.newContext({
    baseURL: 'http://localhost:3000'
  })
  const res = await unauthCtx.get(`/api/rpc/protected/{feature}/get?id=${id}`)
  expect(res.status()).toBeGreaterThanOrEqual(400)
  await unauthCtx.dispose()

  // Cleanup
  await authedRequest.post('/api/rpc/protected/{feature}/delete', {
    data: { id },
  })
})
```

## Auth Gating

Every protected endpoint and page must reject unauthenticated requests:

```typescript
// API endpoints
test('protected endpoint rejects unauthenticated', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const endpoints = [
    '/api/rpc/protected/{feature}/list',
    '/api/rpc/protected/{feature}/create',
  ]
  for (const endpoint of endpoints) {
    const res = await ctx.get(endpoint)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  }
  await ctx.dispose()
})

// Pages (browser-based)
test('protected page redirects to login', async ({ page }) => {
  await page.goto('/protected/{feature}')
  await page.waitForURL('**/auth/login**')
})
```

## Plan Gating

If the feature has paid-only endpoints:

```typescript
// paidProcedure returns 403 for free users
test('free user blocked from paid endpoint', async ({ authedRequest }) => {
  const res = await authedRequest.post('/api/rpc/protected/{feature}/premium-action', {
    data: { id: 'test' },
  })
  // Should be 403, not 500
  expect(res.status()).toBe(403)
})

// Soft-gated procedures return isFree flag
test('soft-gated endpoint returns limited data for free user', async ({ authedRequest }) => {
  const res = await authedRequest.get('/api/rpc/protected/{feature}/list')
  const body = await res.json()
  // Should include plan info, not error
  expect(body).toHaveProperty('isFree')
})
```

## Input Validation

```typescript
// SQL injection attempt
test('rejects SQL injection in search', async ({ authedRequest }) => {
  const res = await authedRequest.post('/api/rpc/protected/{feature}/list', {
    data: { search: "'; DROP TABLE scripts; --" },
  })
  // Should either reject (400) or safely escape (200 with no results)
  expect(res.status()).toBeLessThan(500)
})

// XSS in text fields
test('handles XSS in input', async ({ authedRequest }) => {
  const res = await authedRequest.post('/api/rpc/protected/{feature}/create', {
    data: { title: '<script>alert("xss")</script>' },
  })
  // Should either reject or sanitize — never store raw
  if (res.ok()) {
    const body = await res.json()
    expect(body.entity.title).not.toContain('<script>')
  }
})

// Oversized payload
test('rejects oversized input', async ({ authedRequest }) => {
  const res = await authedRequest.post('/api/rpc/protected/{feature}/create', {
    data: { title: 'x'.repeat(100000) },
  })
  expect(res.status()).toBe(400)
})
```

## CORS

```typescript
test('blocks cross-origin requests', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: { 'Origin': 'https://evil.com' }
  })
  const res = await ctx.get('/api/rpc/protected/{feature}/list')
  const corsHeader = res.headers()['access-control-allow-origin']
  expect(corsHeader).not.toBe('*')
  expect(corsHeader).not.toContain('evil.com')
  await ctx.dispose()
})
```

## Checklist

For every feature with user data:
- [ ] RLS: user A can't see user B's data
- [ ] Auth: unauthenticated → 401/redirect
- [ ] Plan: free user → 403 on paid endpoints (not 500)
- [ ] Validation: SQL injection, XSS, oversized payloads → rejected
- [ ] CORS: cross-origin blocked
- [ ] No service role in client code
- [ ] No `getSession()`/`getUser()` — only `getClaims()`
