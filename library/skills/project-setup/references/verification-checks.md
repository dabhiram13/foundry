# Verification Checks

Run after setup. Report PASS/FAIL per check.

## 1. Environment File

```
Check: webapp/.env exists
Check: No "TODO" lines remaining
Check: All base vars present (not empty)
Check: .gitignore includes .env
```

**How:** Read the file, grep for TODO, verify each required var has a value.

## 2. Supabase Connection

```
Check: Can list tables via Supabase MCP
Check: Project ID matches AGENTS.md
```

**How:** `mcp supabase list_tables` with project ID from AGENTS.md.
If fails → wrong URL, wrong key, or project paused.

## 3. Git Repo

```
Check: git remote -v shows origin
Check: main branch pushed
```

**How:** `git remote -v` and `git log --oneline -1 origin/main`.

## 4. Vercel Deployment (if deployed)

```
Check: Site URL responds with 200
Check: No build errors
```

**How:** `curl -s -o /dev/null -w "%{http_code}" {SITE_URL}`.
If 500 → check Vercel logs for missing env vars.

## 5. Test Users

```
Check: At least 2 users exist in auth.users
Check: Users documented in dev/test-users.md
```

**How:** Supabase MCP `execute_sql`:
```sql
SELECT id, email, created_at FROM auth.users LIMIT 10;
```

## 6. Stripe (if billing)

```
Check: STRIPE_SECRET_KEY starts with sk_test_ or sk_live_
Check: Products exist matching product-overview.md pricing section
```

**How:** Verify key format. Product check is manual — ask user to confirm.

## 7. Auth Hook (send-email)

```
Check: SEND_EMAIL_HOOK_SECRET is set
Check: Edge function exists
```

**How:** Check env var exists. `mcp supabase list_edge_functions` for send-email.

## 8. Additional Tools

For each tool in external-tools.md:
```
Check: Required env var is set and non-empty
```

**How:** Read .env, match against tool requirements.

## 9. Database Schema (after `/setup supabase` Step 4)

```
Check: every table, function, seed row and bucket the migrations create exists
Check: a fresh JWT carries all six custom claims
```

**How:** Supabase MCP `execute_sql`:

```sql
-- tables (expect all 7)
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('profiles','admins','credits','credit_allocations','credit_balances','credit_ledger','system_email_errors');

-- functions (expect all 6)
SELECT proname FROM pg_proc WHERE proname IN
  ('handle_new_user','update_updated_at','custom_access_token_hook','get_user_plan','consume_credits','refund_credits');

-- consume_credits must be the 5-argument form the middleware calls
SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'consume_credits';
-- expect exactly one row: p_user_id uuid, p_credit_type text, p_cost integer, p_allocation integer, p_period text

-- seed rows — 'free' must be present, or every free user gets error 'no_allocation'
SELECT plan, credit_type, allocation, period FROM public.credit_allocations ORDER BY plan;

-- storage
SELECT id FROM storage.buckets WHERE id = 'avatars';

-- no anon read on the email error log
SELECT policyname, roles FROM pg_policies WHERE tablename = 'system_email_errors';
-- expect authenticated only; an 'anon' row means the insecure policy is back
```

Then sign in as a test user and decode the access token: `name`, `avatar_url`, `plan`, `language`, `onboarding_completed`, `is_admin` must all be present, with `plan = "free"` for a user with no Stripe subscription. Missing claims mean the Custom Access Token hook is not enabled (Step 4.5 of `/setup`).

If `02-billing.sql` and `03-subscriptions-security.sql` were deferred on the Stripe Sync Engine, this check is PARTIAL, not FAIL — the deferral and its reason must be in `dev/active/setup/status.md`.

## Result Format

```markdown
## Verification Results — {date}

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Environment file | PASS/FAIL | |
| 2 | Supabase connection | PASS/FAIL | |
| 3 | Git repo | PASS/FAIL | |
| 4 | Vercel deployment | PASS/FAIL/SKIP | |
| 5 | Test users | PASS/FAIL | |
| 6 | Stripe | PASS/FAIL/SKIP | |
| 7 | Auth hook | PASS/FAIL | |
| 8 | Additional tools | PASS/FAIL/SKIP | |
| 9 | Database schema | PASS/FAIL/PARTIAL | |

**Overall: READY / PENDING ({N} items remaining)**
```
