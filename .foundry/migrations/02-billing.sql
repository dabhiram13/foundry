-- Migration Group 2: Billing functions + credit system
-- REQUIRES: Stripe Sync Engine enabled (stripe.* schema must exist)
-- REQUIRES: 01-base.sql applied first

-- ─────────────────────────────────────────────────────────────
-- 2a: Resolve Supabase user -> Stripe customer ID via Sync Engine
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._stripe_resolve_customer_id(p_user_id uuid)
RETURNS text AS $$
  SELECT id FROM stripe.customers
  WHERE metadata->>'user_id' = p_user_id::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path TO '';

-- ─────────────────────────────────────────────────────────────
-- 2b: get_user_plan — resolve plan from Stripe Sync Engine
--
-- Hybrid version: checks one-time purchases (lifetime) first,
-- then active subscriptions, defaults to 'free'.
--
-- For subscription-only products, the lifetime check is a no-op
-- (no matching checkout_sessions rows). No code change needed.
--
-- For one-time-only products, replace the subscription check
-- with a purchases table lookup. See billing workflow docs.
--
-- Priority: lifetime > pro > starter > free
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_customer_id text;
  v_tier text;
BEGIN
  v_customer_id := public._stripe_resolve_customer_id(p_user_id);
  IF v_customer_id IS NULL THEN RETURN 'free'; END IF;

  -- 1. Check one-time lifetime purchase (highest priority)
  -- Uses product metadata.tier — no hardcoded product IDs
  SELECT pr.metadata->>'tier' INTO v_tier
  FROM stripe.checkout_sessions cs
  JOIN stripe.checkout_session_line_items li ON li.checkout_session = cs.id
  JOIN stripe.products pr ON pr.id = (li.price::jsonb->>'product')
  WHERE cs.customer = v_customer_id
    AND cs.mode = 'payment'
    AND cs.payment_status = 'paid'
    AND pr.metadata->>'tier' = 'lifetime'
  LIMIT 1;

  IF v_tier IS NOT NULL THEN RETURN v_tier; END IF;

  -- 2. Check active subscription (highest tier wins)
  SELECT pr.metadata->>'tier' INTO v_tier
  FROM stripe.subscriptions s
  JOIN stripe.products pr ON pr.id = (s.plan::jsonb->>'product')
  WHERE s.customer = v_customer_id
    AND s.status IN ('active', 'trialing')
  ORDER BY CASE pr.metadata->>'tier'
    WHEN 'pro' THEN 3
    WHEN 'starter' THEN 2
    ELSE 1
  END DESC
  LIMIT 1;

  RETURN COALESCE(v_tier, 'free');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '';

REVOKE EXECUTE ON FUNCTION public.get_user_plan FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public._stripe_resolve_customer_id FROM authenticated, anon, public;

-- ─────────────────────────────────────────────────────────────
-- 2c: Credit allocation config
-- Maps plan + credit_type to allocation amount and period.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_allocations (
  plan text NOT NULL,
  credit_type text NOT NULL,
  allocation integer NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'month',
  PRIMARY KEY (plan, credit_type)
);

ALTER TABLE public.credit_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read allocations"
  ON public.credit_allocations FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2d: Credit balances (denormalized for fast reads)
-- One row per user/type/period. Lazy-allocated on first access.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_type text NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  allocation integer NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'month',
  period_start timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, credit_type, period_start)
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own balances"
  ON public.credit_balances FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_credit_balances_user
  ON public.credit_balances(user_id, credit_type, period_start);

-- ─────────────────────────────────────────────────────────────
-- 2e: Credit ledger (append-only audit trail)
-- Types: allocation, consumption, refund, bonus, reset
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_type text NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'consumption',
  description text,
  metadata jsonb DEFAULT '{}',
  period_start timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ledger"
  ON public.credit_ledger FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user
  ON public.credit_ledger(user_id, credit_type);

-- ─────────────────────────────────────────────────────────────
-- 2f: consume_credits — atomic debit with lazy allocation
--
-- The signature matches its only caller, webapp/lib/credits/with-credits.ts:37-43,
-- which resolves the plan from the JWT claim and passes that plan's allocation and
-- period from CREDIT_CONFIG (webapp/lib/credits/config.ts). The code is the truth
-- for the call shape; this function is the truth for the entitlement.
--
-- Entitlement resolution, in order:
--   1. The credit_allocations row for get_user_plan(p_user_id) + p_credit_type wins.
--      That table is the DB-side entitlement list, so a caller can never grant
--      itself more than the plan is configured for.
--   2. No row for that plan → fall back to the caller's p_allocation / p_period,
--      so a plan that exists only in CREDIT_CONFIG still works.
--   3. Neither → fail closed with error 'no_allocation'. Nothing is granted by default.
--
-- Returns: { success, balance, allocation, needed?, error?, plan? }
-- ─────────────────────────────────────────────────────────────

