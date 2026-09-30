-- Migration Group 3: Security hardening + billing data isolation
-- Plan is resolved at JWT time via get_user_plan() (defined in 02-billing.sql).
-- stripe_customer_id is resolved via _stripe_resolve_customer_id() (defined in 02-billing.sql).
-- REQUIRES: 01-base.sql + 02-billing.sql applied first

-- ─────────────────────────────────────────────────────────────
-- 3a: Remove billing columns from profiles (if they exist)
-- ─────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS idx_profiles_stripe_customer_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS plan_type;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;

-- ─────────────────────────────────────────────────────────────
-- 3b: Update handle_new_user (no billing data in profiles)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3c: Update JWT hook — calls get_user_plan() from 02-billing
-- Plan resolved from stripe.* tables (Sync Engine, read-only).
-- NOT from profiles (users can UPDATE their own profile row).
-- ─────────────────────────────────────────────────────────────

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

  -- Plan from Stripe via get_user_plan() (02-billing.sql)
  -- Checks lifetime purchases first, then subscriptions, defaults to 'free'
  BEGIN
    v_plan := public.get_user_plan(v_user_id);
  EXCEPTION WHEN undefined_function THEN
    -- get_user_plan not yet deployed (billing migration pending)
    v_plan := 'free';
  END;

  -- Admin check from locked-down admins table
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = v_user_id
  ) INTO v_is_admin;

  -- Set claims
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

-- ─────────────────────────────────────────────────────────────
-- 3d: Permissions — supabase_auth_admin needs access
-- ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.get_user_plan TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- supabase_auth_admin needs SELECT on tables the hook reads
GRANT SELECT ON public.profiles TO supabase_auth_admin;
GRANT SELECT ON public.admins TO supabase_auth_admin;
