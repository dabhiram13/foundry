# Step 4: JWT Plan Detection

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Update `custom_access_token_hook` so the JWT `plan` claim reflects the user's current tier. This runs on every token refresh (~1 hour) and powers feature gating everywhere — no extra DB queries needed.

## Architecture

```
Token refresh request
  → custom_access_token_hook(event)
    → get_user_plan(user_id)    ← reads stripe.* tables (Sync Engine)
    → injects { plan: "pro" } into JWT claims
  → JWT issued with plan claim
```

The hook delegates plan resolution to `get_user_plan()`. This keeps the hook clean and lets you change billing logic in one place.

**SECURITY:** Plan is read from `stripe.*` tables via `get_user_plan()`, NOT from `profiles`. The `profiles` table has UPDATE RLS — if plan lived there, users could self-promote.

## Migration

Apply via `apply_migration`. The hook injects profile data (name, avatar) and plan:

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

  -- Profile data (user-editable, non-sensitive)
  SELECT
    COALESCE(p.display_name, p.full_name, '')::text as name,
    COALESCE(p.avatar_url, '')::text as avatar_url,
    COALESCE(p.preferred_language, 'en')::text as language,
    COALESCE(p.onboarding_completed, false) as onboarding_completed
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  -- Plan from Stripe via get_user_plan() (reads stripe.* Sync Engine tables)
  -- NOT from profiles — users can UPDATE their own profile row
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

## CRITICAL — Permissions

```sql
-- Auth must be able to call the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- supabase_auth_admin needs SELECT on every table the hook reads
-- Without these, login 500s with "permission denied for table"
GRANT SELECT ON public.profiles TO supabase_auth_admin;
GRANT SELECT ON public.admins TO supabase_auth_admin;
```

## `get_user_plan()` — Adapt Per Project

This is the function you customize for each project. It reads from `stripe.*` tables (Sync Engine, read-only for users). Examples:

**Subscription-only product:**
```sql
CREATE OR REPLACE FUNCTION get_user_plan(p_user_id uuid) RETURNS text AS $$
DECLARE v_customer_id text; v_plan text;
BEGIN
  v_customer_id := _stripe_resolve_customer_id(p_user_id);
  IF v_customer_id IS NULL THEN RETURN 'free'; END IF;

  SELECT lower(pr.name) INTO v_plan
  FROM stripe.subscriptions s
  JOIN stripe.prices p ON p.id = s.plan
  JOIN stripe.products pr ON pr.id = p.product
  WHERE s.customer = v_customer_id AND s.status IN ('active', 'trialing')
  ORDER BY p.unit_amount DESC LIMIT 1;

  RETURN COALESCE(v_plan, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**One-time purchases (e.g. kit_purchases):**

For products sold as one-time payments, you need a `purchases` table to track what was bought. This table must have **SELECT-only RLS** — inserts happen via a SECURITY DEFINER RPC function that verifies payment with Stripe first.

```sql
-- purchases table: SELECT-only for authenticated
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_slug text NOT NULL,
  tier text NOT NULL,
  stripe_checkout_session_id text,
  purchased_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own purchases"
  ON public.purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- NO INSERT/UPDATE/DELETE policies — only service role or RPC can write

-- SECURITY DEFINER function to record purchase after verifying payment
CREATE OR REPLACE FUNCTION record_purchase(
  p_user_id uuid, p_product_slug text, p_tier text, p_session_id text
) RETURNS void AS $$
BEGIN
  -- Only insert if checkout session is actually paid (verify via stripe.checkout_sessions)
  IF NOT EXISTS (
    SELECT 1 FROM stripe.checkout_sessions
    WHERE id = p_session_id AND payment_status = 'paid'
      AND metadata->>'user_id' = p_user_id::text
  ) THEN
    RAISE EXCEPTION 'Payment not verified';
  END IF;

  INSERT INTO public.purchases (user_id, product_slug, tier, stripe_checkout_session_id)
  VALUES (p_user_id, p_product_slug, p_tier, p_session_id)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then `get_user_plan` checks purchases:
```sql
CREATE OR REPLACE FUNCTION get_user_plan(p_user_id uuid) RETURNS text AS $$
DECLARE v_plan text;
BEGIN
  SELECT tier INTO v_plan FROM public.purchases
  WHERE user_id = p_user_id
  ORDER BY purchased_at DESC LIMIT 1;

  RETURN COALESCE(v_plan, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Hybrid (subscription + lifetime):**
Check lifetime purchase first (one-time payment), then active subscription, then default to `'free'`. See `references/how-it-works.md` for the full template.

## Frontend

`webapp/lib/auth/utils.ts` reads the claim:

```typescript
export function getPlan(claims: Record<string, unknown>): string {
  return typeof claims.plan === "string" ? claims.plan : "free";
}
```

## Instant Update After Payment

JWT refreshes every ~1 hour. To update the plan immediately after checkout, the confirm page calls:

```typescript
import { refreshClaims } from '@/lib/auth/refresh'
await refreshClaims()  // forces supabase.auth.refreshSession() → re-runs hook
router.refresh()       // re-renders server components with new claims
```

## Output

JWT `plan` claim returns your tier names (e.g. `free`, `starter`, `pro`, `lifetime`). Frontend reads this — zero DB queries.
