# Billing Rules

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Stripe Sync Engine

Data flows ONE direction: Stripe → Supabase.

| What | How |
|------|-----|
| Products/prices | Create via Stripe API (`curl`). Sync Engine populates `stripe.products`, `stripe.prices` |
| Customers | Create via Edge Function with `metadata.user_id`. Sync Engine populates `stripe.customers` |
| Subscriptions | Created by Stripe Checkout. Sync Engine populates `stripe.subscriptions` |
| Checkout sessions | Created by Stripe Checkout. Sync Engine populates `stripe.checkout_sessions` + `stripe.checkout_session_line_items` |
| Invoices | Created by Stripe. Sync Engine populates `stripe.invoices` |

**Never write to `stripe.*` tables directly.** They're read-only mirrors.

### Querying Stripe tables

Every table has `_raw_data` jsonb with the full Stripe object. Key patterns:

```sql
-- Find customer by user_id (use the helper function)
SELECT public._stripe_resolve_customer_id(user_uuid);

-- Get active subscription product
SELECT lower(pr.name)
FROM stripe.subscriptions s
JOIN stripe.products pr ON pr.id = (s.plan::jsonb->>'product')
WHERE s.customer = :customerId AND s.status IN ('active', 'trialing');

-- Check lifetime purchase
SELECT 1 FROM stripe.checkout_sessions cs
JOIN stripe.checkout_session_line_items li ON li.checkout_session = cs.id
WHERE cs.customer = :customerId
  AND cs.mode = 'payment'
  AND cs.payment_status = 'paid'
  AND (li.price::jsonb->>'product') = :lifetimeProductId;
```

## Customer Mapping

```typescript
// Edge functions link auth.users to Stripe customers
const customer = await stripe.customers.create({
  email: user.email,
  metadata: { user_id: user.id }
})
```

Customer resolution order (in stripe-checkout edge function):
1. `_stripe_resolve_customer_id` RPC (instant, from Sync Engine)
2. `stripe.customers.search` (Stripe API, eventually consistent ~1min)
3. `stripe.customers.create` (new customer)

## Upgrade-Only Model

| Rule | Why |
|------|-----|
| No downgrade buttons on billing page | Reduces churn. Downgrades go through Stripe Portal. |
| No cancel button on billing page | Same. Small "Manage billing" link opens Stripe Portal. |
| Upgrade in-place, not new subscription | Prevents duplicate subscriptions. Uses `subscriptions.update()`. |
| Lifetime > subscription > default | Priority order for plan resolution. Default plan depends on the project (could be `'free'`, `'starter'`, etc.). |

## Pricing Psychology

| Model | Application |
|-------|-------------|
| **Anchoring** | Lifetime price makes monthly look reasonable |
| **Decoy effect** | Middle tier is "Most Popular" — obvious best value |
| **Charm pricing** | $29, $79, $199 — not round numbers |
| **Loss framing** | "Pay once. Forever." eliminates recurring cost anxiety |
| **Default plan** | Set in `get_user_plan()` — project decides if there's a free tier or if every user pays. |

## oRPC Procedure Pattern

All Stripe procedures call the Stripe SDK directly from oRPC (no edge function middleman):

```
1. oRPC middleware authenticates user (JWT)
2. Resolve Stripe customer (DB lookup → create if needed)
3. Validate inputs (URL domain check, price/product active, tier match)
4. Perform Stripe operation via SDK
5. Return result
```

Source: `webapp/lib/orpc/procedures/stripe.ts`

## File Organization

```
supabase/functions/
├── stripe-checkout/index.ts    → New subscriptions + one-time payments
├── stripe-portal/index.ts      → Customer portal (manage/cancel)
└── stripe-upgrade/index.ts     → In-place subscription upgrade

webapp/
├── lib/stripe/index.ts         → Stripe client singleton
├── lib/auth/utils.ts           → getPlan() reads JWT claim
├── lib/orpc/procedures/
│   ├── stripe.ts               → Checkout, upgrade, portal, subscription, products
│   └── stripe-admin.ts         → Admin CRUD for products/prices
├── features/stripe/
│   ├── index.ts                → Barrel exports
│   ├── components/
│   │   └── billing-page.tsx    → Plan cards, upgrade flow
│   └── hooks/
│       ├── use-stripe-mutations.ts  → useCheckoutMutation, useUpgradeMutation, usePortalMutation
│       ├── use-subscription.ts      → useSubscription query
│       └── index.ts                 → Barrel exports
└── app/protected/billing/
    └── page.tsx                → Server component, reads JWT claims
```

## Billing Data Isolation

Same rules as `../../auth/references/auth-rules.md` → Billing Data Isolation (one source). The short form: plan and billing identity never live on a row the user can update.

## Plan Gating

Three strategies (hard block / soft gate / empty response), the decision tree, the shared components, and what the planner pins per procedure: `.foundry/references/source-docs/patterns/billing/plan-gating.md`. The judgment — an absent claim is a denied claim; free users see a path, never an error — is `.foundry/philosophy/entitlement.md`.

## Payment Emails

Users must receive email confirmation after billing events. Never let a payment happen in silence.

| Event | Email | Trigger |
|-------|-------|---------|
| New subscription | "Welcome to {Plan}" | `billing/subscription.created` Inngest event |
| Upgrade | "Upgraded to {Plan}" | `billing/subscription.upgraded` Inngest event |

Emails are sent by Inngest functions (fire-and-forget), NOT from the confirm page or oRPC procedure. Events are sent from the confirm procedure (after payment verified) and the upgrade procedure (after `subscriptions.update` succeeds).

## Banned Patterns

Most of the old table restated the sections above (read-only `stripe.*`, upgrade in place, portal for downgrades, isolation, payment emails). Three rules live only here:

| Pattern | Why |
|---------|-----|
| Storing card details | PCI violation. Stripe Checkout handles payment. |
| Hardcoded price IDs in DB | Price IDs go in frontend plan config, not database. |
| Trusting a client-supplied tier — `product.metadata?.tier \|\| input.tier`, or a product without `metadata.tier` | Tier escalation via a cheap price. Read the tier from `product.metadata.tier` only; reject if missing. |

The default plan when nothing resolves is the least privilege that exists — see `.foundry/philosophy/entitlement.md`. Whether that lowest tier is free or paid is the product's call, made in `get_user_plan()`.
