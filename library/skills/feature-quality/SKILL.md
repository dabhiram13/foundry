---
name: feature-quality
description: >
  Quality gates for a feature. Runs code gates (tsc, lint, build), API tests,
  architecture compliance, visual smoke test, and performance audit. Produces quality-report.md.
  Use for "quality check", "run quality gates", "feature quality", "check feature".
---

# Feature Quality

Automated quality gates for a completed feature. Runs after the backend and frontend build agents.
Produces `dev/active/{feature}/quality-report.md`. Does NOT commit, archive, or sync docs.

## Inputs
- **feature**: Feature name (e.g., `posts`, `billing`, `notifications`)

## Pre-flight
1. Read `dev/active/{feature}/foundation.md` — project rules
2. Read `dev/active/{feature}/tasks.md` — verify all tasks checked
3. Read `dev/active/{feature}/context.md` — verify no blockers

## Execution

### 1. Code Gates

Run all three in sequence. All must pass.

```bash
cd webapp && npx tsc --noEmit
```
**Must pass with zero errors.**

```bash
cd webapp && npx eslint .
```
**Must pass with zero errors.** Warnings are acceptable but should be minimized.

```bash
cd webapp && npm run build
```
**Must pass.** Catches SSR/RSC boundary errors, missing imports, `'use client'` violations, dynamic import failures, invalid metadata exports.

If any gate fails → fix the code (up to 3 attempts per gate), re-run.

### 2. API Tests

```bash
cd webapp && npx playwright test tests/e2e/{feature}-api.spec.ts --reporter=list
```
**All API tests must pass.** If the file doesn't exist, note it as a gap in the quality report.

### 3. Architecture Compliance

Verify manually:
- [ ] No circular dependencies between features
- [ ] Forward dependencies only (Types → Config → Repo → Service → Runtime → UI)
- [ ] Feature code lives in `webapp/features/{feature}/`
- [ ] Procedures live in `webapp/lib/orpc/procedures/{feature}.ts`
- [ ] Page lives in `webapp/app/protected/{feature}/page.tsx`

### 4. User Journey Smoke Test (agent-browser)

The code checks above prove correctness. This step proves the **experience** works.

**Dev server check:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || true
```
If not running:
```bash
cd webapp && npm run dev &
npx wait-on http://localhost:3000 --timeout 60000
```

**4a. Login:**
```bash
npx agent-browser@0.15.0 open http://localhost:3000/auth/login
npx agent-browser@0.15.0 fill '#email' 'test@example.com'
npx agent-browser@0.15.0 fill '#password' '12345678'
npx agent-browser@0.15.0 click 'button[type="submit"]'
npx agent-browser@0.15.0 wait 2000
```

**4b. Walk the primary user journey:**

Read the Feature Brief in `dev/active/{feature}/plan.md` → Core Flows section. Then:

1. Navigate to the feature page:
   ```bash
   npx agent-browser@0.15.0 open http://localhost:3000/protected/{feature}
   npx agent-browser@0.15.0 wait 2000
   npx agent-browser@0.15.0 screenshot /tmp/e2e-{feature}-landing.png
   ```

2. Exercise the core flow — use `snapshot` to find selectors:
   ```bash
   npx agent-browser@0.15.0 snapshot
   npx agent-browser@0.15.0 click '{selector}'
   npx agent-browser@0.15.0 fill '{selector}' '{value}'
   npx agent-browser@0.15.0 screenshot /tmp/e2e-{feature}-step-N.png
   ```

3. Test navigation to/from adjacent features.

4. Screenshot at mobile viewport:
   ```bash
   npx agent-browser@0.15.0 viewport 375 812
   npx agent-browser@0.15.0 screenshot /tmp/e2e-{feature}-mobile.png
   npx agent-browser@0.15.0 viewport 1280 720
   ```

**4c. Review all screenshots** (use Read tool). Check:
- [ ] Pages load with real data (not stuck on skeleton/loading)
- [ ] Navigation between features works (no dead links, no 404s)
- [ ] Layout is intact at desktop and mobile
- [ ] No visual regressions on adjacent pages

**4d. Record findings:**
- Blocking issues (page doesn't load, flow broken) → fix the code, re-test
- Cosmetic issues (spacing, alignment) → log in quality report, don't block

---

### 5. Performance Audit

**5a. Bundle size check** (from `npm run build` output in step 1):

| Asset | Budget (gzipped) |
|-------|-----------------|
| Initial JS | <150KB |
| Per-route JS | <50KB |
| Total JS | <300KB |
| Initial CSS | <50KB |

Flag any route that exceeds its budget.

**5b. Lighthouse audit:**
```bash
npx lighthouse http://localhost:3000/protected/{feature} \
  --output=json --output-path=/tmp/lighthouse-{feature}.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance \
  --quiet
