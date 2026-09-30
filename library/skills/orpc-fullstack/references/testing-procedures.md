# Proving a procedure works

Procedures are tested over HTTP against a running server with Playwright's request context. No
mocks, no recreated schema, no unit test of the handler function in isolation — the middleware chain
is most of the behaviour, and calling the handler directly skips all of it.

Specs live in `webapp/tests/e2e/`, one file per feature, named `{feature}-api.spec.ts`.

## The shape

```ts
import { test, expect } from './fixtures/auth'

const TRIGGER = '/api/rpc/protected/jobs/trigger'

test.describe('Jobs API @api', () => {
  test('trigger — happy path returns jobId and queued status', async ({ authedRequest }) => {
    const res = await authedRequest.post(TRIGGER, { data: { input: 'test data' } })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('queued')
  })

  test('trigger — empty input returns validation error', async ({ authedRequest }) => {
    const res = await authedRequest.post(TRIGGER, { data: { input: '' } })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('trigger — no auth returns 401 @security', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL: baseURL! })
    const res = await ctx.post(TRIGGER, { data: { input: 'hello' } })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    await ctx.dispose()
  })
})
```

The URL is the procedure's `.route()` path under `/api/rpc` — that is the same string in both
places, and a mismatch between contract and procedure shows up here first.

## What every procedure owes a test

| Case | Expectation |
|---|---|
| Happy path | 2xx and the exact response shape the caller destructures |
| Invalid input | 4xx from Zod, never a 500 |
| Unauthenticated | 401 on anything above `publicProcedure` — use a fresh request context, not `authedRequest` |
| Wrong entitlement | 403 for a `'free'` user against a `paidProcedure`, and for a non-admin against `adminProcedure` |
| Another user's row | 404 or 403, never that user's data — this is the RLS assertion |

Tag security cases `@security` and API files `@api`; the existing specs do, and the runner filters
on those tags.

## Fixtures

`webapp/tests/e2e/fixtures/auth` supplies `authedRequest`, a request context already carrying a
signed-in session. For the unauthenticated case build a bare context with
`playwright.request.newContext({ baseURL })` and dispose it — reusing `authedRequest` and hoping the
cookie is absent tests nothing.

## Reading a failure

| Symptom | Look at |
|---|---|
| 404 on a path you just added | `.route()` path, and whether the router entry was appended |
| 401 where you expected 200 | claims — `resolveUserFromClaims` needs `sub`; the fixture may be signed out |
| 403 on a `paidProcedure` | `plan` claim; unknown means `'free'` by design |
| 500 with a Zod message | a raw `Error` thrown where an `Errors.*` belonged |
| 429 in a loop of tests | the in-memory rate limiter is per-process and does not reset between tests |

The `testing` skill covers running the suites and the wider harness; this file is only the
procedure-shaped part.
