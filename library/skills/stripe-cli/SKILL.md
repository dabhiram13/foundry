---
name: stripe-cli
version: 1.0.0
description: >
  Stripe CLI for products, prices, webhooks and payment testing. Use for "stripe cli",
  "stripe listen", "forward webhooks", "create a stripe product", "test card",
  "trigger a stripe event".
requires:
  bins: ["stripe"]
  install: "brew tap stripe/stripe-cli && brew install stripe"
---

# Stripe CLI Usage Guide

Use the `stripe` CLI for product management, webhook testing, and billing operations.

## Authentication

```bash
# Interactive login (opens browser)
stripe login

# Check auth status
stripe config --list
```

## Products & Prices

### Create a product with metadata

Every product MUST have `metadata[tier]` — without it, checkout rejects the request.

```bash
# Create product
stripe products create \
  --name="Starter Kit" \
  --description="One-time kit purchase" \
  -d "metadata[tier]=starter"

# Create one-time price
stripe prices create \
  --product=prod_XXX \
  --currency=usd \
  --unit-amount=2900

# Create recurring price
stripe prices create \
  --product=prod_XXX \
  --currency=usd \
  --unit-amount=4900 \
  -d "recurring[interval]=month"
```

### List and inspect

```bash
# List products
stripe products list --limit 10

# List prices for a product
stripe prices list -d "product=prod_XXX"

# Get a specific resource
stripe products retrieve prod_XXX
stripe prices retrieve price_XXX
stripe subscriptions retrieve sub_XXX
stripe customers retrieve cus_XXX
```

### Update and archive

```bash
# Update product metadata
stripe products update prod_XXX -d "metadata[tier]=pro"

# Archive a product (soft delete)
stripe products update prod_XXX --active=false

# Deactivate a price
stripe prices update price_XXX --active=false
```

## Webhook Testing

### Forward webhooks to local dev

```bash
# Forward all events to local endpoint
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Forward specific events only
stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,customer.subscription.updated,invoice.paid

# The CLI prints a webhook signing secret (whsec_...) — use this for local testing
```

### Trigger test events

```bash
# Trigger a checkout completion
stripe trigger checkout.session.completed

# Trigger subscription events
stripe trigger customer.subscription.created
stripe trigger invoice.paid

# Trigger payment events
stripe trigger payment_intent.succeeded
```

## Customers

```bash
# List customers
stripe customers list --limit 10

# Search customers by email
stripe customers search --query "email:'test@example.dev'"

# Create a customer
stripe customers create --email="test@example.dev" --name="Test User"
```

## Subscriptions

```bash
# List active subscriptions
stripe subscriptions list --status=active --limit 10

# Cancel a subscription
stripe subscriptions cancel sub_XXX
```

## Debugging

```bash
# View recent events
stripe events list --limit 10

# View a specific event
stripe events retrieve evt_XXX

# View recent API logs
stripe logs tail
```

## Default Products for Setup

When setting up billing, create these three products:

```bash
STRIPE_KEY=$(grep STRIPE_SECRET_KEY webapp/.env | cut -d= -f2-)

# 1. Starter Kit ($29, one-time)
stripe products create \
  --name="Starter Kit" \
  --description="One-time kit purchase" \
  -d "metadata[tier]=starter" \
  --api-key="$STRIPE_KEY"

# Get the product ID from output, then:
stripe prices create \
  --product=prod_XXX \
  --currency=usd \
  --unit-amount=2900 \
  --api-key="$STRIPE_KEY"

# 2. Pro Plan ($49/month, recurring)
stripe products create \
  --name="Pro Plan" \
  --description="Monthly pro subscription" \
  -d "metadata[tier]=pro" \
  --api-key="$STRIPE_KEY"

stripe prices create \
  --product=prod_XXX \
  --currency=usd \
  --unit-amount=4900 \
  -d "recurring[interval]=month" \
  --api-key="$STRIPE_KEY"

# 3. Lifetime Access ($199, one-time)
stripe products create \
  --name="Lifetime Access" \
  --description="One-time lifetime purchase" \
  -d "metadata[tier]=lifetime" \
  --api-key="$STRIPE_KEY"

stripe prices create \
  --product=prod_XXX \
  --currency=usd \
  --unit-amount=19900 \
  --api-key="$STRIPE_KEY"
```

After creating, verify products appear in Supabase Stripe Sync Engine:

```sql
-- Via supabase db query --linked
SELECT p.name, p.metadata->>'tier' as tier, pr.unit_amount, pr.type
FROM stripe.products p
JOIN stripe.prices pr ON pr.product_id = p.id
WHERE p.active = true
ORDER BY pr.unit_amount;
```

## Key Rules

- Every product MUST have `metadata[tier]` — security requirement, not optional
- Use `--api-key` flag or set `STRIPE_SECRET_KEY` env var for non-interactive usage
- Test keys start with `sk_test_`, live keys with `sk_live_` — never mix environments
- Webhook signing secret from `stripe listen` is different from your API key
- Products synced to Supabase via Stripe Sync Engine (read-only in DB, managed by Stripe)
