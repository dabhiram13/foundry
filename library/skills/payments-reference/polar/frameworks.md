# Polar Framework Integrations

First-class adapters for Next.js, SvelteKit, and Supabase. Each provides Checkout, CustomerPortal, and Webhooks helpers that reduce boilerplate to a few lines.

## Next.js

```bash
npm install zod @polar-sh/nextjs
```

### Checkout Route

```typescript
// app/checkout/route.ts
import { Checkout } from '@polar-sh/nextjs';

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: process.env.SUCCESS_URL!,
  returnUrl: 'https://myapp.com',         // optional back button
  server: 'sandbox',                        // omit for production
  theme: 'dark',                            // optional, defaults to system
});
// Usage: GET /checkout?products=PRODUCT_ID
// Optional params: customerId, customerExternalId, customerEmail, customerName, metadata (URL-encoded JSON)
```

### Customer Portal Route

```typescript
// app/portal/route.ts
import { CustomerPortal } from '@polar-sh/nextjs';

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  getCustomerId: async (req) => {
    // Resolve Polar customer ID from your auth system
    const session = await getSession(req);
    return session.polarCustomerId;
  },
  returnUrl: 'https://myapp.com',
  server: 'sandbox',
});
```

### Webhooks Route

```typescript
// app/api/webhook/polar/route.ts
import { Webhooks } from '@polar-sh/nextjs';

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    // Catch-all handler
  },
  onOrderCreated: async (payload) => {
    // New purchase -- provision access
    const customerId = payload.data.customer.externalId;
    await grantAccess(customerId);
  },
  onSubscriptionCanceled: async (payload) => {
    // Cancel at period end -- revoke access later
  },
  onSubscriptionRevoked: async (payload) => {
    // Immediately revoked -- revoke access now
  },
  onBenefitGrantCreated: async (payload) => {
    // Benefit granted (license key, file, etc.)
  },
  onCustomerStateChanged: async (payload) => {
    // Single event for all subscription/benefit changes
    // Use this if you want one handler instead of many
  },
});
```

### All Webhook Handlers

`onPayload`, `onCheckoutCreated`, `onCheckoutUpdated`, `onOrderCreated`, `onOrderUpdated`, `onOrderPaid`, `onOrderRefunded`, `onRefundCreated`, `onRefundUpdated`, `onSubscriptionCreated`, `onSubscriptionUpdated`, `onSubscriptionActive`, `onSubscriptionCanceled`, `onSubscriptionRevoked`, `onSubscriptionUncanceled`, `onProductCreated`, `onProductUpdated`, `onOrganizationUpdated`, `onBenefitCreated`, `onBenefitUpdated`, `onBenefitGrantCreated`, `onBenefitGrantUpdated`, `onBenefitGrantRevoked`, `onBenefitGrantCycled`, `onCustomerCreated`, `onCustomerUpdated`, `onCustomerDeleted`, `onCustomerStateChanged`, `onCustomerSeatAssigned`, `onCustomerSeatClaimed`, `onCustomerSeatRevoked`

## SvelteKit

```bash
npm install zod @polar-sh/sveltekit
```

### Checkout

```typescript
// src/routes/checkout/+server.ts
import { Checkout } from '@polar-sh/sveltekit';

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: process.env.SUCCESS_URL!,
  returnUrl: 'https://myapp.com',
  server: 'sandbox',
  theme: 'dark',
});
```

### Customer Portal

```typescript
// src/routes/portal/+server.ts
import { CustomerPortal } from '@polar-sh/sveltekit';

export const GET = CustomerPortal({
  server: process.env.POLAR_MODE,
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  returnUrl: 'https://myapp.com',
  getCustomerId: (event) => {
    // Resolve from your auth
    return event.locals.polarCustomerId;
  },
});
```

### Webhooks

```typescript
// src/routes/api/webhooks/polar/+server.ts
import { Webhooks } from '@polar-sh/sveltekit';

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    console.log(payload);
  },
  onOrderCreated: async (payload) => {
    // Handle purchase
  },
});
```

Same handler names as Next.js adapter.

## Supabase (Edge Functions)

```bash
npm install zod @polar-sh/supabase
```

### Checkout

```typescript
import { Checkout } from '@polar-sh/supabase';

export const GET = Checkout({
  accessToken: POLAR_ACCESS_TOKEN,
  successUrl: POLAR_SUCCESS_URL,
  returnUrl: 'https://myapp.com',
  server: 'sandbox',
  theme: 'dark',
});
```

### Customer Portal

```typescript
import { CustomerPortal } from '@polar-sh/supabase';

export const GET = CustomerPortal({
  accessToken: POLAR_ACCESS_TOKEN,
  getCustomerId: (event) => '', // resolve from Supabase auth
  returnUrl: 'https://myapp.com',
  server: 'sandbox',
});
```

### Webhooks

```typescript
import { Webhooks } from '@polar-sh/supabase';

export const POST = Webhooks({
  webhookSecret: POLAR_WEBHOOK_SECRET,
  onPayload: async (payload) => {
    // Handle payload
  },
});
```

Same handler names as Next.js and SvelteKit adapters.

## Other Framework Adapters

The SDK supports 12+ framework adapters with the same Checkout/Webhooks pattern: Astro, Express, Hono, Fastify, Remix, Nuxt, Elysia, Deno, TanStack Start, Better Auth.

Install the base SDK (`@polar-sh/sdk`) and use `validateEvent` from `@polar-sh/sdk/webhooks` for manual webhook validation. See [sdk.md](sdk.md) for examples.

## Gotchas

- **`zod` is a peer dependency** for all framework packages. Always install it alongside.
- **Webhook route must be public**: Don't put auth middleware on webhook endpoints.
- **`getCustomerId` is async**: Resolve your Polar customer ID from your auth session. Map your users to Polar customers during checkout using `externalCustomerId`.
- **`onSubscriptionCanceled` vs `onSubscriptionRevoked`**: "Canceled" means end-of-period (customer still has access). "Revoked" means immediate (revoke access now).
- **`customer.state_changed`**: Most versatile event. Fires for any subscription, benefit, or meter change. Use it as a single handler instead of subscribing to many events.
