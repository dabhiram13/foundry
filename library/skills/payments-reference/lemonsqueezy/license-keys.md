# Lemon Squeezy License Keys

License keys are generated automatically when a product with licensing enabled is purchased. Manage via API and CLI.

## License API (Public, No Auth Required)

These three operations work without authentication -- designed for client apps.

### Activate

```bash
lmsq licenses activate --key XXXXX-XXXXX-XXXXX --instance-name "server-1"
```

```typescript
const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    license_key: 'XXXXX-XXXXX-XXXXX',
    instance_name: 'MacBook Pro',
  }),
});

const { activated, instance, license_key, meta, error } = await response.json();
if (activated) {
  // Store instance.id for deactivation later
  console.log(`Activated. Instance: ${instance.id}`);
  console.log(`Activations: ${meta.activation_usage}/${meta.activation_limit}`);
}
```

### Validate

```bash
lmsq licenses validate --key XXXXX-XXXXX-XXXXX
# Optionally validate specific instance:
lmsq licenses validate --key XXXXX-XXXXX-XXXXX --instance-id abc123
```

```typescript
const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    license_key: 'XXXXX-XXXXX-XXXXX',
    instance_id: 'abc123', // optional
  }),
});

const { valid, license_key, meta, error } = await response.json();
if (valid) {
  console.log(`Status: ${license_key.status}`);
  console.log(`Activations: ${meta.activation_usage}/${meta.activation_limit}`);
  console.log(`Product: ${meta.product_name}`);
  console.log(`Variant: ${meta.variant_name}`);
}
```

### Deactivate

```bash
lmsq licenses deactivate --key XXXXX-XXXXX-XXXXX --instance-id abc123
```

```typescript
const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    license_key: 'XXXXX-XXXXX-XXXXX',
    instance_id: 'abc123',
  }),
});

const { deactivated } = await response.json();
```

## Admin API (Auth Required)

### Managing License Keys

```bash
# List all license keys
lmsq license-keys list --store-id 1

# Filter by product/status
lmsq license-keys list --product-id 1 --status active

# Get key details
lmsq license-keys get 456

# Update activation limit
lmsq license-keys update 456 --activation-limit 5

# Set unlimited activations
lmsq license-keys update 456 --activation-limit unlimited

# Set expiration
lmsq license-keys update 456 --expires-at "2026-01-01T00:00:00Z"

# Remove expiration
lmsq license-keys update 456 --expires-at never

# Disable a key
lmsq license-keys update 456 --disabled true

# Re-enable
lmsq license-keys update 456 --enabled true
```

### License Key Instances

```bash
# List instances (activations) for a key
lmsq license-key-instances list --license-key-id 456

# Get instance details
lmsq license-key-instances get 789
```

## Typical Desktop App Integration

```typescript
// license-manager.ts
const API_URL = 'https://api.lemonsqueezy.com/v1/licenses';

interface LicenseResult {
  valid: boolean;
  status: string;
  activationsUsed: number;
  activationsLimit: number;
  error?: string;
}

export async function activateLicense(
  licenseKey: string,
  instanceName: string
): Promise<{ instanceId: string } | { error: string }> {
  const res = await fetch(`${API_URL}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: licenseKey, instance_name: instanceName }),
  });
  const data = await res.json();

  if (data.activated) {
    return { instanceId: data.instance.id };
  }
  return { error: data.error || 'Activation failed' };
}

export async function validateLicense(
  licenseKey: string,
  instanceId?: string
): Promise<LicenseResult> {
  const res = await fetch(`${API_URL}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      ...(instanceId && { instance_id: instanceId }),
    }),
  });
  const data = await res.json();

  return {
    valid: data.valid,
    status: data.license_key?.status || 'unknown',
    activationsUsed: data.meta?.activation_usage || 0,
    activationsLimit: data.meta?.activation_limit || 0,
    error: data.error,
  };
}

export async function deactivateLicense(
  licenseKey: string,
  instanceId: string
): Promise<boolean> {
  const res = await fetch(`${API_URL}/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: licenseKey, instance_id: instanceId }),
  });
  const data = await res.json();
  return data.deactivated;
}
```

## Webhook Events

- `license_key_created` -- Key generated on purchase
- `license_key_updated` -- Key modified (via admin API)

## Gotchas

- **Public API**: activate/validate/deactivate require NO authentication. They're designed to be called from client apps. The license key itself is the credential.
- **Instance ID vs Instance Name**: `activate` takes an `instance_name` (human-readable label). It returns an `instance_id` (system identifier). Use `instance_id` for validate and deactivate.
- **Activation limit**: Default depends on product setup. `unlimited` means no cap. Check `meta.activation_limit` in validate response.
- **Status values**: `active`, `inactive`, `expired`, `disabled`. Only `active` keys validate as `valid: true`.
- **Offline validation**: There's no built-in offline validation. You must call the API. For offline-friendly apps, cache the validation result and re-check periodically.
- **Key format**: Keys are UUID-like with dashes: `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`. The format is not customizable (unlike Polar's brandable prefixes).
- **Subscription keys**: If a license key is tied to a subscription and the subscription is canceled/expired, the key becomes invalid on next validation.
