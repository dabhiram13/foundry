# How Billing Works (Template Reference)

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

What the workflow steps don't cover — architecture, lifecycle, reactive triggers, and patterns.

## The Core Model

```
Stripe (source of truth)
  |
  | webhooks (managed automatically)
  v
Supabase Stripe Sync Engine
  |
  | mirrors ALL Stripe objects into stripe.* tables (read-only)
  v
stripe.subscriptions ─────────────────┐
stripe.checkout_sessions              │ queried at JWT time
stripe.products / stripe.prices       │ by get_user_plan()
  |                                   │ (NO local plan storage needed
  | also used by reactive triggers:   │  for subscriptions)
  v                                   v
stripe.refunds ──trigger──> revoke access     custom_access_token_hook
stripe.disputes ──trigger──> freeze access      → get_user_plan(user_id)
stripe.invoices ──trigger──> detect failures    → JWT { plan: "pro" }
```

**You never write to `stripe.*` tables.** They are read-only mirrors. `get_user_plan()` reads them at JWT time to resolve the plan — no local `plan_type` column needed. For one-time purchases, a `purchases` table (SELECT-only RLS) records verified payments via a SECURITY DEFINER RPC function. Reactive triggers handle refunds, disputes, and failed payments.

## What the Sync Engine Gives You

| Table | Updated when | Key columns |
|-------|-------------|-------------|
| `stripe.customers` | Customer created/updated | `id`, `email`, `metadata` (contains `user_id`) |
| `stripe.subscriptions` | Sub created, updated, canceled, payment fails | `id`, `customer`, `status`, `cancel_at_period_end`, `current_period_end`, `plan` (price ID) |
| `stripe.checkout_sessions` | Checkout completes | `id`, `customer`, `mode`, `payment_status`, `metadata` |
| `stripe.products` | Product created/updated | `id`, `name`, `active`, `metadata` |
| `stripe.prices` | Price created/updated | `id`, `product`, `unit_amount`, `currency`, `type`, `recurring` |
| `stripe.invoices` | Invoice created, paid, failed | `id`, `customer`, `status`, `subscription` |
| `stripe.refunds` | Refund issued | `id`, `charge`, `amount`, `status` |
| `stripe.disputes` | Chargeback opened | `id`, `charge`, `status`, `reason` |
| `stripe.charges` | Charge succeeds/fails | `id`, `customer`, `amount`, `refunded`, `disputed` |

All tables also have `_raw_data` jsonb with the full Stripe object.

## Subscription Status Lifecycle

```
checkout.completed
  |
  v
active ──payment fails──> past_due ──retries exhausted──> unpaid ──> canceled
  |                                                          |
  |──user cancels now──> canceled                            |
  |──user cancels at period end──> active (cancel_at_period_end=true) ──period ends──> canceled
  |
  v
trialing ──trial ends + payment works──> active
         ──trial ends + payment fails──> past_due
```

| Status | User should have access? | Action needed |
|--------|------------------------|---------------|
| `active` | Yes | None |
| `trialing` | Yes | None |
| `past_due` | Grace period (your choice) | Notify user, show "update payment" banner |
| `canceled` | No (or until period end) | Revoke/downgrade plan |
| `unpaid` | No | Revoke plan |
| `incomplete` | No | Checkout didn't finish |
| `incomplete_expired` | No | Checkout expired |

## Post-Payment Confirm Page Pattern

After Stripe Checkout, **never redirect straight to the destination page.** Instead:

```
Stripe Checkout ──success_url──> protected/confirm?session_id={CHECKOUT_SESSION_ID}
                                   |
                                   | polls oRPC procedure every 2s (max 20 attempts / 40s)
                                   | procedure calls Stripe API to verify payment_status === 'paid'
                                   | procedure upserts purchase record in your DB
                                   |
                                   v
                                 confirmed
                                   |
                                   | await refreshClaims()  ← force JWT refresh so plan claim updates
                                   | router.refresh()       ← re-render server components
                                   |
                                   v
                                 router.replace('/destination')  ← clean redirect after 1.2s
```

**Why this matters:**
- Stripe Checkout redirects immediately, but Sync Engine + webhook processing takes seconds
- Polling the Stripe API directly gives instant confirmation (<2s) vs waiting for webhooks
- `refreshClaims()` calls `supabase.auth.refreshSession()` which re-runs `custom_access_token_hook` — the JWT `plan` claim updates immediately
- The confirm page shows a nice loading > checkmark > redirect UX instead of a broken page
- `session_id` in the URL is validated server-side (user ownership + payment status) — safe redirect

**Template provides:** `lib/auth/refresh.ts` with `refreshClaims()` helper.

**Each product creates its own confirm route** with a product-specific redirect destination. The confirm page component is reusable — just change the redirect destination and the confirm procedure call.

## Reactive Triggers (Not in Steps Yet)

The workflow steps cover `get_user_plan()` and the JWT hook. These triggers handle the events that the steps don't cover — refunds, disputes, and failed payments. Create them as needed per project.

### React to refunds

When you issue a refund in Stripe, the Sync Engine writes to `stripe.refunds`. You need to revoke access.

```sql
CREATE OR REPLACE FUNCTION handle_refund() RETURNS trigger AS $$
DECLARE
  v_customer_id text;
  v_user_id uuid;
BEGIN
  SELECT customer INTO v_customer_id
  FROM stripe.charges WHERE id = NEW.charge;

  SELECT (metadata->>'user_id')::uuid INTO v_user_id
  FROM stripe.customers WHERE id = v_customer_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Your revocation logic here:
  -- For one-time purchases: delete/deactivate the purchase row
  -- For subscriptions: Stripe handles this (status changes to canceled)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_refund_issued
  AFTER INSERT ON stripe.refunds
  FOR EACH ROW EXECUTE FUNCTION handle_refund();
```

### React to disputes

Chargebacks mean the user got their money back AND might keep access.

```sql
CREATE OR REPLACE FUNCTION handle_dispute() RETURNS trigger AS $$
DECLARE
  v_customer_id text;
  v_user_id uuid;
BEGIN
  IF NEW.status NOT IN ('needs_response', 'under_review', 'warning_needs_response') THEN
    RETURN NEW;
  END IF;

  SELECT customer INTO v_customer_id
  FROM stripe.charges WHERE id = NEW.charge;

  SELECT (metadata->>'user_id')::uuid INTO v_user_id
  FROM stripe.customers WHERE id = v_customer_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Freeze access, flag for admin review
  -- Insert into notifications/alerts table

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_dispute_created
  AFTER INSERT OR UPDATE ON stripe.disputes
  FOR EACH ROW EXECUTE FUNCTION handle_dispute();
```

### Detect failed payments

```sql
CREATE OR REPLACE FUNCTION handle_invoice_failure() RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.status != 'open' OR NEW.subscription IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (metadata->>'user_id')::uuid INTO v_user_id
  FROM stripe.customers WHERE id = NEW.customer;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Notify user: "Your payment failed. Update your payment method."
  -- Insert into notifications table, or trigger Inngest function for email

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_invoice_failed
  AFTER INSERT OR UPDATE ON stripe.invoices
  FOR EACH ROW EXECUTE FUNCTION handle_invoice_failure();
```
