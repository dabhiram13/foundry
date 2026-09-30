# Auth Workflow

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Adapt the existing auth skeleton to this project's roles, claims, and email branding. The skeleton (auth pages, ORPC procedures, middleware, JWT hook pattern) already exists. This workflow customizes it: what roles, what JWT claims, what email templates, what OAuth providers.

## What Already Exists

- `.foundry/references/source-docs/supabase/auth.md` — **REFERENCE ARCHITECTURE** (complete auth system spec)
- `docs/built/auth.md` — existing feature reference (procedures, flows, security, JWT claims)
- `webapp/features/auth/` — working auth pages (login, signup, forgot password, update password, OTP)
- `webapp/lib/orpc/procedures/auth.ts` — auth procedures wired to router
- `webapp/lib/supabase/proxy.ts` — route protection middleware

**Do NOT rebuild these.** Read them. Adapt them to this project's needs.

## Inputs

Read these before starting:
1. `docs/project/product-overview.md` — product name (email branding, page titles)
2. `docs/project/feature-map.md` — what roles exist, what permissions
3. `docs/project/technical-requirements.md` — OAuth providers needed, MFA, special auth needs
4. `db-schema.md` — existing tables (profiles, role-specific tables)
5. `.foundry/references/source-docs/supabase/auth.md` — **REFERENCE ARCHITECTURE**
6. `docs/built/auth.md` — existing feature reference

## Outputs

| Output | Location |
|--------|----------|
| User tables + RLS + admins table (no RLS policies) | Supabase migrations |
| Custom access token hook | `public.custom_access_token_hook` (migration) |
| Send-email Edge Function | `supabase/functions/send-email/` |
| ORPC auth procedures | `webapp/lib/orpc/procedures/auth.ts` |
| Auth pages (login, signup, OTP, forgot, update pw) | `webapp/app/auth/` + `webapp/features/auth/` |
| Middleware route protection | `webapp/lib/supabase/proxy.ts` |
| Claim reader utilities | `webapp/lib/auth/utils.ts` |
| Cached auth helpers | `webapp/lib/supabase/cached-claims.ts` |
| Auth docs | `docs/built/auth.md` (updated to match implementation) |

---

## Steps — Checklist

Read the step file, execute it, mark done, move to next.

- [ ] **Step 1: Analyze Requirements** → `steps/01-analyze-requirements.md`
  Reads project docs, determines roles, claims, email types, OAuth needs

- [ ] **Step 2: Database Schema** → `steps/02-database-schema.md`
  Creates user tables, role-specific tables, RLS policies, triggers

- [ ] **Step 3: JWT Hook** → `steps/03-jwt-hook.md`
  Builds `custom_access_token_hook` with all project-specific claims

- [ ] **Step 4: Email Templates** → `steps/04-email-templates.md`
  Creates `send-email` Edge Function with branded HTML templates via Resend

- [ ] **Step 5: ORPC Procedures** → `steps/05-orpc-procedures.md`
  Implements signUp, signIn, signOut, verifyOtp, resetPassword, updatePassword, getSession

- [ ] **Step 6: Frontend Pages** → `steps/06-frontend-pages.md`
  Builds auth pages with PPR pattern, Turnstile captcha, redirect handling

- [ ] **Step 7: Middleware** → `steps/07-middleware.md`
  Route protection, public routes, session refresh, redirect logic

- [ ] **Step 8: Verify** → `steps/08-verify.md`
  Full flow test, type check, security audit, docs update

---

## Resume

If resuming mid-workflow, read this checklist. Skip completed steps. Read the next pending step file.

## Agents

| Resource | Use For |
|----------|---------|
| Agent: `db-architect` | Migrations, RLS policies, triggers |
| Agent: `backend` | Auth procedures, Zod schemas, error handling |
| Agent: `designer` | Auth page components, form layouts |

## References

- `references/auth-rules.md` — security rules, banned patterns, claim reading conventions
