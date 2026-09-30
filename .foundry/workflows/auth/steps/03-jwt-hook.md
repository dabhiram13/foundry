# Step 3: JWT Hook

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Build the `custom_access_token_hook` function that injects project-specific claims into every JWT.

## Pre-read

- Step 1 decisions: what claims are needed
- Step 2 output: what tables exist, column names
- `references/auth-rules.md` — hook security rules (SECURITY DEFINER, GRANT/REVOKE)
- Reference: `.foundry/references/source-docs/supabase/jwt.md` (claims + readers) and `.foundry/migrations/01-base.sql` (`custom_access_token_hook`)

## How It Works

```
User authenticates (login, signup, token refresh)
  → Supabase Auth builds default JWT
  → Auth calls custom_access_token_hook(event jsonb)
  → Hook queries project tables, injects claims
  → Auth signs JWT with modified claims
  → Client receives enriched token
```

## Hook Template

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_claims jsonb;
  v_user_id uuid;
  v_profile RECORD;
  v_plan text;
  v_is_admin boolean;
BEGIN
  v_claims := event->'claims';
  v_user_id := (event->>'user_id')::uuid;

  -- Read user-editable profile data
  SELECT
    COALESCE(p.display_name, p.full_name, '')::text as name,
    COALESCE(p.avatar_url, '')::text as avatar_url,
    COALESCE(p.preferred_language, 'en')::text as language,
    COALESCE(p.onboarding_completed, false) as onboarding_completed
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  -- Read plan from Stripe via get_user_plan() (reads stripe.* Sync Engine tables)
  -- NOT from profiles — users can UPDATE their own profile row
  -- Falls back to 'free' if function doesn't exist yet
  BEGIN
    v_plan := public.get_user_plan(v_user_id);
  EXCEPTION WHEN undefined_function THEN
    v_plan := 'free';
  END;

  -- Admin check from locked-down admins table
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = v_user_id
  ) INTO v_is_admin;

  -- Inject claims
  v_claims := jsonb_set(v_claims, '{is_admin}', to_jsonb(COALESCE(v_is_admin, false)));

  IF v_profile IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{name}', to_jsonb(v_profile.name));
    v_claims := jsonb_set(v_claims, '{avatar_url}', to_jsonb(v_profile.avatar_url));
    v_claims := jsonb_set(v_claims, '{plan}', to_jsonb(COALESCE(v_plan, 'free')));
    v_claims := jsonb_set(v_claims, '{language}', to_jsonb(v_profile.language));
    v_claims := jsonb_set(v_claims, '{onboarding_completed}', to_jsonb(v_profile.onboarding_completed));
  ELSE
    v_claims := jsonb_set(v_claims, '{name}', to_jsonb(''::text));
    v_claims := jsonb_set(v_claims, '{avatar_url}', to_jsonb(''::text));
    v_claims := jsonb_set(v_claims, '{plan}', to_jsonb(COALESCE(v_plan, 'free')));
    v_claims := jsonb_set(v_claims, '{language}', to_jsonb('en'::text));
    v_claims := jsonb_set(v_claims, '{onboarding_completed}', to_jsonb(false::boolean));
  END IF;

  event := jsonb_set(event, '{claims}', v_claims);
  RETURN event;
END;
$$;
```

**SECURITY NOTE:** Plan is resolved via `get_user_plan()` which reads `stripe.*` Sync Engine tables (read-only for users), NOT from `public.profiles`. The `profiles` table has UPDATE RLS for authenticated users — if `plan_type` lived there, users could `UPDATE profiles SET plan_type = 'lifetime'` and self-promote. The `get_user_plan()` function checks lifetime purchases first, then active subscriptions, defaults to `'free'`. Falls back gracefully if billing migration (02-billing.sql) hasn't been applied yet.

## CRITICAL — Permissions (EVERY migration)

```sql
-- Auth must be able to call the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Users must NOT call the hook via API
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- supabase_auth_admin needs SELECT on every table the hook reads
-- Even with SECURITY DEFINER, the caller's role determines table access
GRANT SELECT ON public.profiles TO supabase_auth_admin;
GRANT SELECT ON public.admins TO supabase_auth_admin;
```

**Include these in the SAME migration as the function.** If you forget the GRANT, auth silently falls back to default claims — no error, no logs, just missing claims. If you forget the table SELECT grants, login will 500 with `permission denied for table`.

## Claims Design

Map each claim from Step 1 analysis:

| Claim | Source | Type | Fallback |
|-------|--------|------|----------|
| `is_admin` | `public.admins` (EXISTS) | boolean | `false` |
| `name` | `profiles.display_name` → `profiles.full_name` | string | `''` |
| `avatar_url` | `profiles.avatar_url` | string | `''` |
| `plan` | `get_user_plan()` — reads `stripe.*`, never `profiles` | string | `'free'` |
| `language` | `profiles.preferred_language` | string | `'en'` |
| `onboarding_completed` | `profiles.onboarding_completed` | boolean | `false` |

*These six ship in `01-base.sql`. Add project-specific claims from Step 1 below them — and read each one back under the exact name you inject.*

## Multi-Table JOINs

If the project has role-specific tables:

```sql
FROM public.all_users au
LEFT JOIN public.creators c ON c.user_id = au.id
LEFT JOIN public.brands b ON b.user_id = au.id
WHERE au.id = (event->>'user_id')::uuid
```

Use `LEFT JOIN` — a user might not have a role-specific row yet (pre-onboarding).

## Claim Reader Functions

The skeleton ships readers in `webapp/lib/auth/utils.ts` (`getName`, `getPlan`, `getAvatarUrl`, `getEmail`). Add one per new claim, named after the claim:

```typescript
// Every function reads from JWT claims — ZERO DB queries.
// The claim name in the reader MUST match what the hook injects (`name`, not
// `user_name`). A reader for a claim the hook never sets returns null forever,
// and the verify step checks the hook's names, so it will not catch it.
export function isAdmin(claims: Claims): boolean {
  return (claims as Record<string, unknown>).is_admin === true;
}

export function getName(claims: Claims): string {
  return ((claims as Record<string, unknown>).name as string) || '';
}

export function getPlan(claims: Claims): string {
  return ((claims as Record<string, unknown>).plan as string) || 'free';
}

export function needsOnboarding(claims: Claims): boolean {
  return !(claims as Record<string, unknown>).onboarding_completed;
}
```

## Cached Auth Helper

Already shipped — do not create a second one. `webapp/lib/supabase/cached-claims.ts` exports `getCachedAuth()`: `getClaims()` wrapped in React `cache()`, so one request makes one JWKS fetch. Extend that file if a new claim needs a typed accessor.

## Delegation

Use `db-architect` agent for the migration:
- Provide: the full hook SQL with all claims + GRANT/REVOKE
- Agent calls `apply_migration` via Supabase MCP

## Manual Step (Cannot Be Automated)

**Remind the user**: After migration, enable the hook manually:

> Supabase Dashboard → Authentication → Hooks → Custom Access Token → Enable → Select `public.custom_access_token_hook`

This cannot be done via MCP or SQL.

## Testing

1. Log in via the app
2. Open browser devtools → Application → Cookies
3. Find the `sb-*-auth-token` cookie
4. Decode at jwt.io — verify all custom claims are present
5. Check for NULL values where you expect data

## Done when

- `custom_access_token_hook` migration deployed with GRANT/REVOKE
- Claim reader functions exist in `webapp/lib/auth/utils.ts`
- Server code reads claims through `webapp/lib/supabase/cached-claims.ts` (no second helper created)
- Hook enabled in Supabase Dashboard (user action)
- Claims verified in a decoded JWT
