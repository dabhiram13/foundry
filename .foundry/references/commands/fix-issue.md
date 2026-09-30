<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: fix-issue
description: Show pending Sentry issues from latest report, pick which to fix, spawn agents to resolve them. Interactive issue fixer.
---

# Fix Sentry Issues

Interactive fixer that reads the latest Sentry report, presents pending issues, and spawns the right agents to fix them.

Arguments: `$ARGUMENTS`
- No args = interactive (show issues, user picks)
- `--all-critical` = auto-fix all critical and high issues
- `--issue SENTRY-ID` = fix a specific issue by ID

---

## Phase 1: Load Latest Report

```bash
ls -t dev/reports/sentry/*.md 2>/dev/null | head -1
```

If no report exists:
> No Sentry report found. Run `/sentry` first to analyze production errors.

Read the report. Extract all issues with status `pending`.

## Phase 2: Present Issues

Show a numbered table of pending issues:

> **Pending Sentry Issues** ({N} total)
>
> | # | Severity | ID | Title | Feature | Events | Fix Complexity |
> |---|----------|-----|-------|---------|--------|---------------|
> | 1 | critical | PROJ-123 | Auth token expired crash | auth | 847 | S |
> | 2 | high | PROJ-456 | Null ref in billing hook | billing | 234 | XS |
> | 3 | high | PROJ-789 | API timeout on /ideas | ideas | 156 | M |
> | 4 | medium | PROJ-012 | Missing fallback image | design | 45 | XS |
> | ... | ... | ... | ... | ... | ... | ... |
>
> **Which issues should I fix?**
> - Enter numbers (e.g. `1,2,4`) to fix specific issues
> - Enter `all` to fix everything
> - Enter `critical` to fix critical + high only

Wait for user response.

## Phase 3: Plan Fixes

For each selected issue, determine the right agent based on the issue type and affected feature:

| Issue Type | Agent | Why |
|-----------|-------|-----|
| Database/query error | db-architect | Schema, RLS, query fixes |
| API/procedure error | backend | oRPC procedures, server logic |
| Data fetching/RSC error | connector | Server components, caching, data layer |
| UI crash/client error | designer | Component fixes, error boundaries |
| Build/deploy error | build-fixer | Build config, imports |
| Type error | ts-expert | Type system fixes |
| Auth error | backend + connector | Auth flow spans both layers |

If multiple issues map to the same agent, batch them into one agent spawn.

## Phase 4: Execute Fixes

For each agent (or batch):

1. Create workspace: `dev/active/sentry-fix-{date}/`
2. Write a mini spec per issue:

```markdown
# Sentry Fix — {SENTRY-ID}

## Issue
{title}

## Stack Trace
{from report}

## Root Cause
{from report's analysis}

## Fix Recommendation
{from report}

## Files to Check
{from report + feature's docs/built/ file}
```

3. Spawn agent with the spec:

```
You are the {agent} agent.

Fix this Sentry error. The root cause analysis and fix recommendation are provided.

SPEC: Read dev/active/sentry-fix-{date}/spec-{SENTRY-ID}.md
FEATURE DOCS: Read docs/built/{feature}.md

- Read the affected files
- Apply the recommended fix (or a better one if you find it)
- Run tsc to verify
- Do NOT refactor surrounding code

Report what you changed in your completion signal.
```

4. Run agents that can work in parallel simultaneously (different files/features).
5. Run agents with overlapping files sequentially.

## Phase 5: Verify

After all agents complete:

```bash
cd webapp && npx tsc --noEmit
```

If tsc fails, spawn build-fixer (max 2 cycles).

## Phase 6: Update Report

Read the sentry report and update the status of fixed issues:

- Change `pending` to `fixed` for successfully resolved issues
- Add a `## Fixes Applied — {date}` section at the bottom:

```markdown
## Fixes Applied — {YYYY-MM-DD}

| ID | Fix | Agent | Files Changed |
|----|-----|-------|---------------|
| PROJ-123 | Added token refresh check | backend | lib/auth/utils.ts |
| PROJ-456 | Added null guard in hook | connector | features/billing/hooks/... |
```

## Phase 7: Summary

> **Fixes applied:**
>
> | Issue | Status | What changed |
> |-------|--------|-------------|
> | PROJ-123 — Auth token crash | Fixed | Added token refresh in auth utils |
> | PROJ-456 — Null ref billing | Fixed | Added null guard |
> | PROJ-789 — API timeout | Fixed | Added connection pooling |
>
> tsc: PASS
>
> Consider committing these fixes and deploying to verify in Sentry.

## Phase 8: Cleanup

```bash
mv dev/active/sentry-fix-{date}/ dev/archive/sentry-fix-{date}/
```
