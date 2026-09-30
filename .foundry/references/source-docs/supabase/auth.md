# Authentication & RBAC System

Supabase Auth + Custom Access Token Hook + ORPC procedures + Cloudflare Turnstile.

---

## Architecture

```
User submits form (login/signup)
  → Turnstile captcha verified client-side
  → ORPC procedure called (type-safe, rate-limited)
  → Supabase Auth verifies credentials
  → BEFORE issuing JWT: calls custom_access_token_hook(event)
  → Hook queries profiles + admins, and get_user_plan() over stripe.*
  → Injects 6 custom claims into JWT (see jwt.md)
  → JWT stored in httpOnly secure cookie
  → Every subsequent request reads claims from JWT (zero DB queries)
```

---

## Sign-Up Flow

```
/auth/sign-up → SignUpForm (client component)
  → orpc.auth.signUp({ email, password, captchaToken })
  → supabase.auth.signUp() with Turnstile token
  → Supabase triggers send-email Edge Function (webhook)
  → Resend API delivers branded OTP email
  → Redirect to /auth/sign-up-success?email=...
```

| Step | Detail |
|------|--------|
| Fields | email, password, repeat password |
| Captcha | Cloudflare Turnstile (`@marsidev/react-turnstile`) |
| Validation | Zod: `SecureEmail`, `SecurePassword`, client-side password match |
| ORPC call | `orpc.auth.signUp` → `supabase.auth.signUp()` |
| Response | `{ success, user: { id, email }, requiresEmailConfirmation }` |
| Session | NOT returned in body — set via httpOnly cookies by Supabase SSR |
| Redirect | `/auth/sign-up-success?email={encoded}` |

### OTP Verification (`/auth/sign-up-success`)

```
User enters 8-digit OTP from email
  → Auto-submits when 8 digits entered
  → orpc.auth.verifyOtp({ email, token, type: "signup" })
  → supabase.auth.verifyOtp()
  → On success: redirect to /onboarding
```

| Feature | Detail |
|---------|--------|
| OTP length | 8 digits |
| Auto-submit | Yes, on complete input |
| Resend | `orpc.auth.resendVerification` with cooldown timer |
| Email source | URL param → localStorage fallback |
| PPR | CachedUI (static shell) + DynamicContent (streaming) |

---

## Login Flow

```
/auth/login → LoginForm (client component)
  → orpc.auth.signIn({ email, password, captchaToken })
  → supabase.auth.signInWithPassword()
  → custom_access_token_hook fires → JWT with claims
  → Redirect to savedRedirect || /protected
```

| Step | Detail |
|------|--------|
| Fields | email, password |
| Captcha | Cloudflare Turnstile |
| ORPC call | `orpc.auth.signIn` → `supabase.auth.signInWithPassword()` |
| Error msg | Generic "Invalid email or password" (prevents enumeration) |
| Redirect | `redirectTo` prop → `sessionStorage.redirectAfterLogin` → `/protected` |
| Invitation | Pre-fills email from `invitationEmail` prop |

---

## Password Reset Flow

```
/auth/forgot-password → orpc.auth.requestPasswordReset({ email })
  → supabase.auth.resetPasswordForEmail(email, { redirectTo })
  → Email with reset link/code sent via send-email Edge Function
  → /auth/update-password → orpc.auth.updatePassword({ password })
  → supabase.auth.updateUser({ password })
```

Always returns success (prevents email enumeration).

---

## Send-Email Edge Function

Supabase webhook-triggered Deno function. Replaces default Supabase emails with branded templates via **Resend API**.

| Config | Value |
|--------|-------|
| Runtime | Deno (Supabase Edge Function) |
| Trigger | Supabase Auth webhook (standardwebhooks) |
| Email provider | Resend API |
| From | `{App Name} <noreply@{your-domain}>` — set in the function |
| Verification | `standardwebhooks` signature via `SEND_EMAIL_HOOK_SECRET` |
| Retry | 3 attempts, exponential backoff (max 10s) |

### Supported Email Types

| Type | Subject | Content |
|------|---------|---------|
| `signup` | Welcome to {App} - Verify Your Email | OTP code (monospace, 10min expiry) |
| `recovery` | Reset Your {App} Password | Button + OTP fallback |
| `magiclink` | Your {App} Magic Link | Button + OTP fallback |
| `invite` | You're Invited to Join {App} | Accept button + code |
| `email_change` | Confirm Your Email Change | Both old + new email codes |
| `email_change_new` | Verify Your New Email Address | Button + code |
| `reauthentication` | Confirm Your Identity | OTP code (10min expiry) |

