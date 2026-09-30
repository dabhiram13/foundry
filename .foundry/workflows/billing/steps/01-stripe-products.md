# Step 1: Create Stripe Products + Prices

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Create the actual Stripe products and prices that power billing. This is the foundation — everything else reads from these.

## Read First

- `docs/project/product-overview.md (pricing section)` — tiers, prices, features per tier

## Actions

### 1. Map tiers from pricing model

Read the pricing model and decide:

| Tier | Type | Price | Stripe Product Name | Stripe Price Type |
|------|------|-------|--------------------|--------------------|
| {Tier 1} | subscription | $X/mo | {Name} | `recurring` (monthly) |
| {Tier 2} | subscription | $X/mo | {Name} | `recurring` (monthly) |
| {Lifetime} | one-time | $X | Lifetime | `one_time` |

Rules:
- **No free tier.** Every user is on a paid plan. Default plan = lowest tier name.
- **Tier order matters.** Users can only upgrade, never downgrade from the billing page.
- **Lifetime** (optional): one-time payment that grants highest-tier access forever.

### 2. Create products via Stripe API

Use `curl` against the Stripe API. One product per tier.

**CRITICAL: Every product MUST have `metadata[tier]` set.** The checkout procedure rejects requests when the product has no `metadata.tier` — this prevents tier escalation (attacker buying cheapest product and claiming any tier).

```bash
# Create a product — ALWAYS include metadata[tier]
curl -s https://api.stripe.com/v1/products \
  -u $STRIPE_SECRET_KEY: \
  -d "name=Starter" \
  -d "description=Daily ideas. Full research. Templates." \
  -d "metadata[tier]=starter"
```

The `metadata.tier` value must match the tier name used in `get_user_plan()` and frontend plan config (e.g. `starter`, `pro`, `lifetime`).

Record each product ID (`prod_xxx`).

### 3. Create prices for each product

**Recurring (subscription) prices:**
```bash
curl -s https://api.stripe.com/v1/prices \
  -u $STRIPE_SECRET_KEY: \
  -d "product=prod_xxx" \
  -d "unit_amount=2900" \
  -d "currency=usd" \
  -d "recurring[interval]=month"
```

**One-time prices (lifetime):**
```bash
curl -s https://api.stripe.com/v1/prices \
  -u $STRIPE_SECRET_KEY: \
  -d "product=prod_xxx" \
  -d "unit_amount=19900" \
  -d "currency=usd"
```

Record each price ID (`price_xxx`).

### 4. Deactivate unused products

If old/legacy products exist, deactivate them:

```bash
curl -s https://api.stripe.com/v1/products/prod_xxx \
  -u $STRIPE_SECRET_KEY: \
  -d "active=false"
```

### 5. Verify in Sync Engine

Wait for Stripe Sync Engine to populate. Then verify:

```sql
SELECT p.name, pr.id AS price_id, pr.unit_amount, pr.type
FROM stripe.products p
JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
WHERE p.active = true
ORDER BY pr.unit_amount;
```

## Output

A tier map with product IDs and price IDs. Example:

```
Starter  | prod_xxx | price_xxx | $29/mo  | recurring
Pro      | prod_xxx | price_xxx | $79/mo  | recurring
Lifetime | prod_xxx | price_xxx | $199    | one_time
```

Pass these IDs to Steps 3 (procedures) and 5 (billing page).
