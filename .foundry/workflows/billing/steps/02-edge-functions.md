# Step 2: Database Functions

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Create the Supabase database functions that power billing. These are security-definer functions that query `stripe.*` tables (populated by the Sync Engine).

## Functions to Create

### 1. `_stripe_resolve_customer_id(p_user_id uuid) -> text`

Looks up the Stripe customer ID from the synced `stripe.customers` table. Used by oRPC procedures before any Stripe API call.

```sql
CREATE OR REPLACE FUNCTION _stripe_resolve_customer_id(p_user_id uuid) RETURNS text AS $$
  SELECT id FROM stripe.customers
  WHERE metadata->>'user_id' = p_user_id::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
```

### 2. `get_user_plan(p_user_id uuid) -> text`

Determines the user's current plan. Called by `custom_access_token_hook` on every JWT refresh.

Adapt this to your product's tier structure. The function should:
1. Resolve the Stripe customer
2. Check for active/trialing subscription (highest price wins)
3. Optionally check for one-time lifetime purchases
4. Default to `'free'`

See `references/how-it-works.md` for the full function template.

### 3. `get_my_subscription() -> jsonb`

Returns the calling user's active subscription with product/price details. Called by `stripe.getSubscription` oRPC procedure.

Returns `{ subscribed: true, subscription: { id, status, currentPeriodEnd, cancelAtPeriodEnd, productName, priceId, amount, currency, interval } }` or `{ subscribed: false, subscription: null }`.

### 4. `list_active_products() -> jsonb`

Returns all active products with their active prices. Called by `stripe.listProducts` oRPC procedure. Used to render pricing cards.

## Apply

All functions via `apply_migration` MCP.

## Output

Four security-definer functions created. Verify with:
```sql
SELECT proname FROM pg_proc WHERE proname IN (
  '_stripe_resolve_customer_id', 'get_user_plan',
  'get_my_subscription', 'list_active_products'
);
```
