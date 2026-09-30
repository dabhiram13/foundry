<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: heal
description: Closed-loop healing. Reads all monitor reports, creates a branch, fixes critical/high issues with the right agents, runs quality gates + tests, re-verifies, scores confidence, emails verdict. Never touches main.
---

# Heal — Autonomous Fix Pipeline

Reads detection reports, fixes issues on a branch, proves the fixes work, scores confidence, emails you the verdict. You decide to merge or discard.

Arguments: `$ARGUMENTS`
- No args = fix critical + high from all report types
- `--critical-only` = only critical severity
- `--type sentry,security,performance,drift` = filter report types
- `--dry-run` = show what would be fixed, don't create branch or touch code
- `--branch <name>` = custom branch name (default: `heal/{YYYY-MM-DD-HHmm}`)

---

## MANDATORY RULES

1. **NEVER commit to main.** All work happens on `heal/*` branch.
2. **NEVER force-push.** If branch exists, abort and tell user.
3. **NEVER skip quality gates.** Even if all fixes look trivial.
4. **NEVER auto-merge.** Branch stays open. Human merges.
5. **NEVER fix LOW/MEDIUM unless explicitly asked** (`--all` flag).
6. **ONE heal branch at a time.** Check for existing `heal/*` branches first.
7. **Commit after each fix group** — atomic commits for easy revert.
8. **Re-run the detector** that found each issue to PROVE it's fixed.

## ANTI-PATTERNS

- DO NOT batch unrelated fixes into one commit — one commit per fix group
- DO NOT refactor surrounding code — surgical fixes ONLY
- DO NOT add features, improve patterns, or "while I'm here" changes
- DO NOT skip tests because "it's just a config change"
- DO NOT mark something as fixed if the re-verification still finds it
- DO NOT read implementation files yourself — that's the agents' job. You dispatch.

---

## Phase 1: Collect Reports

```bash
LATEST_SENTRY=$(ls -t dev/reports/sentry/*.md 2>/dev/null | head -1)
LATEST_SECURITY=$(ls -t dev/reports/security/*.md 2>/dev/null | head -1)
LATEST_PERFORMANCE=$(ls -t dev/reports/performance/*.md 2>/dev/null | head -1)
LATEST_DRIFT=$(ls -t dev/reports/drift/*.md 2>/dev/null | head -1)
LATEST_PENTEST=$(ls -t dev/reports/pentest/*.md 2>/dev/null | head -1)
LATEST_AUDIT=$(ls -t dev/reports/audit/*.md 2>/dev/null | head -1)
```

For each report that exists and matches `--type` filter:
- Read it
- Extract all findings with severity CRITICAL or HIGH (or all if `--all`)
- Skip findings already marked `fixed` in a previous heal run

If ZERO actionable findings → tell user "All clear. No critical/high issues across reports." and exit.

## Phase 2: Build Issue Queue

Create a unified queue sorted by: CRITICAL first, then HIGH, then by user impact (events/users affected).

Deduplicate: if the same file:line appears in both security and performance reports, merge into one issue with both sources noted.

For each issue, determine the right agent:

| Issue Source | Issue Type | Agent |
|-------------|-----------|-------|
| sentry | Database/query error | db-architect |
| sentry | API/procedure error | backend |
| sentry | Data fetching/RSC error | connector |
| sentry | UI crash/client error | designer |
| sentry | Build/deploy error | build-fixer |
| sentry | Type error | ts-expert |
| sentry | Auth error | backend + connector |
| security | RLS gap, missing policy | db-architect |
| security | Injection, validation | backend |
| security | Auth bypass, session | backend + connector |
| security | Data leakage, privacy | backend + connector |
| security | Config, headers, CSP | connector |
| performance | Frontend rendering | connector |
| performance | Backend query | db-architect or backend |
| performance | Architecture violation | connector or backend |
| drift | Data fetching pattern | connector |
| drift | Component structure | designer |
| drift | Backend pattern | backend |
| drift | Stale docs/built/ | complete |
| audit | Dependency vulnerability | (bash: npm audit fix) |
| audit | Dead code | connector or backend |

**If `--dry-run`:** Present the queue as a table and stop.

> **Dry Run — Heal Plan**
>
> | # | Severity | Source | Issue | Agent | Files |
> |---|----------|--------|-------|-------|-------|
> | 1 | CRITICAL | sentry | Auth token crash | backend | lib/auth/... |
> | 2 | HIGH | security | Missing RLS on votes | db-architect | migration |
> | ... | ... | ... | ... | ... | ... |
>
> {N} issues would be fixed. Run `/heal` without `--dry-run` to proceed.

## Phase 3: Branch Setup

