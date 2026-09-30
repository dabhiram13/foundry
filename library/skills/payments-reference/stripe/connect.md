# Stripe Connect

Platforms and marketplaces use Connect to route payments between buyers and sellers/service providers.

## Accounts v2 API (Required for New Platforms)

Always use the [Accounts v2 API](https://docs.stripe.com/connect/accounts-v2.md) (`POST /v2/core/accounts`). This is Stripe's actively invested path.

**Never use** the legacy `type` parameter (`type: 'express'`, `type: 'custom'`, `type: 'standard'`) in `POST /v1/accounts` for new platforms.

## Controller Properties (Replaces Legacy Account Types)

Configure connected accounts with explicit `controller` properties instead of opaque "Standard"/"Express"/"Custom" labels:

| Property | Controls |
|----------|----------|
| `controller.losses.payments` | Who is liable for negative balances |
| `controller.fees.payer` | Who pays Stripe fees |
| `controller.stripe_dashboard.type` | Dashboard access: `full`, `express`, `none` |
| `controller.requirement_collection` | Who collects onboarding requirements |

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create connected account with explicit controls
const account = await stripe.accounts.create({
  controller: {
    losses: { payments: 'application' }, // platform absorbs losses
    fees: { payer: 'application' },      // platform pays fees
    stripe_dashboard: { type: 'express' },
    requirement_collection: 'stripe',     // Stripe handles onboarding
  },
  capabilities: {
    transfers: { requested: true },
    card_payments: { requested: true },
  },
  country: 'US',
});
```

**Don't use the terms "Standard", "Express", or "Custom" as account types.** These are legacy bundles. Controller properties give explicit control over each dimension.

## Charge Types (Pick One Per Integration)

### Destination Charges (Most Common)

Platform accepts liability for negative balances. Funds route to connected account.

```typescript
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'payment',
  payment_intent_data: {
    transfer_data: {
      destination: connectedAccountId,
      amount: 800, // connected account receives $8.00 of a $10.00 charge
    },
  },
  success_url: '...',
  cancel_url: '...',
});
```

### Direct Charges

Charge created on connected account directly. Platform wants Stripe to take risk.

```typescript
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'payment',
  success_url: '...',
  cancel_url: '...',
}, {
  stripeAccount: connectedAccountId, // charge on their account
});
```

### Transfers

Separate payment and transfer for complex splits:

```typescript
// 1. Charge on platform
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
});

// 2. Transfer to connected account(s)
const transfer = await stripe.transfers.create({
  amount: 7000,
  currency: 'usd',
  destination: connectedAccountId,
  transfer_group: 'ORDER_123',
});
```

## Onboarding

Use Stripe-hosted onboarding. Custom onboarding requires collecting/handling sensitive PII directly.

```typescript
const accountLink = await stripe.accountLinks.create({
  account: connectedAccountId,
  refresh_url: 'https://platform.com/reauth',
  return_url: 'https://platform.com/onboarding-complete',
  type: 'account_onboarding',
});
// Redirect to accountLink.url
```

## OAuth and CSRF

When implementing Connect OAuth flows, always use the `state` parameter:

```typescript
// Generate unique state per request
const state = crypto.randomUUID();
await storeState(state, sessionId); // save in session/DB

const authUrl = `https://connect.stripe.com/oauth/authorize?` +
  `response_type=code&client_id=${clientId}&scope=read_write&state=${state}`;

// In callback, verify state before proceeding
app.get('/callback', async (req, res) => {
  const validState = await verifyState(req.query.state, req.session.id);
  if (!validState) return res.status(403).send('Invalid state');
  // Exchange code for token...
});
```

## Gotchas

- **Don't mix charge types**: Pick destination OR direct charges for your integration. Mixing creates accounting complexity.
- **Don't use Charges API for Connect**: Use PaymentIntents or Checkout Sessions with `transfer_data` or `on_behalf_of`.
- **`on_behalf_of`**: Controls merchant of record. Read the docs carefully before using -- it changes who appears on the customer's credit card statement.
- **Platform liability**: With Express/Custom connected accounts (legacy terms), the platform bears financial liability for fraud and disputes. Standard accounts minimize this.
- **Onboarding requirements**: Connected accounts need to complete KYC. Monitor `account.updated` webhooks for `requirements.currently_due` to know when to prompt re-onboarding.
- **Negative balances**: If using `controller.losses.payments: 'application'`, your platform covers negative balances from disputes/refunds on connected accounts.

## Integration Guides

- [SaaS platforms and marketplaces](https://docs.stripe.com/connect/saas-platforms-and-marketplaces.md)
- [Interactive platform guide](https://docs.stripe.com/connect/interactive-platform-guide.md)
- [Design an integration](https://docs.stripe.com/connect/design-an-integration.md)