-- The 3-argument form this function replaced left an ambiguous overload behind
-- when both were installed. Drop it before creating the current signature.
DROP FUNCTION IF EXISTS public.consume_credits(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id uuid,
  p_credit_type text,
  p_cost integer,
  p_allocation integer,
  p_period text
)
RETURNS jsonb AS $$
DECLARE
  v_plan text;
  v_allocation integer;
  v_period text;
  v_period_start timestamptz;
  v_balance_row record;
  v_new_balance integer;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_cost', 'balance', 0);
  END IF;

  -- 1. Resolve plan from Stripe (live, not cached)
  v_plan := public.get_user_plan(p_user_id);

  -- 2. Configured entitlement wins; the caller's values are the fallback
  SELECT ca.allocation, ca.period INTO v_allocation, v_period
  FROM public.credit_allocations ca
  WHERE ca.plan = v_plan AND ca.credit_type = p_credit_type;

  IF v_allocation IS NULL THEN
    v_allocation := p_allocation;
    v_period := p_period;
  END IF;

  IF v_allocation IS NULL OR v_allocation < 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'no_allocation',
      'plan', v_plan, 'balance', 0, 'needed', p_cost
    );
  END IF;

  IF v_period IS NULL OR v_period NOT IN ('day', 'week', 'month') THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'bad_period',
      'plan', v_plan, 'balance', 0, 'needed', p_cost
    );
  END IF;

  -- 3. Compute period start
  v_period_start := CASE v_period
    WHEN 'day' THEN date_trunc('day', now() AT TIME ZONE 'UTC')
    WHEN 'week' THEN date_trunc('week', now() AT TIME ZONE 'UTC')
    WHEN 'month' THEN date_trunc('month', now() AT TIME ZONE 'UTC')
  END;

  -- 4. Lock or lazy-allocate balance row
  SELECT * INTO v_balance_row
  FROM public.credit_balances
  WHERE user_id = p_user_id AND credit_type = p_credit_type AND period_start = v_period_start
  FOR UPDATE;

  IF v_balance_row IS NULL THEN
    INSERT INTO public.credit_balances (user_id, credit_type, balance, allocation, period, period_start)
    VALUES (p_user_id, p_credit_type, v_allocation, v_allocation, v_period, v_period_start)
    ON CONFLICT (user_id, credit_type, period_start) DO NOTHING
    RETURNING * INTO v_balance_row;

    -- Race condition: another transaction inserted first
    IF v_balance_row IS NULL THEN
      SELECT * INTO v_balance_row
      FROM public.credit_balances
      WHERE user_id = p_user_id AND credit_type = p_credit_type AND period_start = v_period_start
      FOR UPDATE;
    END IF;

    INSERT INTO public.credit_ledger (user_id, credit_type, amount, type, description, period_start)
    VALUES (p_user_id, p_credit_type, v_allocation, 'allocation', 'Period allocation', v_period_start);
  END IF;

  -- 5. Check sufficient balance
  IF v_balance_row.balance < p_cost THEN
    RETURN jsonb_build_object(
      'success', false, 'balance', v_balance_row.balance,
      'needed', p_cost, 'allocation', v_balance_row.allocation
    );
  END IF;

  -- 6. Debit
  v_new_balance := v_balance_row.balance - p_cost;
  UPDATE public.credit_balances
  SET balance = v_new_balance, updated_at = now()
  WHERE id = v_balance_row.id;

  INSERT INTO public.credit_ledger (user_id, credit_type, amount, type, description, period_start)
  VALUES (p_user_id, p_credit_type, -p_cost, 'consumption', 'Credit consumed', v_period_start);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'allocation', v_balance_row.allocation);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Credit functions are called by backend (service_role) only, not by users directly.