```bash
# Ensure clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

# Check no existing heal branch
if git branch --list 'heal/*' | grep -q .; then
  echo "ERROR: Existing heal branch found. Merge or delete it first:"
  git branch --list 'heal/*'
  exit 1
fi

# Create branch from main
BRANCH="heal/$(date +%Y-%m-%d-%H%M)"
git checkout -b "$BRANCH"
```

Create workspace: `dev/active/heal-{date}/`
Write the issue queue to `dev/active/heal-{date}/issues.md`

## Phase 4: Fix — Route to Agents

Group issues by agent to minimize spawns. Execute groups sequentially (not parallel — each fix may affect the next).

For each agent group:

```
You are the {agent} agent (.foundry/agents/{agent}.md).

FIX THESE ISSUES (surgical fixes only — do NOT refactor):

{For each issue in this group:}
### Issue {N}: [{SEVERITY}] {title}
- Source: {sentry/security/performance/drift} report ({date})
- File: {path}:{line}
- Problem: {description from report}
- Root cause: {from report analysis, if available}
- Recommended fix: {from report, if available}
- Feature docs: Read docs/built/{feature}.md for context

RULES:
- Read the file BEFORE editing — understand the context
- Minimal change — fix the issue, nothing else
- Run `cd webapp && npx tsc --noEmit` after your changes
- If tsc fails from YOUR changes, fix it. If pre-existing, note it.
- Report what you changed: files, lines, what and why
```

After each agent group completes:
1. Read completion signal
2. Stage and commit:
   ```bash
   git add -A
   git commit -m "heal: fix {agent} issues — {brief summary}"
   ```

**If an agent reports it CANNOT fix an issue** (needs architectural change, external dependency, unclear root cause):
- Mark that issue as `deferred` in the heal report
- Do NOT attempt workarounds — a bad fix is worse than no fix
- Deduct confidence points and note the reason

## Phase 5: Quality Gates

Run ALL three gates. Do not skip any.

```bash
cd webapp && npx tsc --noEmit
cd webapp && npx eslint .
cd webapp && npm run build
```

| Gate | Fails | Action |
|------|-------|--------|
| tsc | → spawn ts-expert (max 2 cycles) |
| eslint | → spawn build-fixer (max 2 cycles) |
| build | → spawn build-fixer (max 2 cycles) |

After each fixer cycle, commit:
```bash
git add -A && git commit -m "heal: fix {gate} errors"
```

If gates STILL fail after max cycles → mark confidence as FAILED, stop here, go to Phase 8.

## Phase 6: Test

**6a: Smoke test (mandatory)**
```bash
cd webapp && npm run test:e2e:smoke
```
If smoke fails → confidence -30, continue to capture full picture.

**6b: Targeted tests (based on what was fixed)**
For each feature that had fixes:
```bash
cd webapp && npx playwright test --grep "@{feature-tag}"
```

**6c: Full E2E (if smoke passed)**
```bash
cd webapp && npm run test:e2e
```

Record: total tests, passed, failed, skipped.
Each regression (test that passed on main but fails on heal branch) → confidence -30.

**IMPORTANT:** If tests fail, do NOT try to fix the tests. Tests failing means the fix may have broken something. Record it and let the human decide.

## Phase 7: Re-verify — Prove the Fixes Worked

For each report type that had findings:

| Source | Re-verification |
|--------|----------------|
| sentry | Cannot re-verify locally (production errors). Mark as "fix applied, deploy to verify." |
| security | Run the SPECIFIC security checks from Phase 2 of `/security` that found the issue. Use security-auditor agent to re-check ONLY the fixed files. |
| performance | Run the SPECIFIC perf checks on the fixed files. Use the relevant Phase 2 agent from `/performance`. |
| drift | Run drift checker on the fixed features only. |
| audit | Run `npm audit` again for dependency fixes. |