```

Extract key metrics:
```bash
node -e "
  const r = require('/tmp/lighthouse-{feature}.json');
  const a = r.audits;
  console.log('Performance Score:', r.categories.performance.score * 100);
  console.log('LCP:', a['largest-contentful-paint'].displayValue);
  console.log('FCP:', a['first-contentful-paint'].displayValue);
  console.log('CLS:', a['cumulative-layout-shift'].displayValue);
  console.log('TBT:', a['total-blocking-time'].displayValue);
"
```

**Thresholds (warn, don't block):**

| Metric | Target | Fail |
|--------|--------|------|
| Performance Score | >80 | <50 |
| LCP | <2.5s | >4s |
| CLS | <0.1 | >0.25 |
| TBT | <200ms | >600ms |

**5c. If Lighthouse fails to run:** skip gracefully, note in quality report.

---

### 6. Quality Report

Write `dev/active/{feature}/quality-report.md`:

```markdown
# Quality Report — {feature}

## Date: {YYYY-MM-DD}

## Code Gates
| Gate | Status |
|------|--------|
| tsc --noEmit | PASS/FAIL |
| eslint | PASS/FAIL |
| npm run build | PASS/FAIL |
| API Tests | PASS/FAIL/NO FILE |
| Architecture | PASS/FAIL |

## User Journey Smoke Test
- **Flow tested:** {description of the journey}
- **Screenshots:** /tmp/e2e-{feature}-*.png
- **Cross-feature navigation:** PASS/FAIL — {details}
- **Mobile layout:** PASS/FAIL — {details}

### Findings
- {finding 1 — severity: high/medium/low}
(or "No issues found")

## Performance
- **Performance Score:** {score}/100
- **LCP:** {value} (target: <2.5s)
- **CLS:** {value} (target: <0.1)
- **TBT:** {value} (target: <200ms)
- **Bundle:** Initial JS {X}KB / Per-route {X}KB (budgets: 150KB / 50KB)

### Recommendations
- {recommendation 1}
(or "All metrics within target")

## Overall
{1-2 sentence summary}
```

---

## Error Recovery

**Fixable (handle yourself, up to 3 attempts per issue):**
- `tsc --noEmit` fails → fix type errors, re-run
- Lint errors → fix them, re-run
- `npm run build` fails → fix build errors, re-run
- Test failures → fix the test or code, re-run
- agent-browser login fails → verify dev server, check selectors, retry
- Lighthouse fails → skip gracefully, note in quality report

**Quality gate failure after fix attempts:**
- Document all failures in quality-report.md
- Update `dev/active/{feature}/context.md` with failure details
- Signal completion with failures logged — next step (code-review) still runs

**Blocking:**
- `dev/active/{feature}/` doesn't exist → previous tasks didn't run, report error via mail to parent
- Playwright won't start (test infrastructure broken) → report error via mail to parent

## Progress Reporting

Append to `dev/active/{feature}/progress.md`:

```markdown
## Step: quality ({date})
### Done
- Code gates: tsc {PASS/FAIL}, lint {PASS/FAIL}, build {PASS/FAIL}
- API tests: {PASS/FAIL/NO FILE}
- Architecture: {PASS/FAIL}
- Smoke test: {PASS/FAIL}
- Performance: score {N}/100, LCP {X}s
### Learnings
- {any findings from quality gates}
### Warnings
- {failed gates or performance issues, or "None"}
```

## Completion Rule

Do NOT signal completion until:
- [ ] progress.md updated with quality step summary
- [ ] All 6 steps executed (pass or documented failure)
- [ ] `dev/active/{feature}/quality-report.md` written with all gate results
- [ ] Blocking issues fixed or documented
- [ ] context.md updated with quality phase status
