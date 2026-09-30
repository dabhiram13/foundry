---
name: feature-code-review
description: >
  AI code review using CodeRabbit CLI + surgical fixer agent. Reviews uncommitted
  feature code for bugs, security issues, and logic errors. Fixer resolves critical
  findings without breaking anything. Produces code-review.md.
  Use for "code review", "review feature", "coderabbit review", "feature code review".
---

# Feature Code Review

Runs CodeRabbit CLI on uncommitted feature code, then delegates critical+high findings to a surgical fixer agent. Produces `dev/active/{feature}/code-review.md`. Runs after feature-quality, before feature-complete.

## Inputs
- **feature**: Feature name (e.g., `posts`, `billing`, `notifications`)

## Pre-flight
1. Read `dev/active/{feature}/foundation.md` — project rules
2. Read `dev/active/{feature}/plan.md` → Feature Brief section — understand the feature
3. Read `dev/active/{feature}/quality-report.md` — confirm quality gates ran
4. Verify CodeRabbit CLI is installed:
   ```bash
   which coderabbit || which cr
   ```
   If not installed:
   ```bash
   curl -fsSL https://cli.coderabbit.ai/install.sh | sh
   source ~/.bashrc
   ```
5. Verify auth:
   ```bash
   coderabbit auth status
   ```
   If not authenticated → stop and report error to parent via mail (user needs to run `coderabbit auth login`).

## Execution

### 1. Run CodeRabbit Review

```bash
cd /path/to/your/project && coderabbit --prompt-only -t uncommitted -c AGENTS.md 2>&1 | tee /tmp/coderabbit-{feature}-round1.txt
```

**Flags:**
- `--prompt-only` — AI-agent-optimized output (succinct, file locations, severity, suggested fixes)
- `-t uncommitted` — reviews only working directory changes (not the whole repo history)
- `-c AGENTS.md` — passes project rules as context to CodeRabbit

**If CodeRabbit fails to run:** Note in code-review.md as "review skipped — {reason}". Do NOT block the pipeline.

**If no findings:** Skip to step 4 (write report with "no issues found").

### 2. Parse and Categorize Findings

Read the CodeRabbit output from `/tmp/coderabbit-{feature}-round1.txt`.

Categorize each finding:

| Severity | Action |
|----------|--------|
| **Critical** | Must fix — security vulnerability, data loss risk, crash |
| **High** | Should fix — logic error, race condition, missing validation |
| **Medium** | Fix if trivial — best practice violation, minor edge case |
| **Low / Nit** | Skip — style, naming, documentation suggestions |

Filter to only findings in feature-related files:
- `webapp/features/{feature}/`
- `webapp/lib/orpc/procedures/{feature}.ts`
- `webapp/app/protected/{feature}/`
- `supabase/migrations/` (only migrations for this feature)
- `webapp/tests/e2e/{feature}*.ts`

Ignore findings in shared files, unrelated features, or config files.

### 3. Delegate to Fixer Agent

**If critical or high findings exist:**

Delegate to the `build-fixer` agent (`.foundry/agents/build-fixer.md`) — it is the kit's surgical fixer: read, edit, re-run `tsc`, never refactor.

```
Feature: {feature}

FINDINGS TO FIX (critical + high only):
{paste each finding: file, line, severity, description, suggested fix}

CONTEXT FILES:
- Foundation: dev/active/{feature}/foundation.md
- Plan: dev/active/{feature}/plan.md

Fix each finding one at a time. Verify tsc after each. If tsc fails, fix the TypeScript error — never revert.
Return your structured summary when done.
```

**On completion:** Read the fixer's summary. Record:
- How many fixed
- How many skipped (false positive / plan change needed)

**If medium findings exist and no critical/high:** Spawn the fixer for medium findings too, but only trivial ones (one-line fixes).

### 3b. Re-verify After Fixes

After the fixer completes:
```bash
cd webapp && npx tsc --noEmit
```
Must still pass. If it doesn't → the fixer introduced type errors. **Do NOT revert.** Reverting destroys the real fixes (security, bugs, validation).