For each issue:
- **VERIFIED** = re-run no longer finds it
- **UNVERIFIED** = re-run still finds it (fix didn't work) → confidence -40
- **DEPLOY-TO-VERIFY** = can't verify locally (sentry production errors)

## Phase 8: Score Confidence

```
SCORE = 100

# Quality gates
if tsc_failed_and_not_recovered:    SCORE -= 50
if build_failed_and_not_recovered:  SCORE -= 40
if lint_errors_remain:              SCORE -= 15

# Tests
for each regressed_test:            SCORE -= 30

# Verification
for each unverified_fix:            SCORE -= 40
for each deferred_issue:            SCORE -= 10

# Diff analysis
total_lines_changed = $(git diff main --stat | tail -1)
if total_lines_changed > 200:       SCORE -= 10
files_outside_scope = (files changed that weren't in any issue's file list)
for each extra_file:                SCORE -= 10

# Floor at 0
SCORE = max(0, SCORE)
```

| Score | Level | Verdict |
|-------|-------|---------|
| 90-100 | HIGH | Safe to merge |
| 70-89 | MEDIUM | Review the diff, then merge |
| 50-69 | LOW | Manual review required |
| 0-49 | FAILED | Do not merge |

## Phase 9: Write Heal Report

Save to `dev/reports/heal/{YYYY-MM-DD}-heal.md`:

```markdown
# Heal Report — {YYYY-MM-DD}

## Verdict: {LEVEL} ({SCORE}/100)
Branch: `{branch-name}`
Recommendation: {one-line verdict}

## Issues Fixed
| # | Severity | Source | Issue | Agent | Status | Verified |
|---|----------|--------|-------|-------|--------|----------|
| 1 | CRITICAL | sentry | Auth crash | backend | FIXED | DEPLOY-TO-VERIFY |
| 2 | HIGH | security | Missing RLS | db-architect | FIXED | VERIFIED |
| 3 | HIGH | performance | N+1 query | backend | DEFERRED | — |

## Quality Gates
| Gate | Result |
|------|--------|
| tsc --noEmit | PASS / FAIL |
| eslint | PASS / FAIL |
| npm run build | PASS / FAIL |

## Tests
| Suite | Total | Passed | Failed | Regressions |
|-------|-------|--------|--------|-------------|
| Smoke | {n} | {n} | {n} | {n} |
| Targeted | {n} | {n} | {n} | {n} |
| Full E2E | {n} | {n} | {n} | {n} |

## Re-verification
| Issue | Detector | Before | After | Status |
|-------|----------|--------|-------|--------|
| Missing RLS | /security | FOUND | CLEAR | VERIFIED |
| N+1 query | /performance | FOUND | FOUND | UNVERIFIED |

## Diff Summary
- Commits: {n}
- Files changed: {n}
- Lines added: {n}
- Lines removed: {n}
- Files outside original scope: {list or "none"}

## Confidence Breakdown
```
Starting score:            100
tsc:                       {0 or -50}
build:                     {0 or -40}
lint:                      {0 or -15}
test regressions ({n}):    {0 or -N*30}
unverified fixes ({n}):    {0 or -N*40}
deferred issues ({n}):     {0 or -N*10}
large diff:                {0 or -10}
scope creep ({n} files):   {0 or -N*10}
                           ___
FINAL:                     {SCORE}/100 → {LEVEL}
```

## Deferred Issues (needs manual intervention)
{list with reasons, or "None"}

## How to Merge
```bash
git checkout main
git merge {branch-name}
git push origin main
git branch -d {branch-name}
```

## How to Discard
```bash
git checkout main
git branch -D {branch-name}
```
```

## Phase 10: Email Verdict

Build and send email via `scripts/send-report-email.sh`.

**Subject line by confidence level:**

| Level | Subject |
|-------|---------|
| HIGH | "Heal: {N} issues fixed — SAFE TO MERGE (score: {S}/100)" |
| MEDIUM | "Heal: {N} issues fixed — REVIEW RECOMMENDED (score: {S}/100)" |
| LOW | "Heal: {N} issues fixed — NEEDS ATTENTION (score: {S}/100)" |
| FAILED | "Heal: fixes failed — DO NOT MERGE (score: {S}/100)" |

```bash
bash scripts/send-report-email.sh "{subject}" dev/reports/heal/{date}-heal.md
```

## Phase 11: Cleanup

```bash
# Return to main (leave heal branch intact)
git checkout main
```

Move workspace:
```bash
mv dev/active/heal-{date}/ dev/archive/heal-{date}/
```

Present to user:
> **Heal complete — {LEVEL} ({SCORE}/100)**
>
> Branch: `{branch-name}`
> Fixed: {N} issues | Deferred: {N} | Regressions: {N}
>
> {verdict message}
>
> - Review branch: `git log main..{branch-name} --oneline`
> - Review diff: `git diff main..{branch-name}`
> - Merge: `git checkout main && git merge {branch-name}`
> - Discard: `git branch -D {branch-name}`

---

## Error Recovery

| Situation | Action |
|-----------|--------|
| Dirty working tree | ABORT — tell user to commit or stash |
| Existing heal branch | ABORT — tell user to merge or delete it |
| No reports found | EXIT — "No reports. Run /sentry, /security, /performance first." |
| Zero actionable findings | EXIT — "All clear." |
| Agent can't fix an issue | Mark DEFERRED, continue with others |
| Quality gates fail after fixer | Score FAILED, stop fixing, still write report + email |
| Tests regress | Do NOT fix tests. Record regressions, deduct confidence. |
| Git conflict | ABORT heal, return to main, tell user |
| Email fails to send | Log warning, continue (email is nice-to-have) |
