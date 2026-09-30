# Testing Patterns — Index

> Testers: read this index, then read what the test brief's `## Must Read` tells you. Don't load everything.

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `next-browser.md` | next-browser CLI reference, agent interaction patterns, snapshot→click→verify loops | Feature has UI pages | flow-tester |
| `api-contracts.md` | oRPC testing via Playwright fixtures, auth, validation, edge cases | Feature has backend procedures | api-tester |
| `inngest.md` | Dev server setup, event trigger→poll DB→verify state change | Feature has background jobs | api-tester |
| `flow-patterns.md` | Multi-page journey testing methodology, journey→steps→verify | Feature has user flows | flow-tester |
| `performance.md` | CWV, Lighthouse, PPR shell analysis, hydration timing, pattern enforcement | M/L features, performance-critical pages | perf-tester |
| `security.md` | RLS cross-user, plan gating, injection, auth bypass | Feature has auth/billing/user data | api-tester |

## How Testing Works

1. **Planners** add `## Testing` sections to their briefs (frontend-brief.md, backend-brief.md, build-brief.md)
2. **Testers** read the brief's testing section FIRST — it tells them exactly what to test
3. Testers then read the `## Must Read` docs from this index for methodology
4. Testers find bugs → fix surface issues, report architectural issues

## Testing Pipeline (sequential)

```
backend completes
  ├── api-tester (parallel with connector — no browser needed)
  │     reads: backend-brief.md ## Testing
  │
  ... connector + designer complete ...
  │
  ├── flow-tester (needs UI built)
  │     reads: frontend-brief.md ## Testing
  │
  └── perf-tester (needs everything built, CAN fix patterns)
        reads: frontend patterns + field-guide.md
```

## Test Infrastructure

| File | What |
|------|------|
| `webapp/tests/e2e/fixtures/auth.ts` | `authedPage`, `authedRequest`, `skipIfRedirected()` |
| `webapp/tests/e2e/fixtures/constants.ts` | Test credentials from env |
| `webapp/playwright.config.ts` | Projects, baseURL, webServer config |
| `webapp/tests/e2e/pages/` | Page Object Models (reusable selectors) |
| `webapp/tests/e2e/journeys/` | Deep user flow tests (@journey tag) |
