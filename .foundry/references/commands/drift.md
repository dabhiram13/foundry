<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: drift
description: Pattern drift detection. Compares recent features against established patterns to catch inconsistencies before they compound. Run after every 3 features or manually.
---

# Drift Detection

Checks the last N built features for pattern divergence. Catches subtle inconsistencies that compound across features — wrong data fetching patterns, inconsistent component structure, divergent naming, stale docs/built/ references.

Arguments: `$ARGUMENTS`
- No args = check last 3 features
- `--all` = check all built features
- `--feature <name>` = check one specific feature

---

## Phase 1: Load Baselines

Read the established patterns (the "truth"):

1. `AGENTS.md` — project rules (RSC default, no useEffect for data, etc.)
2. `.foundry/references/source-docs/patterns/backend/INDEX.md` → read each pattern file
3. `.foundry/references/source-docs/patterns/frontend/INDEX.md` → read each pattern file
4. `docs/built/*.md` — all feature references (for cross-feature consistency)
5. `db-schema.md` — current schema

---

## Phase 2: Identify Features to Check

Read `roadmap.json`. Find the last N features with `"status": "done"`.
For each, read `docs/built/{feature}.md` to get the key files list.

---

## Phase 3: Spawn Drift Checker Agent

Spawn ONE agent (quality-gate type) with this prompt:

```
You are a drift detector. Your job is to find where recent features deviate from established patterns — NOT bugs, but inconsistencies that will compound.

BASELINES (the patterns that should be followed):
{paste pattern summaries}

FEATURES TO CHECK:
{list of features + their key files from docs/built/}

For each feature, read the key files and check:

## Data Fetching Drift
- Server components fetching data correctly? (createClient() for protected, "use cache" for public)
- No useEffect for initial data fetch?
- initialData passed to useQuery when TanStack is used?
- No oRPC client.protected.* calls from server components?

## Component Structure Drift
- "use client" on lowest leaf, not high up the tree?
- Server components by default?
- Design tokens used (not raw Tailwind colors like text-red-500)?
- Consistent file organization (features/{name}/components/, lib/, hooks/)?

## Backend Pattern Drift
- oRPC procedures follow the pattern? (Zod input, proper context usage)
- RLS policies on new tables?
- Migrations follow naming convention?
- Inngest functions use createAdminClient() inside step.run()?

## Naming Drift
- Consistent naming across features? (e.g., all use kebab-case files, or all use camelCase)
- oRPC procedure names consistent? (verb.noun pattern, or noun.verb?)
- Component naming consistent?

## docs/built/ Accuracy
- Do the key files listed in docs/built/{feature}.md actually exist?
- Are the descriptions still accurate? (spot-check 2-3 files per feature)

## Cross-Feature Consistency
- Do similar features handle loading/error/empty states the same way?
- Are shared utilities duplicated across features instead of reused?
- Are there near-duplicate components that should be merged?

OUTPUT FORMAT:

# Drift Report — {date}

## Summary
- Features checked: {N}
- Drift issues found: {count}
- Severity: {none | low | medium | high}

## Issues

### {Issue title}
- **Feature:** {which feature}
- **File:** {file path}
- **Pattern violated:** {which baseline pattern}
- **What's wrong:** {concrete description}
- **Fix:** {specific fix — file + what to change}
- **Severity:** low | medium | high
  - low = cosmetic inconsistency, no functional impact
  - medium = wrong pattern that works now but will cause issues as codebase grows
  - high = actively broken pattern (e.g., missing RLS, server-side oRPC client misuse)

## Recommendations
- {Any refactoring suggestions for patterns that have drifted across 3+ features}
```

---

## Phase 4: Write Report

Save to `dev/reports/drift/{YYYY-MM-DD}-drift.md`.

Present summary to user:

> **Drift Report: {N} features checked**
>
> | Severity | Count |
> |----------|-------|
> | High | {n} |
> | Medium | {n} |
> | Low | {n} |
>
> {Top 3 issues, one line each}
>
> Full report: `dev/reports/drift/{date}-drift.md`
>
> **Options:**
> 1. **Fix highs now** — I'll fix high-severity drift issues
> 2. **Fix all** — I'll fix everything in the report
> 3. **Noted** — I'll keep building, fix later

If user chooses to fix: triage each issue as a bug-fix, spawn appropriate agents.

---

## Error Recovery

**Fixable:** docs/built/ file references missing files → flag as high-severity drift (stale docs)
**Fixable:** Feature has no docs/built/ entry → flag as high-severity (incomplete complete agent run)
**Fixable:** Pattern file doesn't exist → skip that baseline, note in report
