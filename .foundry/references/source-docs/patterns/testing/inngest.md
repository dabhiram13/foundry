# Inngest Testing Patterns

Testing background jobs by triggering events and polling for side effects. No mocking Inngest internals.

## How It Works

Inngest functions change database state. You test them by:
1. Triggering the event (via API call that fires the event)
2. Polling the database for the expected state change
3. Asserting the final state

You don't test Inngest directly — you test the API → Inngest → DB pipeline.

## Prerequisites

The Inngest dev server must be running alongside Next.js and pointed at the correct app URL.

**Automated (Playwright):** The `globalSetup` in playwright.config.ts starts the Inngest dev server automatically using the detected portless URL. No manual setup needed when running `npm run test:e2e`.

**Manual (development):**
```bash
# Start with portless URL auto-detection
cd webapp && npm run dev:inngest

# Or start explicitly with a custom URL
cd webapp && npx inngest-cli@latest dev -u http://build-kit-template.localhost:8000/api/inngest
```

The `-u` flag is **required** when using portless — without it, Inngest defaults to `localhost:3000` which doesn't exist in a portless setup.

## Pattern: Trigger → Poll → Verify

```typescript
test('background job completes', async ({ authedRequest }) => {
  // 1. Trigger the event via API (the procedure fires inngest.send())
  const res = await authedRequest.post('/api/rpc/protected/scripts/generate', {
    data: { videoId: 'test-video-123' },
  })
  expect(res.ok()).toBeTruthy()
  const { jobId } = await res.json()

  // 2. Poll for completion (check the DB state via another API call)
  let status = 'pending'
  let attempts = 0
  const maxAttempts = 15  // 15 x 2s = 30s max

  while (status !== 'done' && status !== 'failed' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 2000))
    const check = await authedRequest.get(
      `/api/rpc/protected/scripts/get?id=${jobId}`
    )
    const data = await check.json()
    status = data.status
    attempts++
  }

  // 3. Assert final state
  expect(status).toBe('done')
})
```

## What to Test

### Job completion
- Trigger event → job runs → DB state changes as expected
- Timeout: set a reasonable max (30s for most jobs, 60s for complex pipelines)
- Verify ALL side effects: DB rows created, status updated, related records modified

### Job failure handling
- Trigger with invalid input → job should fail gracefully
- Check: error status set in DB, no partial state, user-facing status reflects failure
- Don't test Inngest retry logic — that's Inngest's responsibility

### Fan-out (multiple workers)
- Trigger batch event → all items processed
- Verify: all child records created, parent record updated with final count
- Timeout scales with batch size

## Polling Helper

Reusable polling utility:

```typescript
async function pollUntil(
  check: () => Promise<{ done: boolean; value?: unknown }>,
  { maxAttempts = 15, intervalMs = 2000 } = {}
) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await check()
    if (result.done) return result.value
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Polling timed out after ${maxAttempts * intervalMs}ms`)
}
```

## Key Rules

- NEVER import Inngest functions into tests — test via API + DB state only
- NEVER mock the Inngest client — real events, real execution
- Always set a timeout — don't poll forever
- Clean up test data after (delete created records)
- The Inngest dev server is started automatically by globalSetup — if it fails to start, tests FAIL (never skip)
- Log the job ID in test output for debugging
