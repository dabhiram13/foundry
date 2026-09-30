# Lemon Squeezy Webhooks

## Creating Webhooks

### Via CLI

```bash
# Create webhook
lmsq webhooks create \
  --store-id 1 \
  --url "https://myapp.com/api/webhook/lemonsqueezy" \
  --secret "whsec_your_signing_secret" \
  --events order_created,subscription_created,subscription_updated,license_key_created

# Test mode webhook
lmsq webhooks create \
  --store-id 1 \
  --url "https://myapp.com/api/webhook/lemonsqueezy" \
  --secret "whsec_test_secret" \
  --events order_created,subscription_created \
  --test-mode
```

### Managing Webhooks

```bash
# List webhooks
lmsq webhooks list --store-id 1

# Get webhook details
lmsq webhooks get 123

# Update events
lmsq webhooks update 123 --events order_created,order_refunded,subscription_cancelled

# Update URL
lmsq webhooks update 123 --url "https://newurl.com/webhook"

# Delete
lmsq webhooks delete 123
```

## Event Types

### Order Events
| Event | When |
|-------|------|
| `order_created` | New purchase completed |
| `order_refunded` | Order refunded |

### Subscription Events
| Event | When |
|-------|------|
| `subscription_created` | New subscription started |
| `subscription_updated` | Plan change, status change, pause, resume |
| `subscription_cancelled` | Subscription canceled |
| `subscription_payment_success` | Renewal payment succeeded |
| `subscription_payment_failed` | Renewal payment failed |

### License Key Events
| Event | When |
|-------|------|
| `license_key_created` | License key generated on purchase |
| `license_key_updated` | License key modified |

## Webhook Payload

Lemon Squeezy webhooks use a custom format (not JSON:API):

```typescript
interface WebhookPayload {
  meta: {
    event_name: string;          // e.g., "order_created"
    custom_data?: Record<string, any>; // custom data from checkout
    test_mode: boolean;
  };
  data: {
    type: string;                // resource type
    id: string;                  // resource ID
    attributes: Record<string, any>; // resource data
    relationships: Record<string, any>;
  };
}
```

## Signature Verification

Lemon Squeezy signs webhooks with HMAC-SHA256 using your webhook secret. The signature is in the `X-Signature` header.

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

### Express Handler

```typescript
import express from 'express';
import crypto from 'crypto';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-signature'] as string;
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(req.body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return res.status(403).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());
  const eventName = event.meta.event_name;

  switch (eventName) {
    case 'order_created':
      handleOrder(event.data, event.meta.custom_data);
      break;
    case 'subscription_created':
      handleNewSubscription(event.data);
      break;
    case 'subscription_updated':
      handleSubscriptionChange(event.data);
      break;
    case 'subscription_payment_failed':
      handlePaymentFailure(event.data);
      break;
    case 'license_key_created':
      handleLicenseKey(event.data);
      break;
  }

  res.status(200).send('OK');
});
```

### Next.js App Router Handler

```typescript
// app/api/webhook/lemonsqueezy/route.ts
import crypto from 'crypto';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-signature')!;
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const event = JSON.parse(body);
  // Handle event.meta.event_name...

  return NextResponse.json({ received: true });
}
```

## Retry Behavior

- Lemon Squeezy retries failed webhook deliveries (non-2xx responses)
- Exponential backoff between retries
- Webhook endpoints that consistently fail may be disabled

## Gotchas

- **Raw body for signature**: Like Stripe, you need the raw request body for signature verification. If your framework auto-parses JSON, the signature check fails.
- **`X-Signature` header**: Note the capital X and S. Different from Stripe's `Stripe-Signature`.
- **HMAC-SHA256**: Simpler than Stripe's signature scheme. Just HMAC the raw body with your secret and compare.
- **`custom_data` in meta**: The custom data you passed at checkout creation is in `event.meta.custom_data`, NOT in `event.data`. Easy to miss.
- **Test mode**: Test mode webhooks only fire from test mode purchases. Set up separate webhook endpoints or check `event.meta.test_mode`.
- **`subscription_updated` covers everything**: Plan changes, pauses, resumes, billing anchor changes -- all fire `subscription_updated`. Check the `attributes` to determine what changed.
- **Idempotency**: Implement idempotent handling. Store processed event IDs and skip duplicates.
