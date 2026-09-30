# Polar Subscriptions & Orders

## Orders

Every successful purchase creates an Order. Orders contain: amount, tax amount, invoices, customer details, and past orders. Available in Dashboard > Sales.

## Subscriptions

Recurring products create subscriptions. Subscriptions have their own lifecycle independent of orders.

### Subscription via Checkout

```typescript
// Create checkout for a recurring product
const checkout = await polar.checkouts.create({
  products: ['MONTHLY_PLAN_ID'],
});
// Redirect to checkout.url
```

The product's billing cycle (monthly/yearly) determines subscription behavior. No extra subscription-specific API calls needed.

### Customer Portal

Let customers self-manage subscriptions:

```typescript
// Create authenticated portal session
const session = await polar.customerSessions.create({
  customerId: 'CUSTOMER_ID',
});
// Redirect to session.customerPortalUrl
```

Portal is also available at `https://polar.sh/your-org-slug/portal` -- customers authenticate via email.

### Customer State (Single API Call)

Get a customer's complete state -- active subscriptions, granted benefits, meter balances:

```typescript
// By external ID (your user system ID)
const state = await polar.customers.getStateExternal('your_user_123');

// By Polar customer ID
const state = await polar.customers.getState('POLAR_CUSTOMER_ID');
```

Listen to `customer.state_changed` webhook to keep your system in sync.

## Trials

Set trial period on product, checkout link, or checkout session. Checkout/session level **overrides** product level.

```typescript
// API checkout with trial override
const checkout = await polar.checkouts.create({
  products: ['PRODUCT_ID'],
  // Trial configured on the product or overridden here
});
```

### Trial Behavior
- Payment info collected at checkout but not charged until trial ends
- Cancel before trial end = no charge
- After trial, automatic billing + billing cycle starts

### Managing Trials on Existing Subscriptions
- **Add/extend**: Set future trial end date. Active sub moves to "trialing," billing postponed.
- **End early**: Click "End trial." Sub becomes active immediately, charged for new cycle.

### Preventing Trial Abuse

Enable "Prevent trial abuse" in org Settings > Subscription. Tracks by:
- **Email**: Normalizes aliases (`user+alias@example.com` -> `user@example.com`)
- **Payment method fingerprint**: Same card = same person

Blocked customers see error, checkout refreshes without trial, they can still subscribe at full price.

## Seat-Based Pricing (Beta)

Team products where a billing manager buys seats and assigns them to members.

### How It Works
1. Billing manager purchases product with N seats
2. Assigns seats to team members via email
3. Members receive invite email with 24-hour claim link
4. On claim, benefits are granted to the seat holder

**Key difference**: Benefits go to seat holders, NOT the billing manager.

### Pricing Tiers

```
1-4 seats: $10/seat/month
5-9 seats: $9/seat/month
10+ seats: $8/seat/month
```

### Subscription vs One-Time

| | Subscriptions | One-Time |
|---|---|---|
| **Payment** | Recurring | Single |
| **Duration** | While subscribed | Perpetual |
| **Add seats** | Modify subscription (prorated) | New purchase |
| **Benefits** | While active | Forever after claim |

### API

```typescript
// Assign a seat
await polar.customerSeats.assign({
  subscriptionId: 'sub_123', // or orderId for one-time
  email: 'engineer@company.com',
  metadata: { department: 'Engineering', role: 'Developer' },
});

// List seats
const seats = await polar.customerSeats.list({
  subscriptionId: 'sub_123',
});
console.log(`${seats.availableSeats}/${seats.totalSeats} available`);
```

### Seat States
- **Pending**: Invitation sent, awaiting claim
- **Claimed**: Benefits granted
- **Revoked**: Benefits removed, seat available for reassignment

Revoking does NOT issue a refund. Cannot reduce seat count below claimed seats -- revoke first.

### Limitations
- Max 1,000 seats per subscription
- Claim links expire after 24 hours (single-use)
- Metadata: 10 keys max, 1KB total per seat

## Events & Metering (Usage-Based)

Track usage events and bill based on metered consumption.

```typescript
// Ingest usage events
await polar.events.ingest({
  events: [{
    name: 'api_call',
    externalCustomerId: 'user_123',
    metadata: { endpoint: '/v1/generate', tokens: 1500 },
  }],
});
```

Features: hierarchical events, event spans, sub-cent cost tracking, batch ingestion, customer/member attribution.

Combine with Credits benefit type for prepaid usage models.

## Refunds

```typescript
await polar.refunds.create({
  orderId: 'ORDER_ID',
  // Full refund by default, or specify amount
});
```

On refund: benefits revoked (with optional grace period), order marked refunded, subscription may be revoked.

## Metrics

```typescript
const metrics = await polar.metrics.get({
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  interval: 'month',
});
```

Available: revenue, MRR, orders, AOV, checkout conversion, churn rate, cost insights.
