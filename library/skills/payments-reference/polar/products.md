# Polar Products

**Everything is a product.** Subscriptions and one-time purchases are both products -- just with different pricing and billing logic.

## Creating Products

### Pricing Model

1. **Billing cycle** (cannot be changed after creation):
   - One-time purchase
   - Monthly recurring
   - Yearly recurring

2. **Pricing type** (cannot be changed after creation):
   - Fixed price
   - Pay what you want (set minimum + default amounts)
   - Free

3. **Price**: In cents. For PWYW, set minimum and preset amount.

### Variants Model

Polar doesn't use traditional "variants." Each product has a single pricing model. To offer monthly + yearly pricing, create two separate products and showcase both at checkout. Customers switch between them on the checkout page.

```typescript
// Offer monthly + yearly at checkout
const checkout = await polar.checkouts.create({
  products: ['MONTHLY_PRODUCT_ID', 'YEARLY_PRODUCT_ID'],
});
```

### Trial Periods

For recurring products only. Toggle "Enable trial period" and set duration (days/weeks/months/years).

Trial periods can also be set on Checkout Links or Checkout Sessions, which **override** the product-level trial.

### Product Media

Upload public product images (up to 10MB each). Displayed on product pages.

### Checkout Fields

Collect extra data at checkout: text, number, date, checkbox, select. Managed at org level, enabled per product.

**Gotcha**: A required checkbox forces customers to check it before purchasing. Use for terms of service acceptance.

## Benefits (Automated Entitlements)

Benefits are standalone resources attached to products. Automatically granted on purchase, revoked on cancel/refund.

| Benefit Type | Description |
|-------------|-------------|
| **License Keys** | Software licensing with activation limits, expiration, brandable prefixes |
| **File Downloads** | Digital file delivery (up to 10GB per file) |
| **GitHub Repository Access** | Auto-invite collaborators to private repos |
| **Discord Invites** | Auto-invite to server with role assignment |
| **Credits** | Grant meter balance for usage-based billing |
| **Custom** | Freeform notes displayed to customers |

### Benefit Lifecycle

1. **Granted** -- Customer purchases product
2. **Cycled** -- Refreshed each billing cycle (recurring subs)
3. **Revoked** -- Subscription canceled or product refunded

Grace period configurable for failed payments before revocation.

### Attaching Benefits

Benefits exist independently and can be shared across products:

```typescript
await polar.products.updateBenefits('PRODUCT_ID', {
  benefits: ['BENEFIT_ID_1', 'BENEFIT_ID_2'],
});
```

If you add benefits to an existing product, existing subscribers get them automatically. If you remove benefits, existing subscribers lose access.

## Updating Products

You can change most details except **billing cycle** and **pricing type**.

For fixed-price products, price changes only affect new subscribers. Existing subscribers stay on their original price.

## Archiving Products

Products can't be deleted, only archived. Existing customers keep access. Subscriptions continue to renew. Product is no longer available for new purchases.

Unarchive via the Products Update API.

## Discounts

Create from Dashboard > Products > Discounts.

- **Percentage or fixed amount** off
- **Code** (optional, case-insensitive) -- without a code, discount only applies via Checkout Link or API
- **Recurring**: once, several months, or forever
- **Restrictions**: specific products, date range, max redemptions

Apply via Checkout Link or programmatically at checkout creation.

## Custom Fields

Add custom inputs to checkout: text, number, date, checkbox, select. Create at org level (Settings > Custom Fields), enable per product.

Data available in `custom_field_data` on Orders and Subscriptions:

```json
{ "custom_field_data": { "terms": true, "source": "social_media" } }
```

Prefill via checkout link: `?custom_field_data.terms=true`
