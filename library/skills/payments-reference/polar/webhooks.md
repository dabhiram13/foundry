# Polar Webhooks

Follows the [Standard Webhooks](https://www.standardwebhooks.com/) specification. SDKs provide built-in signature validation and typed payloads.

## Setup

1. Dashboard > Organization Settings > Webhooks > Add Endpoint
2. Enter endpoint URL
3. Choose delivery format: **Raw** (JSON) for code, or Discord/Slack for chat notifications
4. Set signing secret (generate random or provide your own)
5. Subscribe to events

## Validation (SDK)

### TypeScript (Express)

```typescript
import express from 'express';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = validateEvent(
      req.body,
      req.headers,
      process.env.POLAR_WEBHOOK_SECRET!,
    );
    // Process event based on event.type
    res.status(202).send('');
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return res.status(403).send('');
    }
    throw error;
  }
});
```

### Python (Flask)

```python
import os
from flask import Flask, request
from polar_sdk.webhooks import validate_event, WebhookVerificationError

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        event = validate_event(
            body=request.data,
            headers=request.headers,
            secret=os.getenv('POLAR_WEBHOOK_SECRET', ''),
        )
        # Process event
        return "", 202
    except WebhookVerificationError:
        return "", 403
```

### Custom Validation

Standard Webhooks spec has [libraries for many languages](https://github.com/standard-webhooks/standard-webhooks/tree/main/libraries).

**Gotcha**: The spec expects the secret to be **base64 encoded**. The Polar SDK handles this automatically. If rolling your own validation, base64-encode the secret first.

## Event Types

### Order Events
| Event | Description |
|-------|-------------|
| `order.created` | New order created |
| `order.paid` | Payment confirmed |
| `order.updated` | Order details changed |
| `order.refunded` | Order refunded |

### Subscription Events
| Event | Description |
|-------|-------------|
| `subscription.created` | New subscription |
| `subscription.active` | Subscription became active |
| `subscription.updated` | Details changed |
| `subscription.canceled` | Canceled (at period end) |
| `subscription.uncanceled` | Cancellation reversed |
| `subscription.revoked` | Immediately revoked |

### Customer Events
| Event | Description |
|-------|-------------|
| `customer.created` | New customer |
| `customer.updated` | Details changed |
| `customer.deleted` | Customer deleted |
| `customer.state_changed` | Subscriptions, benefits, or meters changed |

### Benefit Events
| Event | Description |
|-------|-------------|
| `benefit_grant.created` | Benefit granted to customer |
| `benefit_grant.cycled` | Refreshed on billing cycle |
| `benefit_grant.updated` | Grant details updated |
| `benefit_grant.revoked` | Benefit revoked |

### Checkout Events
| Event | Description |
|-------|-------------|
| `checkout.created` | Session created |
| `checkout.updated` | Session updated |

### Seat Events
| Event | Description |
|-------|-------------|
| `customer_seat.assigned` | Seat assigned |
| `customer_seat.claimed` | Seat claimed by invitee |
| `customer_seat.revoked` | Seat revoked |

### Refund Events
| Event | Description |
|-------|-------------|
| `refund.created` | Refund initiated |
| `refund.updated` | Status changed |

## Local Development

### Polar CLI

```bash
# Install
curl -fsSL https://polar.sh/install.sh | bash

# Login
polar login

# Forward webhooks to local server
polar listen http://localhost:3000/api/webhook/polar
# Prints a secret -- copy it to POLAR_WEBHOOK_SECRET in .env
```

### ngrok Alternative

```bash
ngrok http 3000
# Use the ngrok URL as your webhook endpoint in Polar dashboard
```

## Delivery Behavior

### Retries
- Up to **10 retries** with exponential backoff on non-2xx responses

### Timeouts
- **10 seconds** timeout per delivery attempt
- Aim to respond within **2 seconds** -- queue heavy processing as background jobs
- Timeout threshold may be lowered in the future

### Endpoint Disabling
- **10 consecutive failures** = endpoint auto-disabled
- Org admin receives email notification
- Re-enable manually in dashboard after fixing the issue

### Redirects
- **3xx responses are failures** -- Polar doesn't follow redirects
- Common cause: Vercel `www`/non-`www` redirects. Use the final domain in your webhook URL.

## IP Allowlist

If using a firewall, allow these IPs:

```
3.134.238.10
3.129.111.220
52.15.118.168
74.220.50.0/24
74.220.58.0/24
```

## Troubleshooting

- **404**: Try adding trailing `/` to endpoint URL. Many frameworks redirect `/foo` to `/foo/`.
- **403**: Check auth middleware isn't blocking the webhook route. Check Cloudflare Bot Fight Mode -- it blocks webhook requests. Disable it or create custom WAF rules.
- **Invalid signature**: If using custom validation, ensure secret is base64-encoded per Standard Webhooks spec.
- **Not receiving**: Check delivery logs in Polar dashboard. Verify ngrok/tunnel is running for local dev.
