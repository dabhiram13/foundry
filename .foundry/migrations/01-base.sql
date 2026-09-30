-- Migration Group 1: Base tables and functions
-- No external dependencies. Runs on any fresh Supabase project.
-- NOTE: plan_type is NOT in profiles. Plan is resolved at JWT time via
-- get_user_plan() which reads stripe.* tables (Stripe Sync Engine).
-- This prevents users from self-promoting via UPDATE on their own profile.

-- 1a: profiles table (user-editable data only — NO billing columns)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  onboarding_completed boolean DEFAULT false,
  preferred_language text DEFAULT 'en',
  timezone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Auto-create profile on signup
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 1b: admins table (locked down — no RLS policies = no access via PostgREST)
CREATE TABLE public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  granted_by text -- who granted admin (email or 'system')
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
-- No policies = complete lockdown for anon/authenticated
-- Service role bypasses RLS, so MCP + admin client still work

COMMENT ON TABLE public.admins IS 'Admin access list. No RLS policies — only service role can access. Use MCP or admin client to manage.';

-- 1c: credits table (simple ledger)
CREATE TABLE public.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits"
  ON public.credits FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE INDEX idx_credits_user_id ON public.credits(user_id);

-- 1d: custom access token hook
-- Plan is resolved via get_user_plan() (defined in 02-billing.sql, reads stripe.* tables).
-- If get_user_plan() doesn't exist yet (billing not set up), the hook still works — plan defaults to 'free'.
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

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- supabase_auth_admin needs SELECT on tables the hook reads
GRANT SELECT ON public.profiles TO supabase_auth_admin;
GRANT SELECT ON public.admins TO supabase_auth_admin;
