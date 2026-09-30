# Polar Checkout

Three approaches. Pick based on your needs.

| Approach | When to Use |
|----------|-------------|
| **Checkout Links** | No-code, shareable URLs, marketing pages |
| **Checkout API** | Programmatic control, dynamic pricing, custom flows |
| **Embedded Checkout** | Inline on your site, no redirect |

## Checkout Links

Shareable URLs that auto-create checkout sessions. Manage from Dashboard > Products > Checkout Links.

### Features
- Select one or multiple products (customer switches between them)
- Preset or disable discount codes
- Attach metadata (copied to resulting Order/Subscription)

### Query Parameters

Prepopulate fields via URL params:
- `customer_email` -- Prefill email
- `customer_name` -- Prefill name
- `discount_code` -- Apply discount
- `amount` -- For pay-what-you-want pricing
- `custom_field_data.{slug}` -- Prefill custom checkout fields

Attribution metadata (auto-set on checkout `metadata`):
- `reference_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`

**Gotcha**: Always share the Checkout Link URL, never the session URL. Session URLs expire. The Link creates fresh sessions on each visit.

## Checkout API

Full programmatic control.

```typescript
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'sandbox',
});

// Basic checkout
const checkout = await polar.checkouts.create({
  products: ['PRODUCT_ID'],
});
console.log(checkout.url); // redirect user here

// With external customer ID (for reconciliation with your user system)
const checkout2 = await polar.checkouts.create({
  products: ['PRODUCT_ID'],
  externalCustomerId: 'your_user_123',
});
```

### Multiple Products

```typescript
const checkout = await polar.checkouts.create({
  products: ['PRODUCT_A', 'PRODUCT_B'], // customer chooses at checkout
});
```

### Ad-Hoc Prices

Dynamic pricing without modifying your catalog. Temporary, session-specific.

```typescript
const checkout = await polar.checkouts.create({
  products: ['PRODUCT_ID'],
  prices: {
    'PRODUCT_ID': [{
      amountType: 'fixed',
      priceAmount: 10000, // $100.00
      priceCurrency: 'usd',
    }],
  },
});
```

Ad-hoc prices support: `fixed`, `custom` (pay-what-you-want), `free`, `seat-based`, `metered`.

Marked as `source: "ad_hoc"` in API responses vs `source: "catalog"` for regular prices.

### Python

```python
from polar_sdk import Polar

with Polar(access_token="<TOKEN>") as polar:
    checkout = polar.checkouts.create(request={
        "products": ["<product_id>"],
    })
    print(checkout.url)
```

## Embedded Checkout

Inline checkout on your site -- no redirect. Two integration methods.

### HTML Snippet (Any Site)

```html
<a
  href="__CHECKOUT_LINK__"
  data-polar-checkout
  data-polar-checkout-theme="light"
>
  Purchase
</a>

<script
  defer
  data-auto-init
  src="https://cdn.jsdelivr.net/npm/@polar-sh/checkout@latest/dist/embed.global.js"
></script>
```

### JavaScript Library (React, etc.)

```bash
npm install @polar-sh/checkout
```

```typescript
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed';
import { useEffect, useState } from 'react';

function CheckoutButton() {
  const [instance, setInstance] = useState<any>(null);

  useEffect(() => {
    return () => { instance?.close(); };
  }, [instance]);

  const handleCheckout = async () => {
    try {
      const checkout = await PolarEmbedCheckout.create('__CHECKOUT_LINK__', {
        theme: 'light',
        onLoaded: () => console.log('Checkout loaded'),
      });

      setInstance(checkout);

      checkout.addEventListener('success', (event) => {
        if (!event.detail.redirect) {
          // Show your own success UI
        }
      });

      checkout.addEventListener('close', () => setInstance(null));
    } catch (error) {
      console.error('Failed to open checkout', error);
    }
  };

  return <button onClick={handleCheckout}>Purchase</button>;
}
```

### Checkout Events

- `loaded` -- Use `onLoaded` callback in `create()` (guaranteed even if fast load)
- `close` -- Checkout dismissed
- `confirmed` -- Payment processing started. `preventDefault()` stops auto non-closable behavior
- `success` -- Purchase complete. `event.detail.redirect` tells you if redirect will happen

### Programmatic API URL Checkout

Use API-generated session URLs instead of Checkout Links. Set `embed_origin` to your domain:

```typescript
const checkout = await polar.checkouts.create({
  products: ['PRODUCT_ID'],
  embedOrigin: 'https://example.com', // required for embedded
});
// Use checkout.url as the href for PolarEmbedCheckout
```

### Wallet Payments (Apple Pay, Google Pay)

Automatically available on hosted/linked checkout. For **embedded** checkout, wallet payments require manual domain validation -- email support@polar.sh with your org slug and domain.

## Checkout States

| State | Meaning |
|-------|---------|
| `open` | Waiting for customer to complete payment |
| `confirmed` | Customer clicked Pay, payment processing |
| `succeeded` | Payment successful, order created |
| `expired` | Session expired, must create new one |

Check failed payment attempts in the Checkout detail view for decline reasons.
