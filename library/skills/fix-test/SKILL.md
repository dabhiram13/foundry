---
name: fix-test
description: >
  Fix a failing browser test. Reads a structured test report, identifies the root cause,
  makes a minimal fix following project patterns, and verifies the fix.
  Use for "fix test", "fix failing test", "fix test failure", "fix-test".
---

# Fix Test

Fix one failing test by locating the root cause in the product, test, fixture, data, or environment,
then making the smallest justified change and verifying the original failure mode.

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

Read this skill's relevant reference. Read project pattern documents only when they exist and match
the repository's actual stack; discover the paths instead of assuming this example layout.

**Flow failures** (user journey broken):
- Read `references/flow-fixing.md` from this skill
- If present and relevant, read the project's frontend architecture, backend contract, form, and
  data-flow guidance.

**Page failures** (page doesn't render, console errors):
- Read `references/page-fixing.md` from this skill
- If present and relevant, read the project's page, component, and loading/error-state guidance.

**API failures** (endpoint errors, validation issues):
- Read `references/api-fixing.md` from this skill
- If present and relevant, read the project's backend and API-test contract guidance.

### 3. Classify the failure and find the source

Do not assume the product is wrong merely because the test failed. Compare the expected behavior
with the approved requirement and inspect the failing trace, screenshot, console, and network
evidence when available.

- Product defect: behavior violates the requirement.
- Test defect: stale expectation, brittle locator, incorrect setup, or implementation-detail assertion.
- Fixture/data defect: invalid or shared state makes the result meaningless.
- Environment defect: service, configuration, version, or CI resource difference caused the failure.

Use the file hints from the report. If none, search:

```
# Examples — adapt paths to the repository
rg --files | rg '(page|layout|component|route|controller|handler)'
rg "the broken route, component, or endpoint name"
```

Read the relevant files. Understand the current implementation before touching anything.

### 4. Fix — minimal and focused

Rules:
- **Fix ONLY the specific bug** — do not refactor, do not improve, do not clean up
- **Follow existing patterns** — match the style of surrounding code exactly
- Preserve approved behavior. Change a test when evidence shows the test is stale or brittle; do
  not weaken an assertion merely to make it green.
- Follow the root cause across shared callers and change the smallest shared surface that fixes it.
- If the necessary scope is larger than the requested bug fix, explain the evidence and re-scope
  before an architectural change.

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

**For flow/page fixes** — use the browser or the project's configured focused test command:
```bash
# Example only; use the actual project directory, runner, and spec path.
cd <app-dir> && npx playwright test <relevant-spec> --reporter=list
```

**For API fixes** — run the configured focused API or integration test:
```bash
# Example only; use the actual project directory, runner, and test path.
cd <app-dir> && <test-command> <relevant-api-test>
```

**If no existing test covers this**, add the smallest regression check at the appropriate level, or
run a browser/API reproduction that asserts the expected result. Reading source is useful diagnosis,
but it is not runtime verification.

For an intermittent browser failure, inspect the trace and verify repeatedly with CI-like workers:
```bash
cd <app-dir> && npx playwright test <relevant-spec> --trace on --repeat-each=5
```

### 6. If verification fails

- Read the new error carefully — is it the same bug or a different one?
- If same bug: your fix was wrong. Re-read the source, try a different approach.
- If different bug: determine whether it is a regression, exposed pre-existing failure, or environment issue.
- After repeated failed hypotheses, stop editing and re-scope around the evidence and next discriminating probe.

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
- Do NOT weaken or delete a valid test expectation to obtain a pass
- Do NOT change environment variables or configuration unless evidence identifies configuration as
  the authorized root cause; never expose or replace secret values while fixing it.
- Do NOT add comments explaining the fix (the git commit does that)
- Do NOT run `git commit` — the orchestrator handles that
