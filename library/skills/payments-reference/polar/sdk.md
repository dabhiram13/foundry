# Polar SDKs

## TypeScript SDK

```bash
npm install @polar-sh/sdk
# Pin version: npm install @polar-sh/sdk@^0.46
```

### Initialization

```typescript
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'sandbox', // or 'production' (default)
});
```

### Pagination

All list endpoints return async iterables:

```typescript
const result = await polar.products.list({});
for await (const page of result) {
  for (const product of page.result.items) {
    console.log(product.name);
  }
}
```

### Products

```typescript
// List products
const products = await polar.products.list({});

// Create product
const product = await polar.products.create({
  name: 'Pro Plan',
  prices: [{ amountType: 'fixed', priceAmount: 2000, priceCurrency: 'usd' }],
});

// Attach benefits
await polar.products.updateBenefits('PRODUCT_ID', {
  benefits: ['BENEFIT_ID'],
});
```

### Checkout

```typescript
// Create checkout session
const checkout = await polar.checkouts.create({
  products: ['PRODUCT_ID'],
  externalCustomerId: 'your_user_123', // optional
});
// Redirect to checkout.url
```

### Customers

```typescript
// Get customer state (subscriptions + benefits + meters)
const state = await polar.customers.getStateExternal('your_user_123');

// Create customer session for portal
const session = await polar.customerSessions.create({
  customerId: 'CUSTOMER_ID',
});
// Redirect to session.customerPortalUrl
```

### Webhooks

```typescript
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';

const event = validateEvent(rawBody, headers, webhookSecret);
// event is fully typed
```

### Convention

API uses `snake_case`, TypeScript SDK converts to `camelCase`:
- API: `external_customer_id` -> SDK: `externalCustomerId`
- API: `price_amount` -> SDK: `priceAmount`

## Python SDK

```bash
pip install polar-sdk
# Pin version: pip install polar-sdk~=0.28
```

### Synchronous

```python
from polar_sdk import Polar

polar = Polar(
    access_token="<TOKEN>",
    server="sandbox",  # or "production"
)

# List products
result = polar.products.list()
while result is not None:
    for product in result.result.items:
        print(product.name)
    result = result.next()

# Create checkout
checkout = polar.checkouts.create(request={
    "products": ["<product_id>"],
})
print(checkout.url)
```

### Async

```python
import asyncio
from polar_sdk import AsyncPolar

async def main():
    async with AsyncPolar(access_token="<TOKEN>") as polar:
        checkout = await polar.checkouts.create(request={
            "products": ["<product_id>"],
        })
        print(checkout.url)

asyncio.run(main())
```

### Webhooks

```python
from polar_sdk.webhooks import validate_event, WebhookVerificationError

try:
    event = validate_event(
        body=request.data,
        headers=request.headers,
        secret=os.getenv('POLAR_WEBHOOK_SECRET', ''),
    )
except WebhookVerificationError:
    return "", 403
```

## Embedded Checkout Library

```bash
npm install @polar-sh/checkout
```

```typescript
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed';

// Auto-init: adds handlers to all data-polar-checkout elements
PolarEmbedCheckout.init();

// Or programmatic:
const checkout = await PolarEmbedCheckout.create('CHECKOUT_URL', {
  theme: 'light',
  onLoaded: () => console.log('Ready'),
});
checkout.addEventListener('success', (e) => console.log('Purchased'));
checkout.close(); // programmatic close
```

## OAuth 2.0 (Partner Integrations)

For building apps that access Polar on behalf of users (not for selling your own products).

```
Authorization: https://polar.sh/oauth2/authorize?response_type=code&client_id=XXX&redirect_uri=XXX&scope=openid+email
Token:         POST https://api.polar.sh/v1/oauth2/token
```

- Default: org-scoped tokens. Add `sub_type=user` for user-scoped.
- Public clients (SPA/mobile): PKCE required, no `client_secret`.
- Refresh tokens provided for long-lived access.

## MCP Server

Connect Polar to AI agents via Model Context Protocol:

```json
{
  "mcpServers": {
    "Polar": { "url": "https://mcp.polar.sh/mcp/polar-mcp" }
  }
}
```

Sandbox: `https://mcp.polar.sh/mcp/polar-sandbox`

Works with: Claude Desktop, Claude Code, Cursor, Windsurf, Codex, ChatGPT.
