# Stripe Subscriptions

## Core Model

- **Product**: What you're selling
- **Price**: How much and how often (replaces deprecated `plan` object)
- **Subscription**: Customer's recurring payment
- **Invoice**: Generated each billing cycle

Use the Billing APIs for any recurring revenue model: subscriptions, usage-based, seat-based. Don't build manual renewal loops with raw PaymentIntents -- Billing handles renewal, retry logic, and dunning automatically.

## Subscription via Checkout Sessions (Recommended)

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create subscription checkout
const session = await stripe.checkout.sessions.create({
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: 'Pro Plan' },
      unit_amount: 2000,
      recurring: { interval: 'month' },
    },
    quantity: 1,
  }],
  mode: 'subscription',
  success_url: 'https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://yourdomain.com/cancel',
});
// Redirect to session.url
```

Checkout Sessions support `mode: 'subscription'` and handle initial payment, trial management, and proration automatically.

## Subscription via API (More Control)

```typescript
async function createSubscription(customerId: string, priceId: string) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });

  return {
    subscriptionId: subscription.id,
    clientSecret: (subscription.latest_invoice as Stripe.Invoice)
      .payment_intent?.client_secret,
  };
  // Send clientSecret to frontend to collect payment
}
```

## Customer Portal (Self-Service)

Let customers manage upgrades, downgrades, cancellation, and payment method updates.

```typescript
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: 'https://yourdomain.com/account',
});
// Redirect to portalSession.url
```

Configure allowed actions in the Dashboard under Billing > Customer Portal.

## Trials

```typescript
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  trial_period_days: 14,
  payment_settings: { save_default_payment_method: 'on_subscription' },
});
```

Or via Checkout:

```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  subscription_data: { trial_period_days: 14 },
  success_url: '...',
  cancel_url: '...',
});
```

## Proration

When changing plans mid-cycle, Stripe prorates by default.

```typescript
// Upgrade/downgrade
const subscription = await stripe.subscriptions.update(subscriptionId, {
  items: [{
    id: subscriptionItemId,
    price: newPriceId,
  }],
  proration_behavior: 'create_prorations', // default
  // Other options: 'none', 'always_invoice'
});
```

## Usage-Based Billing

```typescript
// Create metered price
const price = await stripe.prices.create({
  currency: 'usd',
  product: productId,
  recurring: {
    interval: 'month',
    usage_type: 'metered',
  },
  unit_amount: 10, // $0.10 per unit
});

// Report usage
await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
  quantity: 100,
  timestamp: Math.floor(Date.now() / 1000),
  action: 'increment', // or 'set'
});
```

## Key Webhook Events

| Event | When |
|-------|------|
| `customer.subscription.created` | New subscription |
| `customer.subscription.updated` | Plan change, status change |
| `customer.subscription.deleted` | Subscription canceled |
| `invoice.payment_succeeded` | Renewal payment succeeded |
| `invoice.payment_failed` | Renewal payment failed (dunning starts) |
| `customer.subscription.trial_will_end` | 3 days before trial ends |

## Gotchas

- **Don't use `plan` object**: Use `Price` everywhere. `plan` is deprecated.
- **`default_incomplete`**: Set `payment_behavior: 'default_incomplete'` when creating subscriptions via API so you can collect payment on the frontend. Without it, Stripe attempts payment immediately.
- **Portal configuration**: The Customer Portal shows nothing useful until you configure it in the Dashboard. Enable the features you want (cancel, plan switch, payment method update).
- **Webhook-driven fulfillment**: Never grant access based on the subscription create response alone. Always confirm via `invoice.payment_succeeded` webhook -- the initial payment might require 3D Secure or may fail.
- **Dunning**: Stripe retries failed payments automatically (Smart Retries). Configure dunning behavior in Dashboard > Billing > Subscriptions > Manage failed payments.
- **Proration edge case**: Changing plans near the end of a billing cycle can create tiny invoices. Set `proration_behavior: 'none'` if you want changes to apply at next renewal.
