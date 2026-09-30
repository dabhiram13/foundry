<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: security
description: Security audit of recent changes. 5 specialized agents scan for RLS gaps, injection, auth bypass, data leakage, and config issues. Feeds into /pentest.
---

# Security Audit

Static security analysis of recent code changes. This report feeds directly into `/pentest` which validates findings with real exploits.

Arguments: `$ARGUMENTS`
- No args = audit changes since last security report (or last 7 days)
- `--days N` = audit changes from last N days
- `--full` = audit entire codebase

---

## Phase 1: Determine scope

Find the last report to scope changes:
```bash
LAST_REPORT=$(ls -t dev/reports/security/*.md 2>/dev/null | head -1)
if [[ -n "$LAST_REPORT" ]]; then
  LAST_DATE=$(basename "$LAST_REPORT" | grep -oP '^\d{4}-\d{2}-\d{2}')
  SINCE="$LAST_DATE"
else
  SINCE="7 days ago"
fi
```

Then get changed files:
```bash
git log --oneline --since="$SINCE" --name-only | grep '^webapp/' | sort -u
```

Categorize into:
- **RLS/DB**: supabase/migrations/**, lib/orpc/procedures/**, db-schema.md
- **Auth**: lib/auth/**, lib/orpc/context.ts, lib/orpc/server.ts, proxy.ts, auth/**
- **API**: lib/orpc/procedures/**, app/api/**
- **Frontend**: app/**/page.tsx, features/**/components/**
- **Config**: next.config.ts, proxy.ts, .env*, package.json

If no webapp files changed, report "No security-relevant changes" and exit.

## Phase 2: Run 5 security-auditor agents (parallel)

Use `subagent_type: "security-auditor"` for ALL 5 agents. This agent has Supabase MCP + Chrome DevTools access for deep verification.

Each agent gets a DIFFERENT prompt and DIFFERENT task (listed below), but they all share the security-auditor identity with its zero-false-positive mandate.

CRITICAL RULES FOR ALL AGENTS:
- Only analyze CHANGED FILES, not the whole codebase
- DO NOT write any files — return findings as text only
- Only report CONFIRMED vulnerabilities — if unsure, SKIP IT
- Each finding needs: file, line, vulnerability type, severity, exploitation scenario, fix

### Agent 1: RLS & Data Access Auditor
```
You audit Row-Level Security and data access patterns.

CHANGED FILES to review: {RLS/DB + API file list}

STEP 1 — Query live database via Supabase MCP (do NOT rely on db-schema.md):

Use mcp__supabase__execute_sql to run these queries:

-- All tables and their RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- All RLS policies with their definitions
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- All SECURITY DEFINER functions (potential RLS bypass)
SELECT n.nspname, p.proname, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true;

-- Tables with user_id column (should have RLS)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'user_id';

STEP 2 — Cross-reference live DB state with changed code files:

CHECK:
1. Tables with user_id column but rowsecurity = false — CRITICAL
2. RLS policies that do NOT reference auth.uid() on user-data tables — HIGH
3. SECURITY DEFINER functions — verify they validate auth internally
4. Procedures in changed files that use admin client — is it ONLY for Inngest/storage?
5. Procedures returning data — could user A see user B's data through any query path?
6. New migrations adding tables — did they enable RLS and add policies?

FALSE POSITIVES — do NOT report:
- Admin client in Inngest functions or migration scripts (correct usage)
- Storage signed URLs via admin client in oRPC (correct — storage needs admin for private buckets)
- Public tables (ideas, idea_categories) without user_id RLS — they are intentionally public
- getUser() for user_metadata access — documented exception
- Tables in stripe schema (managed by Stripe sync engine, not user-facing)

Severity guide:
- CRITICAL: Table with user data and RLS disabled, admin client in client-reachable code
- HIGH: RLS policy missing auth.uid() filter, IDOR-possible query
- MEDIUM: Overly permissive SELECT policy, SECURITY DEFINER without internal auth check
- LOW: Missing column restrictions on non-sensitive data
```

### Agent 2: Injection & Input Validation Auditor
```
You audit for injection vulnerabilities and input validation gaps. ONLY check these changed files:
{API file list}

CHECK:
1. SQL injection — any raw SQL or string interpolation in queries? (.rpc() params, .filter(), .or())
2. Zod validation — do ALL procedure inputs have Zod schemas? Any .passthrough() or .any()?
3. XSS vectors — user-supplied content rendered without sanitization? (raw HTML insertion, unescaped output)
4. Path traversal — file paths constructed from user input? (storage keys, download paths)
5. NoSQL injection — any unvalidated JSON passed to Supabase .filter() or .or()?
6. Template injection — user input in email templates, MDX, or dynamic components?

FALSE POSITIVES — do NOT report:
- Supabase client library handles SQL parameterization automatically for .eq(), .in(), .match()
- Zod schemas with .transform() are fine — they validate THEN transform
- Markdown/MDX content rendered via established libraries (next-mdx-remote) with no custom plugins
- oRPC error messages that include the input field name (not the value)

Severity guide:
- CRITICAL: Raw SQL with string interpolation
- HIGH: Missing Zod validation on mutation, XSS in user-generated content
- MEDIUM: Overly permissive Zod schema (.passthrough()), missing length limits
- LOW: Missing input sanitization on display-only fields
```

### Agent 3: Auth & Session Auditor
```
You audit authentication and session management. ONLY check these changed files:
{Auth + API file list}

Read lib/orpc/server.ts and lib/orpc/context.ts for auth middleware patterns.

CHECK:
1. Protected routes without auth middleware — any procedure using publicProcedure that should be protected?
2. Auth bypass — can any protected endpoint be called without valid session?
3. JWT handling — any manual JWT parsing that could be bypassed? (should use getClaims())
4. Session fixation — is session rotated after login/privilege change?
5. OAuth callback — state parameter validated? Redirect URL validated against allowlist?
6. Password reset — token single-use? Token expiry enforced?
7. Role/plan checks — any procedure that checks user role/plan from client-supplied data instead of JWT claims?

FALSE POSITIVES — do NOT report:
- getClaims() is the correct auth pattern (zero round-trip JWT read) — not a weakness
- getUser() for user_metadata in onboarding — documented exception
- Public procedures (ideas list, public content) are intentionally unauthenticated
- Supabase handles session rotation internally on auth.signIn()
- Rate limiting via MemoryRatelimiter is fine for dev — only flag if claiming production-ready

Severity guide:
- CRITICAL: Auth bypass on mutation endpoint, privilege escalation
- HIGH: Missing auth on data-access endpoint, role check from client data
- MEDIUM: Missing rate limit on auth endpoints, weak password policy
- LOW: Session expiry too long, missing re-auth for sensitive operations
```

### Agent 4: Data Leakage & Privacy Auditor
```
You audit for data leakage and privacy issues. ONLY check these changed files:
{API + Frontend file list}

CHECK:
1. API responses — do any return more data than the client needs? (extra columns, other users data)
2. Error messages — do any expose internal details? (stack traces, SQL errors, file paths, env vars)
3. Client-side secrets — any API keys, tokens, or secrets in client components or browser-accessible code?
4. Logging — any sensitive data logged? (passwords, tokens, PII in console.log)
5. URL params — any sensitive data in URL query strings? (tokens, emails, user IDs)
6. Cache leakage — could cached responses serve user A data to user B? (missing use cache: private)
7. Source maps — enabled in production? Could expose source code?

FALSE POSITIVES — do NOT report:
- NEXT_PUBLIC_* env vars are intentionally public (Supabase anon key, Turnstile site key)
- Users own email/name shown in their profile is not data leakage
- oRPC error messages with error codes (not internal details) are fine
- Sentry capturing errors with sanitized context is fine
- Public idea data (names, descriptions, categories) is intentionally public

Severity guide:
- CRITICAL: Secrets in client code, other users PII in API response
- HIGH: Stack traces in production errors, sensitive data in URL params
- MEDIUM: Overly verbose error messages, missing private on user-specific cache
- LOW: Console.log with non-sensitive debug info, source maps in dev only
```

### Agent 5: Config & Infrastructure Auditor
```
You audit security configuration and infrastructure. ONLY check these changed files:
{Config file list + proxy.ts + next.config.ts}

CHECK:
1. CSP headers — Content-Security-Policy restrictive enough? No unsafe-inline/unsafe-eval in production?
2. CORS — any overly permissive Access-Control-Allow-Origin?
3. Cookie flags — httpOnly, secure, SameSite on auth cookies?
4. HTTPS enforcement — any http:// URLs in production config?
5. Dependency vulnerabilities — run npm audit in webapp/, report critical/high only
6. Environment variables — any secrets with weak/default values? Any missing from .env.example?
7. Headers — X-Frame-Options, X-Content-Type-Options, Referrer-Policy set?
8. Public paths — any protected routes accidentally added to public path list in proxy.ts?

FALSE POSITIVES — do NOT report:
- unsafe-eval in CSP if required by a specific library (e.g. some MDX runtimes) — flag but as Low with context
- http://localhost URLs in dev config — only flag http:// in production config
- npm audit LOW/MODERATE vulnerabilities in dev dependencies
- Missing HSTS header — handled by Vercel/hosting platform, not Next.js
- SameSite=Lax on Supabase auth cookies — this is Supabase default and is correct

Severity guide:
- CRITICAL: Secrets in client bundle, wildcard CORS in production, missing auth on API route
- HIGH: Weak CSP allowing script injection, protected route in public paths list
- MEDIUM: Missing security headers, npm audit HIGH vulnerability
- LOW: npm audit MODERATE, overly permissive but not exploitable CSP directive
```

Spawn all 5 in parallel. Each returns text findings ONLY — no file writes.

## Phase 3: Consolidate report

The orchestrator reads all 5 agent outputs and writes ONE report:

```markdown
# Security Report — {YYYY-MM-DD}

## Summary
Scope: changes since {last report date or N days}
Files analyzed: {count}
Status: {PASS | WARN | FAIL}

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| RLS & Data Access | {N} | {N} | {N} | {N} |
| Injection & Validation | {N} | {N} | {N} | {N} |
| Auth & Session | {N} | {N} | {N} | {N} |
| Data Leakage | {N} | {N} | {N} | {N} |
| Config & Infrastructure | {N} | {N} | {N} | {N} |

## Findings

### [CRITICAL] {title}
- **Category:** {RLS / Injection / Auth / Leakage / Config}
- **File:** {path}:{line}
- **Vulnerability:** {description}
- **Exploitation:** {how an attacker would exploit this}
- **Fix:** {specific remediation}

### [HIGH] ...

### [MEDIUM] ...

## Dependency Vulnerabilities
{npm audit critical/high results, if any}

## Recommendations
{Top 5 prioritized fixes}
```

Save to: `dev/reports/security/{YYYY-MM-DD}-security.md`

## Phase 4: Alert + Present

ALWAYS run the email script after writing the report:
```bash
bash scripts/send-report-email.sh "Security Report" dev/reports/security/{YYYY-MM-DD}-security.md
```
The script skips silently if ADMIN_EMAIL or RESEND_API_KEY are not set.

Present summary to user. If Critical or High findings exist, recommend running /pentest to validate with real exploits.