### Special Logic

- **Invited users** (`user_metadata.invited_user === true`): Skip signup confirmation email (already auto-confirmed via Admin API)
- **Non-retryable errors** (400/401/403): Fail immediately
- **Retryable errors** (429/5xx): Exponential backoff, max 3 attempts

---

## Custom Access Token Hook (Database)

PL/pgSQL function called by Supabase Auth **every time** a JWT is issued or refreshed.

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql
```

### What It Queries

```sql
select coalesce(p.display_name, p.full_name, '') as name, p.avatar_url,
       p.preferred_language as language, p.onboarding_completed
from public.profiles p where p.id = (event->>'user_id')::uuid;
-- plus: exists(select 1 from public.admins where user_id = ...)  → is_admin
--       public.get_user_plan(user_id)  (reads stripe.*)            → plan
```

### Claims Injected

| Claim | Source | Fallback |
|-------|--------|----------|
| `is_admin` | `public.admins` (EXISTS) | `false` |
| `name` | `profiles.display_name` → `profiles.full_name` | `''` |
| `avatar_url` | `profiles.avatar_url` | `''` |
| `plan` | `public.get_user_plan()` — `stripe.*`, never `profiles` | `'free'` |
| `language` | `profiles.preferred_language` | `'en'` |
| `onboarding_completed` | `profiles.onboarding_completed` | `false` |

`plan` never comes from `profiles` — users can UPDATE their own profile row, so a plan column there is a self-serve upgrade. Decoded example and reader rules: [jwt.md](jwt.md).

### Permissions

```sql
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

---

## ORPC Auth Router

All procedures use `authProcedure` (rate-limited, Zod-validated).

| Procedure | Input | Supabase Method | Notes |
|-----------|-------|-----------------|-------|
| `signUp` | email, password, fullName?, captchaToken? | `auth.signUp()` | Returns `requiresEmailConfirmation` |
| `signIn` | email, password, captchaToken? | `auth.signInWithPassword()` | Generic error msg |
| `signOut` | — | `auth.signOut()` | Clears session |
| `requestPasswordReset` | email | `auth.resetPasswordForEmail()` | Always returns success |
| `updatePassword` | password | `auth.updateUser()` | After reset flow |
| `getSession` | — | `auth.getSession()` | Client auth state |
| `verifyOtp` | email, token (8 chars), type | `auth.verifyOtp()` | Types: signup, recovery, magiclink, invite, email_change |
| `resendVerification` | email, type | `auth.resend()` | Types: signup, email_change |

---

## Supabase Clients

| Client | File | Context | Notes |
|--------|------|---------|-------|
| Server | `lib/supabase/server.ts` | Server Components, Actions, Route Handlers | New instance per request. Never global. |
| Browser | `lib/supabase/client.ts` | Client Components | `createBrowserClient` |
| Service Role | `lib/supabase/server.ts` | Inngest, background jobs | Bypasses RLS. **Server-only.** |

---

## Middleware

Runs on every matched request. Entry: `proxy.ts` → `updateSession(request)`.

| Check | Action |
|-------|--------|
| Unauthenticated on a non-public path | Redirect to `/auth/login` |
| Authenticated on `/auth/*` | Redirect to `/protected/home` |
| `/protected/admin/*` and `claims.is_admin !== true` | Redirect to `/protected/home` — UX only; the guard is `adminProcedure` |

### Public Routes (No Auth)

Prefix match (`path === p || path.startsWith(p + "/")`). `lib/supabase/proxy.ts` is append-only — add new public prefixes to the array, never touch the auth logic:

```
/ /auth /api /landing /logo-preview /framework /terms /privacy /setup
```

---

## Cached Auth Claims

`getCachedAuth()` (`lib/supabase/cached-claims.ts`) wraps `getClaims()` with React `cache()` — deduplicates per server request.

```ts
export const getCachedAuth = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return { supabase, claims: (data?.claims ?? {}) as Record<string, unknown> }
})
```

Without caching: 4+ JWKS fetches/page. With: 1.

`claims` is `{}` when signed out — gate on `claims.sub`. There is no `requireAuth()`: oRPC procedures use `protectedProcedure` / `adminProcedure` (`lib/orpc/base.ts`); pages `redirect("/auth/login")`.

