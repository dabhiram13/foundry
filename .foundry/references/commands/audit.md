<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: audit
description: Dependency and code quality audit. Checks for outdated packages, unused dependencies, dead code, and code health metrics. Writes report.
---

# Code Audit

Audit dependencies, code quality, and overall health.

Arguments: `$ARGUMENTS`
- No args = full audit
- `--deps-only` = only dependency check
- `--code-only` = only code quality check

---

## Phase 1: Dependency Audit

```bash
cd webapp

# Check for vulnerabilities
npm audit --json 2>/dev/null

# Check for outdated packages
npm outdated --json 2>/dev/null

# Check package.json for unused deps
# (compare against actual imports)
```

For each outdated package, categorize:
- **Critical update** — major security fix or breaking change in current version
- **Recommended update** — new features, performance improvements
- **Optional update** — minor version bumps, cosmetic

For each vulnerability:
- Severity (critical/high/medium/low)
- Package name + path
- Fix available? (`npm audit fix` or manual update needed?)

## Phase 2: Code Quality Audit

Spawn an Explore agent to analyze:

```
Scan the webapp/ codebase for code health:

1. **Dead code**
   - Exported functions/components never imported anywhere
   - Files in features/ not referenced by any page or route
   - Unused CSS classes or Tailwind utilities (if detectable)
   - Commented-out code blocks (>5 lines)

2. **Code duplication**
   - Similar component patterns repeated across features
   - Duplicated utility functions
   - Copy-pasted API call patterns

3. **Type safety**
   - Run: npx tsc --noEmit 2>&1 | head -50
   - Count type errors
   - Identify patterns (missing types, implicit any)

4. **Lint health**
   - Run: npx eslint . --format json 2>/dev/null | head -100
   - Count and categorize warnings/errors

5. **Bundle size concerns**
   - Large dependencies in package.json
   - Client-side imports of heavy libraries
   - Missing dynamic imports for large components

6. **Test coverage**
   - Count test files: webapp/tests/**/*.spec.ts
   - List features with NO tests
   - List features with tests

7. **Documentation freshness**
   - Compare docs/built/*.md timestamps vs actual code changes
   - Flag docs that may be stale

IMPORTANT — False positive rules (do NOT report these):
- Design test files (features/_design-test/*) are temporary by nature — not dead code
- Barrel exports (index.ts re-exports) are not duplication
- Components only used in one page are NOT dead code — they're feature-scoped
- Third-party type issues (e.g. missing @types/) are not "type safety" violations — they're dependency issues
- Test files and config files are exempt from lint/type checks

Only report CONFIRMED findings. If unsure, skip it.

DO NOT write any files. Return your findings as text only. The orchestrator writes the report.

Report everything with counts and file lists.
```

## Phase 3: Consolidate report

```markdown
# Audit Report — {YYYY-MM-DD}

## Summary
Status: {PASS | WARN | FAIL}

## Dependencies
### Vulnerabilities
| Severity | Package | Version | Fix Available |
|----------|---------|---------|---------------|
| {sev} | {name} | {ver} | {yes/no} |

### Outdated Packages
| Package | Current | Latest | Type | Priority |
|---------|---------|--------|------|----------|
| {name} | {cur} | {lat} | {dep/dev} | {critical/recommended/optional} |

## Code Quality
### Dead Code: {count} items
{list}

### Duplication: {count} patterns
{list}

### Type Safety
- tsc errors: {count}
- Top patterns: {list}

### Lint Health
- Errors: {count}
- Warnings: {count}

### Bundle Concerns
{list}

### Test Coverage
- Features with tests: {count}/{total}
- Features without tests: {list}

### Doc Freshness
- Potentially stale: {list}

## Recommendations
{Prioritized action list — what to fix first}
```

Save to: `dev/reports/audit/{YYYY-MM-DD}-audit.md`

## Phase 4: Alert + Present

ALWAYS run the email script after writing the report:
```bash
bash scripts/send-report-email.sh "Audit Report" dev/reports/audit/{YYYY-MM-DD}-audit.md
```
The script skips silently if ADMIN_EMAIL or RESEND_API_KEY are not set.

Present summary to user.
