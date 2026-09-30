# Test Quality Patterns

How to write tests that don't lie. A test that passes when the feature is broken is worse than no test.

## Anti-Patterns (NEVER do these)

### Vacuous Truth — loops over empty arrays
```typescript
// BAD — passes trivially when items is []
const items = (await res.json()).items
for (const item of items) {
  expect(item).toHaveProperty('id') // never runs if items is empty
}

// GOOD — assert non-empty FIRST
const items = (await res.json()).items
expect(items.length).toBeGreaterThan(0)
for (const item of items) {
  expect(item).toHaveProperty('id')
}
```

### Conditional Assertions — two pass paths
```typescript
// BAD — one path is meaningless
if (items.length > 0) {
  expect(items[0]).toHaveProperty('title')
} else {
  expect(true).toBe(true) // vacuous pass
}

// GOOD — skip if precondition unmet
test('filters return matching items', async ({ authedRequest }) => {
  // Seed data in beforeAll, so items.length > 0 is guaranteed
  const items = (await res.json()).items
  expect(items.length).toBeGreaterThan(0)
  expect(items[0]).toHaveProperty('title')
})
```

### Hardcoded Values That Expire
```typescript
// BAD — vacuously passes after 2026-12-31
const res = await authedRequest.post('/api/rpc/protected/audit/list', {
  data: { dateFrom: '2026-01-01', dateTo: '2026-12-31' },
})

// GOOD — always relative to now
const now = new Date()
const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
const res = await authedRequest.post('/api/rpc/protected/audit/list', {
  data: {
    dateFrom: yearAgo.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
  },
})
```

### Hardcoded UUIDs
```typescript
// BAD — only works if this UUID was seeded externally
const WORKSPACE_ID = 'a1b2c3d4-e5f6-...'

// GOOD — derive from API
let workspaceId: string
test.beforeAll(async ({ authedRequest }) => {
  const res = await authedRequest.get('/api/rpc/protected/workspace/current')
  workspaceId = (await res.json()).id
})
```

### Flaky Wait Strategies (flow tests)
```typescript
// BAD — networkidle never settles on streaming/SSE/WebSocket pages
await page.waitForLoadState('networkidle')

// BAD — arbitrary sleep
await page.waitForTimeout(3000)

// GOOD — wait for specific element
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 })
```

### CSS Positional Selectors (flow tests)
```typescript
// BAD — breaks on any DOM change
await page.locator('table tbody tr:first-child td:last-child button').click()

// GOOD — role-based
await page.getByRole('row', { name: /john/i }).getByRole('button', { name: /edit/i }).click()
```

## Self-Audit Greps

Run these before declaring tests complete:

```bash
# Vacuous assertions (loops without length check)
grep -n 'forEach\|\.map(' webapp/tests/e2e/{feature}* | grep -v 'length\|beforeAll\|afterAll'

# Hardcoded UUIDs
grep -n '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}' webapp/tests/e2e/{feature}* | grep -v 'fixtures\|constants\|import'

# Hardcoded dates
grep -n '202[0-9]-[0-9]\{2\}-[0-9]\{2\}' webapp/tests/e2e/{feature}*

# Conditional assertions
grep -n 'if.*{' webapp/tests/e2e/{feature}* | grep -i 'expect\|assert'

# Flaky waits (flow tests)
grep -n 'networkidle\|waitForTimeout' webapp/tests/e2e/{feature}*

# CSS positional selectors (flow tests)
grep -n 'tr:first\|td:last\|:nth-child' webapp/tests/e2e/{feature}*
```

## Honest Reporting

Tests must never silently omit cases. Every gap must be visible:

| Situation | Do | Don't |
|-----------|-----|-------|
| Can't test due to missing fixture | `test.skip('REQUIRES: free-plan user')` | Silently omit the test |
| Blocked by infrastructure | `test.fixme('Inngest dev server required')` | Don't write the test at all |
| Known architectural bug | `test.fail('TODO(known-bug): auth race')` | Document in struggles.md only |
| Feature not implemented | Mark journey `FAIL (not implemented)` | Count as PASS via code review |

## Known Bug Anchoring (MANDATORY)

Every architectural bug discovered during testing MUST have a test anchor — a `test.fail()` or `test.fixme()` in the test suite. Bugs documented only in prose (struggles.md, bug-fixes.md) are invisible to CI and will regress silently.

```typescript
// For bugs you've verified exist
test.fail('soft-delete returns 500 due to RLS SELECT policy conflict', async ({ ownerRequest }) => {
  // TODO(known-bug): reports_select_own includes deleted_at IS NULL which blocks UPDATE
  const res = await ownerRequest.post('/api/rpc/protected/reports/remove', { data: { id: reportId } })
  expect(res.status()).toBe(200)
})

// For bugs you can't reproduce in test (infrastructure dependency)
test.fixme('Inngest completion — requires OPENAI_API_KEY', async ({ ownerRequest }) => {
  // Full test body here — will run when fixme is removed
})
```

**Rules:**
- `test.fail()` = bug exists, test proves it fails. When bug is fixed, test starts passing → remove `.fail()`
- `test.fixme()` = can't run due to infrastructure. Include full test body so it runs when unblocked.
- `test.skip()` = precondition missing (fixture, data). Include reason string.
- NEVER silently omit a test case. Every gap must be visible in the test report.

## Data Isolation

### Option A: Seed via API (when create endpoint exists)

```typescript
// GOOD — self-sufficient spec, try/finally cleanup
let testItemId: string

test.beforeAll(async ({ authedRequest }) => {
  const res = await authedRequest.post('/api/rpc/protected/items/create', {
    data: { title: `test-${Date.now()}` }, // unique per run
  })
  testItemId = (await res.json()).entity.id
})

test.afterAll(async ({ authedRequest }) => {
  if (testItemId) {
    await authedRequest.post('/api/rpc/protected/items/delete', {
      data: { id: testItemId },
    })
  }
})
```

### Option B: Seed via Supabase MCP (when NO create endpoint exists)

No create endpoint? Use Supabase MCP (`mcp__supabase__execute_sql`) to INSERT seed rows directly and DELETE them in cleanup. Works for both pre-flight checks and writing test file `beforeAll`/`afterAll` blocks.

### try/finally for mid-test data

For tests that create data mid-test, use try/finally:
```typescript
test('create and verify', async ({ authedRequest }) => {
  const res = await authedRequest.post('/api/rpc/protected/items/create', {
    data: { title: 'temp' },
  })
  const id = (await res.json()).entity.id
  try {
    // assertions here
    expect(res.ok()).toBeTruthy()
  } finally {
    await authedRequest.post('/api/rpc/protected/items/delete', { data: { id } })
  }
})
```
