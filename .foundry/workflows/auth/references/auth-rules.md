# Auth Rules — Non-Negotiable

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Read this before every step. These rules are absolute.

## Session & Claims

| Rule | Why |
|------|-----|
| `getClaims()` everywhere — NEVER `getUser()` or `getSession()` for reading user data | Claims are from JWT (0ms). getUser/getSession hits the DB. |
| Wrap `getClaims()` with React `cache()` in `lib/supabase/cached-claims.ts` | Deduplicates across Server Components in one request (4+ JWKS fetches → 1) |
| `requireAuth()` throws if unauthenticated | TypeScript narrows claims + userId to non-null |
| HTTP-only cookies for session tokens | Never expose tokens in response body or localStorage |
| Call `refreshSession()` after any DB mutation that changes claim data | Stale JWT = stale permissions until next refresh (~1h) |

## JWT Hook

| Rule | Why |
|------|-----|
| `SECURITY DEFINER` on hook function | Runs as `postgres` owner — full table access without explicit grants |
| `SET search_path TO ''` | Prevents search path hijacking (CWE-426) |
| Fully qualified table names (`public.profiles`, not `profiles`) | Required when search_path is empty |
| `GRANT EXECUTE ... TO supabase_auth_admin` in EVERY migration | Without this, Auth can't call the hook — silent fallback to default claims |
| `REVOKE EXECUTE ... FROM authenticated, anon, public` | Users must NOT call the hook directly via API |
| `STABLE` volatility | Hook is read-only — tells planner it can optimize |
| Handle NULL with COALESCE | Missing data should return safe defaults, not break the hook |

## Error Messages

| Rule | Why |
|------|-----|
| Login failure: "Invalid email or password" | No distinction = no email enumeration |
| Password reset: always return success | Same — attacker can't determine if email exists |
| Signup with existing email: generic error | Supabase handles this, but don't leak info in ORPC layer |

## Input Validation

| Validator | Rules |
|-----------|-------|
| `SecureEmail` | Trim, lowercase, max 254 chars, RFC format |
| `SecurePassword` | Min 8, max 128 chars |
| `SecureShortText` | Max 100 chars, trimmed |
| `secureObject` with `.strict()` | Drops unknown keys — prevents mass assignment |

## Captcha

| Rule | Detail |
|------|--------|
| Cloudflare Turnstile on ALL public auth forms | Login, signup, forgot password |
| `@marsidev/react-turnstile` package | Client-side widget |
| Token forwarded to Supabase via `captchaToken` option | Supabase verifies server-side |
| Graceful degradation if key not set | `Turnstile` returns `null` — dev convenience |

## PPR Pattern (All Auth Pages)

```
page.tsx (Server Component)
  └── <Suspense fallback={<CachedUI />}>
        <DynamicForm searchParams={searchParams} />
      </Suspense>
```

| Component | Type | Purpose |
|-----------|------|---------|
| `CachedUI` | Server, `"use cache"` + `cacheLife("weeks")` | Static shell, renders instantly |
| `DynamicForm` | Server, async | Awaits searchParams, validates redirect, passes props |
| `Form` | Client, `"use client"` | Core form logic, ORPC call, state management |

## Rate Limiting

| Procedure Type | Limit |
|----------------|-------|
| `authProcedure` (public auth routes) | 10 req/min |
| Resend verification | 60-second cooldown (client-enforced) |

## Middleware Rules

| Rule | Detail |
|------|--------|
| Session refresh on every matched request | `createServerClient` + `getClaims()` in proxy — the SSR client's `setAll` callback syncs cookies on token refresh |
| Authenticated user on `/auth/*` | Redirect to role-based dashboard |
| Unauthenticated on protected route | Redirect to `/auth/login?redirect=...` |
| Admin routes | UX redirect only — checks `claims.is_admin !== true` (security enforced by `adminProcedure`) |
| NEVER add DB queries to middleware | Middleware runs on EVERY request — must be JWT-only |
| Onboarding redirect | NOT in middleware unless `onboarding_completed` is a JWT claim |

## Redirect Security

| Rule | Detail |
|------|--------|
| `validateRedirect()` on all redirect params | Only allow `/relative` paths |
| Block `//evil.com`, `https://evil.com` | Open redirect prevention |
| Short-lived cookie (`redirectAfterLogin`, max-age 300s, SameSite=Lax) for OAuth flows | Persists redirect through page-leave OAuth dance — cookie instead of sessionStorage to avoid XSS exposure |

## File Organization

```
webapp/
├── app/auth/
│   ├── login/page.tsx
│   ├── sign-up/page.tsx
│   ├── sign-up-success/page.tsx
│   ├── forgot-password/page.tsx
│   ├── update-password/page.tsx
│   ├── confirm/route.ts           (OAuth code exchange + onboarding check)
│   └── error/page.tsx
├── features/auth/
│   ├── login/components/          (cached-ui, dynamic-form, form)
│   ├── sign-up/components/
│   ├── sign-up-success/components/
│   ├── forgot-password/components/
│   └── update-password/components/
├── features/auth/_shared/components/
│   ├── google-oauth-button.tsx    (client component — signInWithOAuth)
│   ├── auth-divider.tsx           ("or" separator)
│   └── turnstile.tsx              (captcha widget)
├── features/_shared/components/
│   ├── auth-button.tsx            (server component — session-aware nav)
│   └── logout-button.tsx          (client component — sign out)
├── lib/auth/
│   ├── server.ts                  (getAuthClaims, requireAuth — cached)
│   ├── utils.ts                   (claim readers — zero DB)
│   └── refresh.ts                 (refreshClaims — call after DB mutations that change claim data)
├── lib/orpc/procedures/auth.ts    (all auth ORPC procedures)
└── lib/supabase/
    ├── server.ts                  (server + service role clients)
    ├── client.ts                  (browser client)
    └── proxy.ts                   (session refresh, route protection — Next.js 16 proxy)
```

## Billing Data Isolation

| Rule | Why |
|------|-----|
| `plan_type` and `stripe_customer_id` are NOT in `profiles` | `profiles` has UPDATE RLS — users could self-promote to any plan |
| JWT hook reads plan from `get_user_plan()` which queries `stripe.*` (Sync Engine) | Stripe Sync Engine tables are read-only for users |
| For one-time purchases, use a `purchases` table with SELECT-only RLS + SECURITY DEFINER RPC to insert | Prevents users from inserting fake purchase records |
| `supabase_auth_admin` needs SELECT grants on all tables the hook reads | Even with SECURITY DEFINER, the caller's role needs table access |

## Banned Patterns

Every banned pattern is the negation of a row above — `getUser()`/`getSession()` for user data, tokens outside HTTP-only cookies, a database query in middleware, an email-specific error, a missing GRANT or SELECT grant, `SECURITY INVOKER` on the hook, `plan_type` or `stripe_customer_id` on a user-writable row. The judgment behind all of them — fail closed, least privilege on the caller, deny by default at the data layer, silence over information — is `.foundry/philosophy/trust-boundaries.md`, injected into every backend agent and both evaluators.
