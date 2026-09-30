# Polar License Keys

License keys are a benefit type. Attach to products to auto-issue keys on purchase.

## Features

- **Brandable prefixes**: `MYAPP_*****`, `POLAR_*****`
- **Activation limits**: Restrict devices per key
- **Expiration**: Auto-expire after set duration
- **Usage quotas**: Track and limit usage per key
- **Customer self-service**: Customers deactivate their own activations via portal

## Setup

1. Create a License Key benefit in Dashboard > Benefits
2. Attach it to a product
3. On purchase, key is auto-generated and delivered to customer

## Validation

```typescript
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });

const result = await polar.licenseKeys.validate({
  key: 'MYAPP_xxxxx',
  organizationId: 'org-id',
});

if (result.valid) {
  console.log(result.licenseKey.activations);     // current count
  console.log(result.licenseKey.limitActivations); // max allowed
  console.log(result.licenseKey.expiresAt);        // null if no expiry
}
```

## Activation / Deactivation

```typescript
// Activate on a device
const activation = await polar.licenseKeys.activate({
  key: 'MYAPP_xxxxx',
  organizationId: 'org-id',
  label: "User's MacBook Pro", // optional device label
});
// Store activation.id for later deactivation

// Deactivate
await polar.licenseKeys.deactivate({
  key: 'MYAPP_xxxxx',
  organizationId: 'org-id',
  activationId: activation.id,
});
```

## Typical App Integration

```typescript
// Server-side license check middleware
async function validateLicense(licenseKey: string): Promise<boolean> {
  try {
    const result = await polar.licenseKeys.validate({
      key: licenseKey,
      organizationId: process.env.POLAR_ORG_ID!,
    });
    return result.valid;
  } catch {
    return false;
  }
}

// Desktop app activation flow
async function activateApp(licenseKey: string, deviceName: string) {
  try {
    const activation = await polar.licenseKeys.activate({
      key: licenseKey,
      organizationId: process.env.POLAR_ORG_ID!,
      label: deviceName,
    });
    // Store activation.id locally for deactivation on uninstall
    await saveActivationId(activation.id);
    return { success: true };
  } catch (error: any) {
    if (error.statusCode === 422) {
      return { success: false, reason: 'Activation limit reached' };
    }
    throw error;
  }
}
```

## Customer Portal API

Customers can manage their own keys through the Customer Portal:

```
GET  /v1/customer-portal/license-keys/         -- List their keys
GET  /v1/customer-portal/license-keys/{id}      -- Get key details
POST /v1/customer-portal/license-keys/activate   -- Activate
POST /v1/customer-portal/license-keys/deactivate -- Deactivate
POST /v1/customer-portal/license-keys/validate   -- Validate
```

## Admin API

```
POST  /v1/license-keys/validate                     -- Validate a key
POST  /v1/license-keys/activate                      -- Activate a key
POST  /v1/license-keys/deactivate                    -- Deactivate a key
GET   /v1/license-keys/                              -- List all keys
GET   /v1/license-keys/{id}                          -- Get key details
GET   /v1/license-keys/{id}/activations/{activation} -- Get activation
PATCH /v1/license-keys/{id}                          -- Update key
```

## Rate Limits

**3 requests per second** for unauthenticated validate/activate/deactivate endpoints. Cache validation results client-side to avoid hitting limits.

## Webhook Events

- `benefit_grant.created` -- License key benefit granted (key issued)
- `benefit_grant.revoked` -- License key benefit revoked (key invalidated)
- `benefit_grant.cycled` -- Refreshed on subscription renewal

## Gotchas

- **Validate before activate**: Always validate a key first, then activate. Activation fails if the key is invalid or limit reached.
- **Cache validation**: With 3 req/sec rate limit, validate on app launch and cache the result. Don't validate on every API call.
- **Revocation on refund**: When an order is refunded, the license key benefit is revoked. Keys immediately become invalid.
- **Subscription cancellation**: Keys are revoked when the subscription ends (not when the customer clicks cancel, which is end-of-period).
- **Activation limit errors**: Return 422 when limit reached. Parse the error to show a helpful message.
