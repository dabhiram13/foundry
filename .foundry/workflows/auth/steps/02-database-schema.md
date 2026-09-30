# Step 2: Database Schema

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Create all user/auth-related tables, RLS policies, and triggers via Supabase migrations.

## Pre-read

- Step 1 decisions: roles, user types, profile data needed
- `db-schema.md` — what already exists
- `references/auth-rules.md` — security rules

## Tables to Create

The exact tables depend on Step 1's role analysis. Common patterns:

### Pattern A: Single Role Table (Simple)

```sql
-- profiles: 1:1 with auth.users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  role text CHECK (role IN ('admin', 'user', 'moderator')),
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Pattern B: Role-Specific Tables (Complex)

```sql
-- all_users: base profile for every user
CREATE TABLE public.all_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  type text CHECK (type IN ('creator', 'brand')),
  onboarding_completed boolean DEFAULT false,
  access boolean DEFAULT true,
  user_country text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- creators: role-specific profile
CREATE TABLE public.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.all_users(id) ON DELETE CASCADE,
  name text,
  bio text,
  -- role-specific columns
  created_at timestamptz DEFAULT now()
);

-- brands: role-specific profile
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.all_users(id) ON DELETE CASCADE,
  business_name text,
  -- role-specific columns
  created_at timestamptz DEFAULT now()
);
```

### Pattern C: Multi-Tenant (Team/Org Membership)

```sql
-- teams/orgs table
-- team_members join table with role + accepted_at
```

### Admin Table (ALWAYS — every project)

```sql
-- admins: controls who has admin access
-- NO RLS POLICIES — only service role can read/write
-- This means: no authenticated user can query, insert, update, or delete from this table
-- Admin designation happens via MCP (apply_migration), direct SQL, or admin client (service role key)
CREATE TABLE public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  granted_by text -- who granted admin (email or 'system')
);

-- Enable RLS but add ZERO policies = complete lockdown for anon/authenticated
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
-- No policies = no access via PostgREST (anon/authenticated roles)
-- Service role bypasses RLS, so MCP + admin client still work

COMMENT ON TABLE public.admins IS 'Admin access list. No RLS policies — only service role can access. Use MCP or admin client to manage.';
```

**To grant admin access** (via MCP `execute_sql` or migration):
```sql
INSERT INTO public.admins (user_id, granted_by)
VALUES ('the-user-uuid', 'admin@example.com');
```

**To revoke admin access:**
```sql
DELETE FROM public.admins WHERE user_id = 'the-user-uuid';
```

## Required for ALL Patterns

### Auto-create profile on signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### RLS Policies

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role can do everything (for triggers, hooks)
-- No explicit policy needed — service role bypasses RLS
```

## Delegation

Use `db-architect` agent for the actual migration:
- Provide: table definitions, RLS requirements, trigger logic
- Agent writes the SQL and calls `apply_migration` via Supabase MCP

## After Migration

1. Update `db-schema.md` with new tables
2. Verify RLS via `get_advisors` (security check)
3. Verify trigger works: insert a test user, check profile auto-created

### Billing Data — NOT in profiles

**SECURITY CRITICAL:** `plan_type` and `stripe_customer_id` MUST NOT live in the profiles table. The profiles table has UPDATE RLS for authenticated users — if plan_type lived there, users could self-promote to any plan.

Plan is resolved at JWT time via `get_user_plan()` which reads `stripe.*` tables (Stripe Sync Engine — read-only for users). No billing table needed for subscriptions.

For one-time purchases (e.g. kit_purchases), create a table with SELECT-only RLS and a SECURITY DEFINER RPC function to insert records after payment verification.

## Done when

- All user/profile tables exist with correct columns and constraints
- RLS enabled on every table, policies in place
- `admins` table exists with RLS enabled but ZERO policies (complete lockdown for anon/authenticated)
- `handle_new_user` trigger creates profile on signup
- `updated_at` trigger works
- `db-schema.md` updated
- `get_advisors` security check passes
- **Billing columns (plan_type, stripe_customer_id) are NOT in the profiles table**