**TypeScript errors are trivial — fix them.**

Spawn a focused TypeScript fixer pass:
```
The code-review fixer introduced TypeScript errors. Fix ONLY the type errors.

TSC ERRORS:
{paste the tsc output}

FILES THE FIXER MODIFIED:
{list from fixer summary "Fixed" table}

RULES:
- Fix ONLY TypeScript type errors. Do NOT change any logic or behavior.
- Ultra-minimal changes: add type annotations, fix imports, add type assertions, adjust generics.
- Never add new functionality, never remove existing functionality.
- Never refactor. Never "improve" code. Just make tsc pass.
- After each fix, run: cd webapp && npx tsc --noEmit
```

Use the `typescript-pro` skill for complex type resolution if needed.

**After TS fixer pass:** re-run `npx tsc --noEmit`. Must pass. TypeScript errors are always fixable — keep going until tsc is clean.

### 3c. Re-run CodeRabbit (cycle 2, if fixes were applied)

If the fixer applied any fixes:
```bash
cd /path/to/your/project && coderabbit --prompt-only -t uncommitted -c AGENTS.md 2>&1 | tee /tmp/coderabbit-{feature}-round2.txt
```

Check for NEW critical/high findings introduced by the fixes. If found:
- Spawn fixer again for the new findings only
- After fixer → re-verify tsc
- **Max 3 total cycles.** After cycle 3, document remaining findings and stop.

### 4. Write Code Review Report

Write `dev/active/{feature}/code-review.md`:

```markdown
# Code Review — {feature}

## Date: {YYYY-MM-DD}
## Reviewer: CodeRabbit CLI (--prompt-only -t uncommitted)
## Cycles: {N}/3

## Summary
| Category | Count |
|----------|-------|
| Critical findings | {N} |
| High findings | {N} |
| Medium findings | {N} |
| Low/Nit (ignored) | {N} |
| **Fixed** | **{N}** |
| Skipped (false positive) | {N} |
| Skipped (requires plan change) | {N} |
| Deferred (remaining after 3 cycles) | {N} |

## Fixed Issues
| # | File | Issue | Fix |
|---|------|-------|-----|
{from fixer summary}

## Skipped Issues
| # | File | Issue | Reason |
|---|------|-------|--------|
{false positives + plan changes}

## Deferred Issues
{Any findings remaining after 3 cycles — these go into TODO.md during feature-complete}

## tsc Status After Review: PASS/FAIL
```

### 5. Update Context

Update `dev/active/{feature}/context.md`:
- Add "code-review complete" to phase status
- Record cycle count and fix/skip counts

---

## Error Recovery

**Fixable (handle yourself):**
- CodeRabbit times out → retry once with `--type uncommitted`
- Fixer agent doesn't return structured output → parse what you can, document the rest
- tsc fails after fixer → run TypeScript fixer pass (step 3b), never revert

**Blocking:**
- CodeRabbit not installed and install script fails → stop and report error via mail to parent
- CodeRabbit not authenticated (needs user to login via browser) → stop and report error via mail to parent
- TypeScript fixer can't resolve type errors after exhausting all approaches → report structural issue via mail to parent

## Progress Reporting

Append to `dev/active/{feature}/progress.md`:

```markdown
## Step: code-review ({date})
### Done
- CodeRabbit: {N} findings ({N} critical, {N} high, {N} medium)
- Fixed: {N}, Skipped: {N}, Deferred: {N}
- Cycles: {N}/3
### Tests
- tsc after fixes: {PASS/FAIL}
### Learnings
- {patterns from review findings}
### Warnings
- {deferred findings or "None"}
```

## Completion Rule

Do NOT signal completion until:
- [ ] progress.md updated with code-review step summary
- [ ] CodeRabbit ran at least once (or failure documented)
- [ ] All critical findings addressed (fixed, skipped with reason, or deferred after 3 cycles)
- [ ] tsc passes after all fixes
- [ ] `dev/active/{feature}/code-review.md` written
- [ ] context.md updated with code-review status