---

## Claim Reader Functions (`lib/auth/utils.ts`)

All read from JWT claims. **Zero DB queries.** One reader per claim, named after it.

| Function | Claim | Fallback |
|----------|-------|----------|
| `getName(claims)` | `name` | `''` |
| `getEmail(claims)` | `email` | `''` |
| `getAvatarUrl(claims)` | `avatar_url` | `''` |
| `getPlan(claims)` | `plan` | `'free'` — fails closed, never a paid tier |

`is_admin` and `onboarding_completed` are read directly (`claims.is_admin === true`). oRPC resolves `role: claims.is_admin === true ? 'admin' : 'user'` in `lib/orpc/resolve-user.ts`. Add project-specific readers the same way (`hasProPlan = getPlan(claims) === 'pro'`).

**Rule:** a reader for a claim the hook does not inject returns null forever, and `08-verify` checks the hook's claim names — not the readers' — so nothing catches it. Add the claim to the hook first, then the reader, same name.

---

## JWT Refresh

When DB data changes, the JWT is stale until re-issued. Call `refreshClaims()` (`lib/auth/refresh.ts`) — a re-issued JWT re-runs the hook.

**When**: After onboarding completes, a profile update, or a plan change (Stripe webhook → `stripe.*` → `get_user_plan()`).

---

## Page Rendering Pattern (PPR)

All auth pages use Partial Prerendering:

```tsx
// Static shell (cached, instant)
<Suspense fallback={<CachedLoginUI />}>
  {/* Dynamic form (streams in with searchParams) */}
  <DynamicLoginForm searchParams={searchParams} />
</Suspense>
```

---

## Admin Access

`public.admins` (locked down, no client writes) → `is_admin` claim in the hook. No allowlist in code.

- **Security**: `adminProcedure` (`lib/orpc/base.ts`, `requireAdminMiddleware`) rejects non-admins on every admin procedure.
- **UX**: the proxy redirects non-admins away from `/protected/admin/*`. That is not the guard — the procedure is.
- Promote: `insert into public.admins (user_id) values ('<uuid>')`, then the user re-authenticates (or `refreshClaims()`).

---

## Decoded JWT Example

```json
{
  "sub": "uuid", "email": "user@example.com", "role": "authenticated",
  "is_admin": false, "name": "Ada Lovelace", "avatar_url": "https://...",
  "plan": "free", "language": "en", "onboarding_completed": true
}
```

---

## File Reference

| File | Purpose |
|------|---------|
| `features/auth/login/` | Login page (PPR + form + Turnstile) |
| `features/auth/sign-up/` | Sign-up page (PPR + form + Turnstile) |
| `features/auth/sign-up-success/` | OTP verification (8-digit, auto-submit) |
| `features/auth/forgot-password/` | Password reset request |
| `features/auth/update-password/` | New password form |
| `features/_shared/components/turnstile.tsx` | Cloudflare Turnstile wrapper |
| `lib/orpc/procedures/auth.ts` | All auth ORPC procedures |
| `lib/supabase/server.ts` | Server + Service Role clients |
| `lib/supabase/client.ts` | Browser client |
| `lib/supabase/proxy.ts` | Session refresh, route protection |
| `lib/supabase/cached-claims.ts` | `getCachedAuth()` — cached `getClaims()` |
| `lib/auth/refresh.ts` | `refreshClaims()` — re-issue the JWT after data changes |
| `lib/auth/utils.ts` | JWT claim readers (zero DB) |
| `supabase/functions/send-email/` | Branded email Edge Function (Resend) |

| DB Object | Type | Purpose |
|-----------|------|---------|
| `public.custom_access_token_hook` | Function | Auth hook — injects claims |
| `public.profiles` | Table | name, avatar, language, onboarding — user-editable, never entitlement |
| `public.admins` | Table | Admin allowlist → `is_admin` |
| `public.get_user_plan()` | Function | Plan from `stripe.*` → `plan` |

---

## Performance

| Operation | Method | Latency |
|-----------|--------|---------|
| Role check | JWT claim read | <1ms |
| Middleware auth | `getClaims()` | 1-2ms |
| Server Component auth | `getCachedAuth()` (cached) | 1ms first, 0ms after |
| Token refresh | Hook re-queries DB | 10-30ms (~1x/hour) |