-- Without this REVOKE, any authenticated user could call consume_credits with ANY user_id
-- (draining other users' credits) or refund_credits (giving themselves unlimited credits).
REVOKE EXECUTE ON FUNCTION public.consume_credits(uuid, text, integer, integer, text) FROM anon, authenticated, PUBLIC;

-- ...but the backend still has to call it. service_role's access came from PUBLIC,
-- which the REVOKE above just removed. Without this GRANT every call fails with
-- "permission denied for function consume_credits".
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, text, integer, integer, text) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 2g: refund_credits — reversal on handler failure
-- Called by withCredits() middleware when the handler throws.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id uuid,
  p_credit_type text,
  p_amount integer
)
RETURNS jsonb AS $$
DECLARE
  v_period text;
  v_period_start timestamptz;
  v_new_balance integer;
BEGIN
  -- Find current period from latest balance row (no caller guessing)
  SELECT period, period_start INTO v_period, v_period_start
  FROM public.credit_balances
  WHERE user_id = p_user_id AND credit_type = p_credit_type
  ORDER BY period_start DESC LIMIT 1;

  IF v_period IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_balance_row');
  END IF;

  UPDATE public.credit_balances
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id AND credit_type = p_credit_type AND period_start = v_period_start
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.credit_ledger (user_id, credit_type, amount, type, description, period_start)
  VALUES (p_user_id, p_credit_type, p_amount, 'refund', 'Automatic refund', v_period_start);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, text, integer) FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refund_credits(uuid, text, integer) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 2h: get_my_subscription — current user's active subscription
-- Called by getSubscription oRPC procedure via supabase.rpc()
-- Returns full details for the billing page UI.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS jsonb AS $$
DECLARE
  v_customer_id text;
  v_result jsonb;
BEGIN
  v_customer_id := public._stripe_resolve_customer_id(auth.uid());
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('subscribed', false, 'subscription', null);
  END IF;

  SELECT jsonb_build_object(
    'subscribed', true,
    'subscription', jsonb_build_object(
      'id', s.id,
      'status', s.status,
      'currentPeriodEnd', s.current_period_end,
      'cancelAtPeriodEnd', s.cancel_at_period_end,
      'productName', pr.name,
      'priceId', p.id,
      'amount', p.unit_amount,
      'currency', p.currency,
      'interval', COALESCE(p.recurring->>'interval', 'one_time')
    )
  ) INTO v_result
  FROM stripe.subscriptions s
  JOIN stripe.prices p ON p.id = s.plan::jsonb->>'id'
  JOIN stripe.products pr ON pr.id = p.product
  WHERE s.customer = v_customer_id
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY s.current_period_end DESC
  LIMIT 1;

  RETURN COALESCE(v_result, jsonb_build_object('subscribed', false, 'subscription', null));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '';

-- ─────────────────────────────────────────────────────────────
-- 2i: list_active_products — all active products with prices
-- Called by listProducts oRPC procedure via supabase.rpc()
-- Used to render pricing cards on the billing page.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_active_products()
RETURNS jsonb AS $$
  SELECT jsonb_build_object('products', COALESCE(jsonb_agg(product_row), '[]'::jsonb))
  FROM (
    SELECT jsonb_build_object(
      'id', pr.id,
      'name', pr.name,
      'description', pr.description,
      'prices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'amount', p.unit_amount,
          'currency', p.currency,
          'interval', COALESCE(p.recurring->>'interval', 'one_time')
        ) ORDER BY p.unit_amount)
        FROM stripe.prices p
        WHERE p.product = pr.id AND p.active = true
      ), '[]'::jsonb)
    ) AS product_row
    FROM stripe.products pr
    WHERE pr.active = true
    ORDER BY pr.name
  ) sub;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '';

-- ─────────────────────────────────────────────────────────────
-- 2j: Seed default credit allocations
-- Customize per project. Period: day, week, or month.
--
-- 'free' MUST have a row. get_user_plan() returns 'free' for every user without a
-- Stripe customer, and consume_credits treats a missing row as the config error
-- 'no_allocation'. The row is seeded at 0 on purpose: entitlement is fail-closed,
-- so a free user gets a clean "out of credits" result, and any free usage a project
-- wants to grant is a deliberate edit to this number.
--
-- The period is 'month' for the generation type, matching
-- webapp/lib/credits/config.ts:12. If you change one, change both.
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.credit_allocations (plan, credit_type, allocation, period) VALUES
  ('free',     'generation', 0,      'month'),
  ('starter',  'generation', 10,     'month'),
  ('pro',      'generation', 50,     'month'),
  ('lifetime', 'generation', 999999, 'month')
ON CONFLICT (plan, credit_type) DO UPDATE SET allocation = EXCLUDED.allocation, period = EXCLUDED.period;
