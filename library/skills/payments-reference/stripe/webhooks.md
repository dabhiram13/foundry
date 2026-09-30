# Stripe Webhooks

## Signature Verification (Required)

Always verify webhook signatures. Unverified webhooks can be spoofed.

```typescript
import Stripe from 'stripe';
import express from 'express';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const app = express();

// CRITICAL: Use express.raw() for webhook route -- JSON parsing breaks signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature']!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Route by event type
  switch (event.type) {
    case 'payment_intent.succeeded':
      handleSuccessfulPayment(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      handleFailedPayment(event.data.object as Stripe.PaymentIntent);
      break;
    case 'customer.subscription.created':
      handleSubscriptionCreated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.updated':
      handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_succeeded':
      handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case 'invoice.payment_failed':
      handleInvoiceFailed(event.data.object as Stripe.Invoice);
      break;
    case 'charge.refunded':
      handleRefund(event.data.object as Stripe.Charge);
      break;
  }

  res.status(200).json({ received: true });
});
```

## Next.js App Router

```typescript
// app/api/webhook/stripe/route.ts
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text(); // raw body, not json
  const sig = (await headers()).get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Handle event...
  return NextResponse.json({ received: true });
}
```

## Idempotent Handling

Stripe may send the same event multiple times. Always deduplicate.

```typescript
async function handleWebhookIdempotently(
  eventId: string,
  handler: () => Promise<void>
) {
  // Check if already processed (use your DB)
  const processed = await db.webhookEvents.findUnique({
    where: { stripeEventId: eventId },
  });
  if (processed) return;

  try {
    await handler();
    await db.webhookEvents.create({
      data: { stripeEventId: eventId, processedAt: new Date() },
    });
  } catch (error) {
    // Don't mark as processed -- Stripe will retry
    throw error;
  }
}
```

## Critical Event Types

### Payment Events
| Event | When to Listen |
|-------|---------------|
| `payment_intent.succeeded` | One-time payment completed |
| `payment_intent.payment_failed` | Payment failed |
| `charge.refunded` | Refund processed |
| `charge.dispute.created` | Customer disputed charge |

### Subscription Events
| Event | When to Listen |
|-------|---------------|
| `customer.subscription.created` | New subscription |
| `customer.subscription.updated` | Status or plan changed |
| `customer.subscription.deleted` | Subscription ended |
| `customer.subscription.trial_will_end` | 3 days before trial expires |
| `invoice.payment_succeeded` | Subscription renewal paid |
| `invoice.payment_failed` | Renewal failed (dunning) |

### Checkout Events
| Event | When to Listen |
|-------|---------------|
| `checkout.session.completed` | Checkout finished successfully |
| `checkout.session.expired` | Checkout session expired |

## Webhook IP Allowlisting

For defense in depth, allowlist Stripe's IP addresses on your webhook endpoint. See [Stripe IPs](https://docs.stripe.com/ips.md).

## Local Development

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhook/stripe

# The CLI prints a webhook signing secret (whsec_...) -- use it as STRIPE_WEBHOOK_SECRET
```

## Gotchas

- **Raw body required**: The most common webhook bug. If your framework auto-parses JSON, signature verification fails. Express needs `express.raw()`, Next.js needs `request.text()`.
- **Return 200 quickly**: Return `200` before doing heavy processing. Use a queue for async work. Stripe times out at 20 seconds and retries.
- **Retry behavior**: Stripe retries failed webhooks up to 3 days with exponential backoff. Up to ~15 retries.
- **Event ordering**: Events may arrive out of order. Don't assume `subscription.created` arrives before `invoice.payment_succeeded`. Use `event.data.object` state, not sequence.
- **Test mode vs live mode**: Webhook endpoints are mode-specific. A test-mode endpoint won't receive live events.
- **Multiple endpoints**: You can register multiple webhook endpoints for different event types. Useful for microservices.
- **`checkout.session.completed` vs `payment_intent.succeeded`**: For Checkout-based flows, listen to `checkout.session.completed`. It fires after payment AND session metadata are available.
