# Lemon Squeezy Checkout

## Creating Checkouts

### Via CLI

```bash
# Basic checkout
lmsq checkouts create --store-id 1 --variant-id 1

# With customizations
lmsq checkouts create --store-id 1 --variant-id 1 \
  --email customer@example.com \
  --name "Jane Doe" \
  --redirect-url "https://myapp.com/success" \
  --discount-code LAUNCH20 \
  --custom '{"user_id": "123", "plan": "pro"}' \
  --test-mode

# Checkout as overlay (embedded)
lmsq checkouts create --store-id 1 --variant-id 1 --embed

# Custom branding
lmsq checkouts create --store-id 1 --variant-id 1 \
  --button-color "#4F46E5" \
  --background-color "#F9FAFB" \
  --product-name "Pro Plan" \
  --product-description "Unlimited access"
```

### Via API

```typescript
// Using fetch against Lemon Squeezy API
const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  },
  body: JSON.stringify({
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: 'customer@example.com',
          name: 'Jane Doe',
          custom: { user_id: '123' },
          discount_code: 'LAUNCH20',
        },
        product_options: {
          name: 'Pro Plan',
          description: 'Unlimited access to all features',
          redirect_url: 'https://myapp.com/success',
        },
        checkout_options: {
          embed: true,
          button_color: '#4F46E5',
        },
      },
      relationships: {
        store: { data: { type: 'stores', id: '1' } },
        variant: { data: { type: 'variants', id: '1' } },
      },
    },
  }),
});

const { data } = await response.json();
// Redirect to data.attributes.url
```

## Checkout Options

| Option | Description |
|--------|-------------|
| `--custom-price <cents>` | Override variant price |
| `--email <email>` | Prefill customer email |
| `--name <name>` | Prefill customer name |
| `--discount-code <code>` | Prefill discount |
| `--redirect-url <url>` | Post-purchase redirect |
| `--custom <json>` | Custom metadata (JSON string) |
| `--test-mode` | Test mode checkout |
| `--expires-at <datetime>` | Checkout expiration |
| `--embed` | Show as overlay instead of hosted page |
| `--no-logo` | Hide store logo |
| `--no-discount` | Hide discount code field |
| `--button-color <hex>` | Custom button color |
| `--background-color <hex>` | Custom background |
| `--product-name <name>` | Override product name |
| `--product-description <desc>` | Override description |
| `--billing-country <CC>` | Prefill billing country |
| `--billing-zip <zip>` | Prefill billing ZIP |
| `--skip-trial` | Remove free trial |
| `--subscription-preview` | Show subscription preview text |
| `--preview` | Return pricing preview (no checkout created) |

## Custom Data

The `--custom` flag (or `custom` in checkout_data) passes arbitrary JSON that gets attached to the resulting order. Use it to link purchases to your user system:

```bash
lmsq checkouts create --store-id 1 --variant-id 1 \
  --custom '{"user_id": "usr_123", "team": "engineering"}'
```

This data appears in:
- The order object (`custom_data` attribute)
- Webhook payloads for `order_created` events
- Available via `lmsq orders get <id> --pluck custom_data`

## Embedded Checkout (Overlay)

Lemon Squeezy supports an overlay checkout that displays on top of your page without redirecting.

```html
<!-- Add Lemon Squeezy JS -->
<script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>

<!-- Trigger checkout overlay -->
<a href="https://mystore.lemonsqueezy.com/checkout/buy/variant-uuid"
   class="lemonsqueezy-button">
  Buy Now
</a>
```

When using `--embed` via CLI or API, the returned URL opens as an overlay when loaded via the Lemon Squeezy JS library.

## Listing and Inspecting Checkouts

```bash
# List checkouts
lmsq checkouts list --store-id 1

# Get specific checkout
lmsq checkouts get 123

# Get checkout URL only
lmsq checkouts get 123 --pluck url
```

## Gotchas

- **JSON:API format**: The API uses JSON:API format with `data.type`, `data.attributes`, and `data.relationships`. This is more verbose than typical REST APIs.
- **Variant, not Product**: Checkouts are created with a `variant-id`, not a product ID. Each product has at least one variant.
- **Custom data is JSON string**: The `--custom` flag expects a JSON string, not key-value pairs.
- **Overlay vs hosted**: `--embed` creates an overlay checkout. Without it, you get a hosted checkout page at `*.lemonsqueezy.com`.
- **Test mode**: Use `--test-mode` for development. Test mode checkouts use Stripe test cards (4242...).
- **Price override**: `--custom-price` is in cents. `1000` = $10.00.
