---
name: fix-test
description: >
  Fix a failing browser test. Reads a structured test report, identifies the root cause,
  makes a minimal fix following project patterns, and verifies the fix.
  Use for "fix test", "fix failing test", "fix test failure", "fix-test".
---

# Fix Test

Fix a single failing step from a browser test run. You receive a test report and a specific failing step. Your job: find the bug, fix it minimally, verify it works.

## Inputs

You will be given:
- **Report path**: `.foundry/test-reports/{runId}.md` — the full structured test report
- **Failing step**: Which step failed, with error details
- **Test type**: `flow`, `pages`, or `api`
- **Base URL**: The URL tested against

## Process

### 1. Read the test report

```bash
# Read the full report
Read .foundry/test-reports/{runId}.md
```

Find your specific failing step. Understand:
- What action was taken
- What was expected
- What actually happened
- Console errors / network failures
- File hints (if provided)

### 2. Load the right context

Based on the test type, read the relevant reference AND the project's pattern docs:

**Flow failures** (user journey broken):
- Read `references/flow-fixing.md` from this skill
- Read `.foundry/references/source-docs/patterns/frontend/architecture.md`
- Read `.foundry/references/source-docs/patterns/backend/orpc.md`
- Read `.foundry/references/source-docs/patterns/frontend/form-pattern.md` (if form-related)
- Read `.foundry/references/source-docs/patterns/frontend/data-flow-pattern.md` (if data-related)

**Page failures** (page doesn't render, console errors):
- Read `references/page-fixing.md` from this skill
- Read `.foundry/references/source-docs/patterns/frontend/page-pattern.md`
- Read `.foundry/references/source-docs/patterns/frontend/component-pattern.md`
- Read `.foundry/references/source-docs/patterns/frontend/loading-states-pattern.md`

**API failures** (endpoint errors, validation issues):
- Read `references/api-fixing.md` from this skill
- Read `.foundry/references/source-docs/patterns/backend/orpc.md`
- Read `.foundry/references/source-docs/patterns/testing/api-contracts.md`

### 3. Find the source

Use the file hints from the report. If none, search:

```
# For frontend issues
Glob webapp/app/**/*{page,layout,component}*.{ts,tsx}
Grep "the broken route or component name"

# For API issues
Glob webapp/lib/orpc/procedures/**/*.ts
Grep "the failing endpoint name"
```

Read the relevant files. Understand the current implementation before touching anything.

### 4. Fix — minimal and focused

Rules:
- **Fix ONLY the specific bug** — do not refactor, do not improve, do not clean up
- **Follow existing patterns** — match the style of surrounding code exactly
- **Do not change functionality** — the feature should work the same, just without the bug
- **Do not change tests** — fix the code, not the test expectations
- **If the fix requires changing more than 3 files**, stop and explain why — it may be architectural

Common fix categories:
- Missing `await` on async operation
- Wrong API route path or method
- Missing error handling causing uncaught exception
- Wrong redirect URL after form submit
- Missing validation on required field
- Component not handling loading/error state
- Wrong query parameter or request body shape

### 5. Verify the fix

After making changes, verify that the specific failure is resolved.

**For flow/page fixes** — use the browser to check:
```bash
# If you have Playwright MCP available:
# Navigate to the page, perform the action, verify the expected outcome

# If not, run the project's existing tests:
cd webapp && npx playwright test tests/e2e/{relevant-spec}.spec.ts --reporter=list
```

**For API fixes** — check the endpoint:
```bash
cd webapp && npx playwright test tests/e2e/{feature}-api.spec.ts --reporter=list
```

**If no existing test covers this**, do a manual verification:
- Read the page/component that renders the result
- Confirm your fix addresses the exact error from the report
- Check for obvious regressions (did you break the import? change a type signature?)

### 6. If verification fails

- Read the new error carefully — is it the same bug or a different one?
- If same bug: your fix was wrong. Re-read the source, try a different approach.
- If different bug: your fix introduced a regression. Revert and try again.
- **Maximum 3 attempts**. If still failing after 3, explain what you found and stop.

### 7. Output

When done, output a summary:

```
## Fix Summary

**Step fixed**: {step title}
**Root cause**: {what was actually wrong}
**Fix**: {what you changed, 1-2 sentences}
**Files changed**: {list}
**Verified**: {yes/no, how}
```

## What NOT to do

- Do NOT change unrelated code
- Do NOT add new dependencies
- Do NOT refactor the feature's architecture
- Do NOT modify test files or test expectations
- Do NOT change environment variables or config
- Do NOT add comments explaining the fix (the git commit does that)
- Do NOT run `git commit` — the orchestrator handles that
