# Step 1: Analyze Requirements

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Understand what this project's auth system needs. No code changes — decisions only, passed to subsequent steps.

## Do

1. Read `docs/project/product-overview.md` — product name, tagline
2. Read `docs/project/feature-map.md` — what roles exist (creator/brand, admin/user, seller/buyer, etc.)
3. Read `docs/project/technical-requirements.md` — OAuth providers, MFA, special needs
4. Read `docs/project/users-and-journeys.md` — who the users are, how they sign up
5. Read `db-schema.md` — what tables already exist, what profile data is tracked
6. Read `.foundry/references/source-docs/supabase/auth.md` — **REFERENCE ARCHITECTURE** (the gold standard for how auth works in this system)
7. Read `docs/built/auth.md` — existing feature reference (procedures, flows, security, JWT claims)

## Decisions to Make

### Roles & User Types

| Question | Decision |
|----------|----------|
| What user types/roles exist? | e.g., creator + brand, admin + user, free + paid |
| Are roles stored in a single table or role-specific tables? | e.g., `profiles.role` column vs `creators` + `brands` tables |
| Is there a multi-entity concept? (user belongs to multiple orgs/teams/brands) | Affects JWT hook complexity |
| What admin model? | Hardcoded allowlist (ADMIN_USER_IDS) vs role-based |

### JWT Claims

| Question | Decision |
|----------|----------|
| What custom claims does the JWT need? | List every claim: name, source table, source column, type |
| Does the hook need JOINs across multiple tables? | Map the query: base table + JOINs |
| What fallback values for NULL data? | e.g., `onboarding_completed` defaults to `false` |

### Email Types Needed

| Type | Needed? | Notes |
|------|---------|-------|
| `signup` (OTP verification) | Almost always yes | |
| `recovery` (password reset) | Almost always yes | |
| `magiclink` | Only if magic link auth enabled | |
| `invite` | Only if invitation system planned | |
| `email_change` | If users can change email | |
| `reauthentication` | If sensitive actions require re-auth | |

### OAuth

| Question | Decision |
|----------|----------|
| Which providers? | Google, GitHub, Apple, etc. — or email-only for now |
| OAuth callback route needed? | `/auth/callback` if any OAuth provider |

### Onboarding Integration

| Question | Decision |
|----------|----------|
| Is `onboarding_completed` in JWT claims? | If yes → middleware can redirect. If no → redirect after login via DB query. |
| Where does signup redirect after OTP? | `/onboarding` or `/protected`? |

## Output

A mental model (no file written yet) of:
- User tables needed
- JWT claims list
- Email types to implement
- OAuth providers (now or later)
- Redirect flow: signup → OTP → onboarding? → dashboard

Pass this context to Step 2.

## Done when

All decisions above are answered. Ready to design the database schema.
