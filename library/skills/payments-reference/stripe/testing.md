# Stripe Testing

## Test Mode Keys

All Stripe accounts have test mode keys (`sk_test_...`, `pk_test_...`). Test mode is completely separate from live mode -- different data, different webhooks.

## Test Card Numbers

| Card | Behavior |
|------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | Requires 3D Secure |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0341` | Attaching to customer fails |
| `4000 0000 0000 3220` | 3D Secure 2 required |

Use any future expiration date and any 3-digit CVC. For ZIP, any 5 digits work.

### Test Payment Methods (Shorthand)

```typescript
// In test mode, use these instead of real card data
const intent = await stripe.paymentIntents.confirm(intentId, {
  payment_method: 'pm_card_visa',           // success
  // payment_method: 'pm_card_chargeDeclined', // decline
  // payment_method: 'pm_card_threeDSecure2Required', // 3DS
});
```

## Stripe CLI

```bash
# Install
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhook/stripe
# Prints: whsec_... -- use as STRIPE_WEBHOOK_SECRET

# Trigger specific events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created

# Tail API request logs
stripe logs tail

# Create test resources
stripe customers create --email test@example.com
stripe prices create --currency usd --unit-amount 2000 \
  --recurring-interval month --product prod_xxx
```

## Test Clocks (Subscription Time Travel)

Simulate subscription lifecycle without waiting real time.

```typescript
// Create a test clock
const testClock = await stripe.testHelpers.testClocks.create({
  frozen_time: Math.floor(Date.now() / 1000),
});

// Create customer attached to the clock
const customer = await stripe.customers.create({
  email: 'test@example.com',
  test_clock: testClock.id,
});

// Create subscription for that customer
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: priceId }],
  trial_period_days: 14,
});

// Advance time to end trial
await stripe.testHelpers.testClocks.advance(testClock.id, {
  frozen_time: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
});
// Subscription now moves from trialing -> active, invoice created
```

## Complete Test Flow

```typescript
async function testPaymentFlow() {
  // Create test customer
  const customer = await stripe.customers.create({
    email: 'test@example.com',
  });

  // Create payment intent
  const intent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: 'usd',
    customer: customer.id,
    automatic_payment_methods: { enabled: true },
  });

  // Confirm with test card
  const confirmed = await stripe.paymentIntents.confirm(intent.id, {
    payment_method: 'pm_card_visa',
  });

  assert(confirmed.status === 'succeeded');

  // Test refund
  const refund = await stripe.refunds.create({
    payment_intent: intent.id,
  });
  assert(refund.status === 'succeeded');
}
```

## Gotchas

- **Test mode webhooks need separate endpoints**: Register webhook endpoints specifically for test mode. Live mode endpoints won't receive test events.
- **Test clocks are slow**: Advancing a test clock processes all intermediate events (invoices, payments, renewals). Large advances can take seconds.
- **Stripe CLI webhook secret**: The `whsec_...` printed by `stripe listen` is different from your Dashboard webhook signing secret. Use the CLI one for local development.
- **Rate limits in test mode**: Same rate limits as production. Batch test operations can hit limits.
- **Test clock cleanup**: Test clocks and their associated objects count toward your API object limits. Delete them after testing.
- **`stripe trigger` vs real flow**: `stripe trigger` sends a synthetic event -- useful for testing handler code, but the objects in the event may not match real-world shape exactly.
