# Polar

Payment platform for digital products: subscriptions, one-time purchases, license keys, file downloads, and automated benefit delivery. Built for developers and creators.

## Why Polar

- **Benefits model**: Attach license keys, file downloads, Discord roles, GitHub repo access directly to products. Automatically granted on purchase, revoked on cancel/refund.
- **Typed SDKs**: First-class adapters for Next.js, SvelteKit, Supabase, and 12+ frameworks.
- **Simpler than Stripe**: Fewer concepts, fewer API calls for common patterns.
- **Seat-based pricing**: Built-in team subscriptions with invite/claim flow (beta).
- **Usage-based billing**: Events & Meters for metered products.
- **Sandbox environment**: Separate instance at `sandbox.polar.sh` for testing.

## Quick Start

### 1. Install

```bash
npm install @polar-sh/sdk
# Framework-specific:
npm install @polar-sh/nextjs    # Next.js
npm install @polar-sh/sveltekit  # SvelteKit
npm install @polar-sh/supabase   # Supabase
npm install @polar-sh/checkout   # Embedded checkout
```

Pin versions to avoid breaking changes: `@polar-sh/sdk@^0.46`

### 2. Configure

```bash
# .env
POLAR_ACCESS_TOKEN=polar_at_xxx   # Organization Access Token from dashboard
POLAR_WEBHOOK_SECRET=xxx          # Webhook signing secret
```

Create Organization Access Tokens (OAT) from organization settings. Tokens are tied to **one** organization.

### 3. Initialize SDK

```typescript
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'sandbox', // or 'production'
});
```

### 4. Create Checkout

```typescript
const checkout = await polar.checkouts.create({
  products: ['PRODUCT_ID'],
});
// Redirect user to checkout.url
```

### 5. Handle Webhooks

```typescript
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';

// In your webhook handler:
const event = validateEvent(rawBody, headers, process.env.POLAR_WEBHOOK_SECRET!);
// Process event based on event.type
```

## SDK Convention

The API uses `snake_case` but the TypeScript SDK converts to `camelCase`. Keep this in mind when switching between docs and code.

```typescript
// API docs show: external_customer_id
// SDK uses: externalCustomerId
```

## Sandbox

Separate environment at [sandbox.polar.sh](https://sandbox.polar.sh). Completely isolated from production. Use Stripe test card `4242 4242 4242 4242`.

**Limitation**: Sandbox subscriptions auto-cancel after 90 days.

Configure SDK: `server: 'sandbox'`. API base: `https://sandbox-api.polar.sh/v1`.

## Security

- Part of GitHub Secret Scanning Program -- tokens pushed to repos are auto-revoked.
- Never expose tokens in client-side code.
- Store in environment variables or secrets vault.

## API Basics

- **Base URLs**: Production `https://api.polar.sh/v1`, Sandbox `https://sandbox-api.polar.sh/v1`
- **Rate limits**: 300 req/min per org. 3 req/sec for unauthenticated license key endpoints.
- **Pagination**: `page` (starts at 1) + `limit` (default 10, max 100). Response has `pagination.total_count`.

## Sub-Files

- [checkout.md](checkout.md) -- Links, embedded, API checkout
- [products.md](products.md) -- Products, pricing, benefits
- [subscriptions.md](subscriptions.md) -- Orders, subscriptions, seats, trials
- [webhooks.md](webhooks.md) -- Setup, events, delivery, local dev
- [license-keys.md](license-keys.md) -- Validation, activation, customer portal
- [sdk.md](sdk.md) -- TypeScript + Python SDK patterns
- [frameworks.md](frameworks.md) -- Next.js, SvelteKit, Supabase integration
