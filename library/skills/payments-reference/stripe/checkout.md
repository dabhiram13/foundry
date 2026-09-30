# Stripe Checkout

Latest API version: **2026-03-25.dahlia**. Always use the latest version unless specified otherwise.

## API Hierarchy

Use **Checkout Sessions** (`checkout.sessions.create`) for on-session payments. Supports one-time payments, subscriptions, taxes, discounts, shipping, and adaptive pricing automatically.

Use **PaymentIntents** only for off-session payments or when you need to model checkout state independently.

**Never use**: Charges API (deprecated), Sources API (deprecated), Tokens API (outdated), Card Element (legacy).

## Integration Surfaces (pick one, in order of preference)

1. **Payment Links** -- No-code. Best for simple products.
2. **Checkout** (Stripe-hosted or embedded) -- Best for most web apps.
3. **Payment Element** -- Embedded UI component for advanced customization. Back it with Checkout Sessions via `ui_mode: 'custom'` over raw PaymentIntents.

## Pattern 1: One-Time Payment (Hosted Checkout)

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function createCheckoutSession(amount: number, currency = 'usd') {
  const session = await stripe.checkout.sessions.create({
    line_items: [{
      price_data: {
        currency,
        product_data: {
          name: 'Blue T-shirt',
          images: ['https://example.com/product.jpg'],
        },
        unit_amount: amount, // cents -- 2000 = $20.00
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://yourdomain.com/cancel',
    metadata: {
      order_id: 'order_123',
      user_id: 'user_456',
    },
  });
  return session; // redirect user to session.url
}
```

## Pattern 2: Payment Element with Checkout Sessions (Recommended)

Server creates session with `ui_mode: 'custom'`, sends `client_secret` to frontend.

```typescript
// Server
async function createEmbeddedSession(amount: number, currency = 'usd') {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ui_mode: 'custom',
    line_items: [{
      price_data: {
        currency,
        product_data: { name: 'Blue T-shirt' },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    return_url: 'https://yourdomain.com/complete?session_id={CHECKOUT_SESSION_ID}',
  });
  return session.client_secret; // send to frontend
}
```

```javascript
// Client
const stripe = Stripe('pk_test_...');
const checkout = stripe.initCheckout({
  clientSecret,
  elementsOptions: { appearance: { theme: 'stripe' } },
});

const loadResult = await checkout.loadActions();
if (loadResult.type === 'success') {
  const { actions } = loadResult;

  // Mount Payment Element
  const paymentElement = checkout.createPaymentElement();
  paymentElement.mount('#payment-element');

  // Handle email
  emailInput.addEventListener('blur', () => {
    actions.updateEmail(emailInput.value).then(result => {
      if (result.error) emailErrors.textContent = result.error.message;
    });
  });

  // Confirm payment
  payButton.addEventListener('click', () => {
    actions.confirm().then(result => {
      if (result.type === 'error') errors.textContent = result.error.message;
    });
  });
}
```

## Pattern 3: Payment Element with PaymentIntents (Alternative)

Only when you need bespoke control over the amount calculation.

```typescript
// Server
async function createPaymentIntent(amount: number, currency = 'usd', customerId?: string) {
  const intent = await stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    automatic_payment_methods: { enabled: true },
  });
  return intent.client_secret;
}
```

```javascript
// Client
const elements = stripe.elements({ appearance: { theme: 'stripe' }, clientSecret });
const paymentElement = elements.create('payment');
paymentElement.mount('#payment-element');

payButton.addEventListener('click', async () => {
  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: 'https://yourdomain.com/complete' },
  });
  if (error) errors.textContent = error.message;
});
```

## Setup Intents (Save Payment Methods for Later)

```typescript
const setupIntent = await stripe.setupIntents.create({
  customer: customerId,
  automatic_payment_methods: { enabled: true },
});
// Send setupIntent.client_secret to frontend
```

## Dynamic Payment Methods

Enable in Stripe Dashboard rather than passing `payment_method_types`. Stripe auto-selects based on customer location, wallets, and preferences.

## Customer Management

```typescript
// Create customer
const customer = await stripe.customers.create({
  email: 'user@example.com',
  name: 'Jane Doe',
  payment_method: paymentMethodId,
  invoice_settings: paymentMethodId
    ? { default_payment_method: paymentMethodId }
    : undefined,
  metadata: { user_id: '12345' },
});

// Attach and set default payment method
await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
await stripe.customers.update(customerId, {
  invoice_settings: { default_payment_method: paymentMethodId },
});
```

## Refunds

```typescript
// Full refund
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
});

// Partial refund
const partialRefund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: 500, // $5.00
  reason: 'requested_by_customer', // or 'duplicate', 'fraudulent'
});
```

## Gotchas

- **Confirmation Tokens**: For inspecting card details before payment (surcharging), use Confirmation Tokens. Don't use `createPaymentMethod` or `createToken`.
- **Deprecated Sources API**: Never use Sources to save cards. Use Setup Intents.
- **Card Element migration**: If you see legacy Card Element, migrate to Payment Element.
- **PCI raw PAN**: If sending server-side raw PAN data, user must prove PCI compliance for `payment_method_data`.
- **`{CHECKOUT_SESSION_ID}`**: This is a template literal Stripe replaces in the URL -- keep it verbatim in `success_url`.
- **Amount is in cents**: `unit_amount: 2000` = $20.00. Forgetting this is the #1 pricing bug.

## Deprecated APIs and Migration

| API | Status | Use Instead | Migration |
|-----|--------|-------------|-----------|
| Charges API | Never use | Checkout Sessions or PaymentIntents | [Guide](https://docs.stripe.com/payments/payment-intents/migration/charges.md) |
| Sources API | Deprecated | Setup Intents | [Docs](https://docs.stripe.com/api/setup_intents.md) |
| Tokens API | Outdated | Setup Intents or Checkout Sessions | -- |
| Card Element | Legacy | Payment Element | [Guide](https://docs.stripe.com/payments/payment-element/migration.md) |
| `plan` object | Deprecated | Prices API | [Docs](https://docs.stripe.com/api/prices.md) |
