<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: performance
description: Performance audit. Checks pages and API calls against best practice skills (Vercel React, Supabase Postgres, oRPC, Next.js, caching). Analyzes recent git changes. Writes report.
---

# Performance Audit

Audit code quality and performance patterns against our best practice skills.

Arguments: `$ARGUMENTS`
- No args = audit changes from last 4 days
- `--days N` = audit changes from last N days
- `--full` = audit entire codebase

---

## Phase 1: Determine scope

```bash
DAYS=${days:-4}
git log --oneline --since="$DAYS days ago" --name-only | sort -u
```

Categorize changed files:
- **Pages/components** (webapp/app/**, webapp/features/**/components/**)
- **Data layer** (data.ts, hooks, oRPC client calls)
- **API procedures** (webapp/lib/orpc/procedures/**)
- **Database** (supabase/migrations/**, db-schema.md)
- **Config** (next.config.ts, tailwind.config.ts, package.json)

## Phase 2: Run audits (3 parallel agents)

### Agent 1: Frontend Performance
```
You are auditing frontend performance. Read these skill references FIRST:

1. library/skills/vercel-react-best-practices/references/INDEX.md — then read the referenced files
2. library/skills/next-best-practices/SKILL.md
3. library/skills/next-best-practices/references/next-cache-components/SKILL.md

CHANGED FILES: {frontend file list}

Check each file against these patterns:

**Rendering:**
- Server components used by default? ("use client" only on lowest leaf?)
- Any useEffect for data fetching? (BANNED — use server components or "use cache")
- Client components receiving server data as props? (good) or fetching on mount? (bad)
- Key prop on lists? Dynamic imports for heavy components?

**Data Fetching:**
- "use cache" + cacheLife + cacheTag on data functions?
- initialData passed to useQuery? (no loading spinners for server-fetchable data)
- Promise.all for parallel fetches?
- Any waterfall patterns? (sequential awaits that could be parallel)

**Bundle:**
- Large client-side imports? (date-fns, lodash — should be server-side or tree-shaken)
- Dynamic imports for below-fold content?
- Image optimization (next/image, proper sizes/priority)?

**Caching:**
- PPR-ready? (static shell + dynamic holes)
- Cache tags for invalidation?
- Appropriate cacheLife tiers?

IMPORTANT — False positive rules (do NOT report these):
- getUser() for user_metadata access (Google OAuth full_name) is a DOCUMENTED EXCEPTION — not a violation
- Context initialization patterns (e.g. `undefined as unknown as Type` in middleware setup) are acceptable
- useEffect for scroll/resize/intersection observers is fine — only ban useEffect for DATA FETCHING
- Realtime subscriptions (Supabase realtime, WebSocket) in useEffect are acceptable

Only report CONFIRMED violations. If unsure, skip it.

DO NOT write any files. Return your findings as text only. The orchestrator writes the report.

Report each finding with: file, line, pattern violated, severity, fix.
```

### Agent 2: Backend Performance
```
You are auditing backend performance. Read these skill references FIRST:

1. library/skills/supabase-postgres-best-practices/references/INDEX.md — then read referenced files
2. library/skills/orpc-fullstack/references/ (if exists, or SKILL.md)

CHANGED FILES: {backend file list}

Check each file against these patterns:

**Database:**
- Missing indexes on frequently queried columns?
- N+1 query patterns? (fetching in loops)
- SELECT * instead of selecting specific columns?
- Missing pagination on list endpoints?
- Expensive JOINs that could be materialized views?

**oRPC Procedures:**
- Input validation with Zod? (all inputs validated?)
- Proper error handling? (oRPC errors, not raw throws)
- Middleware chain correct? (auth → rate limit → handler)
- Response shape minimal? (no extra data sent)

**Supabase:**
- RLS policies using indexed columns? (auth.uid() = user_id where user_id is indexed?)
- Connection pooling considered for high-traffic endpoints?
- Realtime subscriptions cleaned up?

**Background Jobs (Inngest):**
- Steps properly isolated? (each step.run is idempotent?)
- Admin client created inside step.run, not shared?
- Proper concurrency limits set?

IMPORTANT — False positive rules (do NOT report these):
- getUser() for user_metadata access (Google OAuth full_name) is a DOCUMENTED EXCEPTION — not a violation
- getSession() in a procedure that explicitly RETURNS session data is correct usage
- In-memory rate limiters are fine for dev — only flag if code claims production-ready
- Admin client created inline in oRPC procedures for storage/trusted ops is correct pattern

Only report CONFIRMED violations. If unsure, skip it.

DO NOT write any files. Return your findings as text only. The orchestrator writes the report.

Report each finding with: file, line, pattern violated, severity, fix.
```

### Agent 3: Architecture Compliance
```
You are auditing architecture compliance against project rules.

Read: AGENTS.md (the project rules)

CHANGED FILES: {all changed files}

Check:
- No "any" types, no @ts-ignore, no "as unknown as X"
- No useEffect for data fetching
- No service role in client code
- Server components by default (no unnecessary "use client")
- oRPC client NOT used server-side for protected procedures
- nuqs for URL state (not useState for filters/tabs/modals)
- Proper import paths (no circular dependencies)
- No hardcoded colors (semantic tokens only)
- shadcn components not overwritten

IMPORTANT — False positive rules (do NOT report these as violations):
- getUser() when accessing user_metadata (e.g. Google OAuth full_name) — DOCUMENTED EXCEPTION in AGENTS.md
- `undefined as unknown as Type` in middleware/context initialization — acceptable pattern for pre-auth context
- "use client" on leaf components that genuinely need interactivity — only flag "use client" on PAGE files
- `as any` in third-party library interop (e.g. OGL, WebGL) where types don't exist — flag but as Low only
- Hardcoded colors in SVG illustrations/logos are fine — only flag in component styles

Only report CONFIRMED violations. If a pattern has a documented exception, it is NOT a violation.

DO NOT write any files. Return your findings as text only. The orchestrator writes the report.

Report violations with: file, line, rule violated, severity, fix.
```

Spawn all 3 in parallel.

## Phase 3: Consolidate report

```markdown
# Performance Report — {YYYY-MM-DD}

## Summary
Scope: {last N days / full}
Files analyzed: {count}
Status: {PASS | WARN | FAIL}

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Frontend | {N} | {N} | {N} | {N} |
| Backend | {N} | {N} | {N} | {N} |
| Architecture | {N} | {N} | {N} | {N} |

## Frontend Performance
{Agent 1 findings}

## Backend Performance
{Agent 2 findings}

## Architecture Compliance
{Agent 3 findings}

## Top Recommendations
{5 highest-impact fixes}
```

Save to: `dev/reports/performance/{YYYY-MM-DD}-performance.md`

## Phase 4: Alert + Present

ALWAYS run the email script after writing the report:
```bash
bash scripts/send-report-email.sh "Performance Report" dev/reports/performance/{YYYY-MM-DD}-performance.md
```
The script skips silently if ADMIN_EMAIL or RESEND_API_KEY are not set.

Present summary to user.
