# Flow Testing Patterns

Multi-page user journey testing methodology. Every journey in the test brief becomes a test.

## Journey Structure

The test brief defines journeys as sequential steps. Each step is:
1. **Where** — the page/URL
2. **Action** — what to click/fill/submit
3. **Verify** — what should be visible after

## Testing a Journey

```bash
# Journey: "Create Script from Video"
# Step 1: Video list page
npx next-browser open $DEV_URL/protected/videos
npx next-browser snapshot                    # verify: heading "Videos", video cards visible
npx next-browser errors                      # verify: no errors

# Step 2: Click video → detail page
npx next-browser click "My Video Title"
npx next-browser snapshot                    # verify: on /protected/videos/[id], "Generate Script" button visible

# Step 3: Generate → redirect to scripts
npx next-browser click "Generate Script"
npx next-browser snapshot                    # verify: redirected to /protected/scripts
                                         # verify: optimistic card with loading skeleton visible

# Step 4: Wait for background job completion (Inngest-driven)
# The UI should update automatically (polling/realtime) — do NOT just reload once.
# Poll with snapshots until the optimistic card transitions from loading → done.
# Timeout after 30s (jobs typically complete in 7-15s).
for i in $(seq 1 15); do
  sleep 2
  npx next-browser snapshot 2>/dev/null
  # Look for: skeleton/spinner gone, real content visible
  # If content is there, break
done
npx next-browser snapshot                    # final verify: card shows script content, not skeleton
npx next-browser errors                      # verify no errors during transition

# Step 5: Click into script detail
npx next-browser click "My Script Title"
npx next-browser snapshot                    # verify: full script content visible
```

## Verification Checklist Per Step

After each `snapshot`, verify:
- [ ] Expected heading/content is present
- [ ] No "Internal Server Error" or error boundaries
- [ ] Interactive elements have correct refs (buttons, links, inputs)
- [ ] Loading states resolve (skeletons replaced by content)

After each `errors` check:
- [ ] No runtime errors
- [ ] No hydration mismatches
- [ ] No failed network requests (check with `network` if suspicious)

## Edge Case Journeys

### Empty State
```bash
# New user, no data yet
npx next-browser open $DEV_URL/protected/scripts
npx next-browser snapshot
# Verify: empty state message, CTA button visible (e.g., "Create your first script")
```

### Unauthorized Access
```bash
# Try to access another user's resource
npx next-browser goto /protected/scripts/other-user-script-id
npx next-browser snapshot
# Verify: 404 page or redirect, NOT the other user's data
```

### Back Button
```bash
npx next-browser goto /protected/scripts/123
npx next-browser back
npx next-browser snapshot
# Verify: back on list page, no errors, data still visible
```

### Page Refresh Mid-Flow
```bash
npx next-browser goto /protected/scripts/new
npx next-browser fill e1 "Draft Title"
npx next-browser reload
npx next-browser snapshot
# Verify: form state behavior (cleared or preserved, per spec)
```

### Free User Hitting Paid Feature
```bash
npx next-browser goto /protected/premium-feature
npx next-browser snapshot
# Verify: UpgradeWall visible, NOT an error page
# Verify: upgrade CTA button present
```

## Responsive Testing

For every major page in the journey:

```bash
# Mobile
npx next-browser viewport 375x812
npx next-browser goto /protected/scripts
npx next-browser screenshot
npx next-browser snapshot
# Verify: no horizontal overflow, nav accessible, content readable

# Tablet
npx next-browser viewport 768x1024
npx next-browser screenshot

# Desktop (default)
npx next-browser viewport 1440x900
npx next-browser screenshot
```

## Writing Regression Specs

After verifying journeys with next-browser, write Playwright specs for CI:

```typescript
import { test, expect } from './fixtures/auth'

test.describe('Script Generation Flow @journey', () => {
  test('video → generate → script created', async ({ authedPage }) => {
    await authedPage.goto('/protected/videos', { waitUntil: 'domcontentloaded' })
    await expect(authedPage.getByRole('heading', { name: /videos/i })).toBeVisible()

    await authedPage.getByText('My Video').click()
    await authedPage.waitForURL('**/videos/**')

    await authedPage.getByRole('button', { name: /generate script/i }).click()
    await authedPage.waitForURL('**/scripts')

    // Wait for optimistic card to resolve
    await expect(authedPage.getByText(/script content/i)).toBeVisible({ timeout: 30000 })
  })
})
```

## Async UX / Optimistic Cards (Inngest Background Jobs)

When a feature triggers a background job (via Inngest), the UI typically shows an optimistic card that transitions through states. The Inngest dev server is started automatically by Playwright's globalSetup — you don't need to manage it.

### What to verify

1. **Immediate feedback** — After triggering, an optimistic card/skeleton appears instantly (no blank state)
2. **Loading state** — Card shows spinner, skeleton, or progress indicator while job runs
3. **Completion transition** — Card updates to show final content WITHOUT requiring a manual page reload
4. **Error state** — If the job fails, card shows an error message (not stuck loading forever)

### next-browser: Poll for DOM transition

```bash
# Trigger the action
npx next-browser click "Generate"
npx next-browser snapshot                    # verify: optimistic card with skeleton/spinner

# Poll until the card transitions (max 30s)
for i in $(seq 1 15); do
  sleep 2
  npx next-browser snapshot
  # Check: is the skeleton/spinner still visible?
  # Check: has real content appeared?
  # If yes → break out
done

npx next-browser snapshot                    # final state — should show completed content
npx next-browser errors                      # no errors during the async transition
```

### Playwright regression spec

```typescript
test('optimistic card resolves after background job', async ({ authedPage }) => {
  await authedPage.goto('/protected/feature')

  // Trigger
  await authedPage.getByRole('button', { name: /generate/i }).click()

  // Verify optimistic card appears immediately
  await expect(authedPage.getByTestId('job-card')).toBeVisible()
  // Skeleton/loading indicator should be present
  await expect(authedPage.getByTestId('job-card').locator('[data-loading]')).toBeVisible()

  // Wait for background job to complete — content replaces skeleton
  // Use a 30s timeout (Inngest jobs take 7-15s typically)
  await expect(
    authedPage.getByTestId('job-card').getByText(/expected result/i)
  ).toBeVisible({ timeout: 30_000 })

  // Skeleton should be gone
  await expect(
    authedPage.getByTestId('job-card').locator('[data-loading]')
  ).not.toBeVisible()
})
```

### What NOT to do

- **Don't `reload` and hope** — The UI should update via polling/realtime, not manual refresh
- **Don't use fixed `sleep(15000)`** — Poll with snapshots so you catch the transition
- **Don't skip if "it takes too long"** — Set a 30s timeout and FAIL if it doesn't complete
- **Don't test Inngest internals** — You test what the USER sees, not the job status API

## Key Rules

- Follow the journey from the test brief EXACTLY — step by step
- `snapshot` after EVERY action — refs invalidate after DOM changes
- `errors` after every page load — catch silent failures
- `screenshot` at each major step — visual evidence
- Fix surface bugs (broken links, missing awaits, wrong routes)
- Report architectural bugs — don't redesign
- Responsive testing (375/768/1440) for every major page
