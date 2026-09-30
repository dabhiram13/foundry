# Step 8: Verify

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Final checks. Everything must pass before this workflow is done.

## Checks

### 1. Build

```bash
cd webapp && npm run build
```

Must pass. Zero errors.

### 2. Type Check

```bash
cd webapp && npx tsc --noEmit
```

Must pass. Zero errors.

### 3. Security Audit

Run Supabase advisors:

```
get_advisors(project_id, type: 'security')
```

Check for:
- [ ] RLS enabled on all user/profile tables
- [ ] No tables without RLS policies
- [ ] No exposed functions that should be locked down

### 4. Hook Permissions

Verify via SQL:

```sql
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'custom_access_token_hook';
```

Expected:
- `supabase_auth_admin` has `EXECUTE`
- `authenticated`, `anon`, `public` do NOT have `EXECUTE`

### 5. JWT Hook Claims Test (Programmatic)

Sign in as the test user via REST API, decode the JWT, verify all custom claims are present.

```bash
# Sign in
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL webapp/.env | cut -d= -f2-)
SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY webapp/.env | cut -d= -f2-)

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.dev","password":"TestPassword123!"}')

# Decode JWT payload
ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2 | tr '_-' '/+' | base64 -d 2>/dev/null)

echo "=== JWT Claims ==="
echo "$PAYLOAD" | python3 -m json.tool

# Verify custom claims exist
for claim in name avatar_url plan language onboarding_completed is_admin; do
  echo "$PAYLOAD" | grep -q "\"$claim\"" && echo "  ✓ $claim" || echo "  ✗ $claim MISSING"
done
```

Expected: all 6 custom claims present. `plan` should be `"free"` (no Stripe subscription). If claims are missing, the hook is not enabled or its grants are wrong — re-run `/setup supabase` Step 4.5 (enable the Custom Access Token hook), or check the GRANT block at the end of `.foundry/migrations/01-base.sql`.

### 6. No Generic Auth Patterns

```bash
grep -rn "getUser\(\)\|getSession\(\)" webapp/features/ webapp/app/ --include="*.tsx" --include="*.ts" | grep -v "middleware\|onboarding" || echo "CLEAN"
```

Should only find usage in middleware and onboarding (which needs `getUser()` for `user_metadata`). `lib/supabase/cached-claims.ts` must use `getClaims()` — NOT `getUser()`.

### 7. No Email Enumeration

```bash
grep -rn "email.*not found\|email.*doesn't exist\|no account\|user not found" webapp/ --include="*.tsx" --include="*.ts" || echo "CLEAN"
```

Must output "CLEAN". All auth errors must be generic.

### 8. Input Validation

Verify all auth procedures use:
- `SecureEmail` (not raw `z.string().email()`)
- `SecurePassword` (not raw `z.string().min(8)`)
- `secureObject` with `.strict()` (not raw `z.object()`)

### 9. Files Exist

- [ ] `webapp/lib/orpc/procedures/auth.ts` — all 8 procedures
- [ ] `webapp/lib/supabase/cached-claims.ts` — `getCachedAuth()`
- [ ] `webapp/lib/auth/utils.ts` — claim reader functions
- [ ] `webapp/lib/supabase/proxy.ts` — `updateSession()`
- [ ] `webapp/features/_shared/components/auth-button.tsx` — session-aware nav
- [ ] `webapp/features/_shared/components/logout-button.tsx` — sign out
- [ ] `webapp/features/_shared/components/turnstile.tsx` — captcha
- [ ] `webapp/app/auth/login/page.tsx` — login page
- [ ] `webapp/app/auth/sign-up/page.tsx` — sign-up page
- [ ] `webapp/app/auth/sign-up-success/page.tsx` — OTP page
- [ ] `webapp/app/auth/forgot-password/page.tsx` — forgot password
- [ ] `webapp/app/auth/update-password/page.tsx` — update password
- [ ] `webapp/app/auth/error/page.tsx` — error page
- [ ] `supabase/functions/send-email/` — edge function (index.ts, templates.ts, types.ts)

### 10. Full Flow Test

Manual or E2E test:

```
1. Visit /auth/sign-up → fill form → submit
2. Check email (or Supabase logs) → get OTP
3. Enter OTP on /auth/sign-up-success → verify
4. Redirected to /onboarding or /protected
5. Visit /auth/login → login with credentials
6. Redirected to /protected
7. Click logout → redirected to /auth/login
8. Visit /auth/forgot-password → enter email
9. Check email → click reset link
10. /auth/update-password → set new password → redirected
```

### 11. Dashboard Manual Steps

Remind the user of things that CANNOT be automated:

- [ ] **JWT Hook**: Supabase Dashboard → Authentication → Hooks → Custom Access Token → Enable
- [ ] **Email Hook**: Supabase Dashboard → Authentication → Hooks → Send Email → Enable → Select `send-email` Edge Function
- [ ] **Turnstile**: Cloudflare Dashboard → create Turnstile widget → copy site key to `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] **Resend**: Set up domain verification + API key → `RESEND_API_KEY` secret on Edge Function

### 12. Update Docs

After all checks pass:
- Update `docs/built/auth.md` to reflect implementation
- Update `.foundry/references/source-docs/supabase/auth.md` if hook claims changed
- Update `db-schema.md` if tables were created/modified

## Done when

All checks pass. Auth workflow is complete.
