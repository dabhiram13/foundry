# Lemon Squeezy

Payment platform operating as a **Merchant of Record (MoR)**. They handle ALL sales tax, VAT, and GST globally -- you never file tax returns for software sales.

## Why Lemon Squeezy

- **MoR model**: Lemon Squeezy is the legal seller of your product. They collect and remit all taxes worldwide. You receive payouts minus fees and taxes. Zero tax compliance burden.
- **Built-in license keys**: Generate, validate, and manage software licenses through the API and CLI.
- **Simple pricing**: Products and variants with subscriptions, one-time purchases, and usage-based billing.
- **`lmsq` CLI**: Agent-friendly CLI with 62 operations across 22 resources, auto-optimized for AI agents.

## MoR Model Explained

In a typical Stripe setup, **you** are the merchant -- you're responsible for collecting and remitting VAT/GST/sales tax in every jurisdiction where you have customers. This means:
- Registering for tax IDs in multiple countries
- Filing tax returns in each jurisdiction
- Tracking changing tax rates
- Handling tax exemptions

With Lemon Squeezy's MoR model:
- Lemon Squeezy is the legal seller
- They handle ALL tax collection and remittance globally
- You receive net payouts (price minus fees minus taxes)
- You file zero tax returns for these sales
- Customer invoices show Lemon Squeezy as the merchant

**Trade-off**: Less control over the checkout experience and customer relationship. Higher per-transaction fees than Stripe. Worth it if tax compliance is your primary pain.

## Quick Start

### CLI

```bash
npm install -g lmsq
# Or: npx lmsq <command>

# Authenticate
export LEMONSQUEEZY_API_KEY=lsq_live_xxxxxxxxxxxx
# Or: lmsq auth login --key lsq_live_xxxxxxxxxxxx
```

### API Authentication

Resolution order: `--api-key` flag > `LEMONSQUEEZY_API_KEY` env var > `~/.config/lemonsqueezy-cli/config.json`

**Exception**: `lmsq licenses activate/validate/deactivate` uses the public License API -- no auth required.

### Token-Efficient Output

When called from non-TTY (how agents call it), output is auto-optimized:

| Mode | When | Tokens |
|------|------|--------|
| `--pluck <field>` | Need single value | ~1 |
| `--count` | Need total count | ~3 |
| `--only-ids` | Need ID list | ~5/resource |
| `--fields a,b,c` | Need specific attrs | ~20/resource |
| (default) | Need all attrs | ~150/resource |
| `--json` | Need structured data | ~200/resource |

Never use `--json-raw` unless user explicitly wants raw JSON:API response (~2000 tokens/resource).

## Resources Overview

| Resource | Actions |
|----------|---------|
| `stores` | list, get |
| `customers` | list, get, create, update, archive |
| `products` | list, get |
| `variants` | list, get |
| `orders` | list, get, invoice, refund |
| `subscriptions` | list, get, update, cancel |
| `subscription-items` | list, get, update, usage |
| `checkouts` | list, get, create |
| `webhooks` | list, get, create, update, delete |
| `license-keys` | list, get, update |
| `licenses` | activate, validate, deactivate (public, no auth) |
| `discounts` | list, get, create, delete |

## Sub-Files

- [checkout.md](checkout.md) -- Checkout overlay, hosted checkout, custom data
- [subscriptions.md](subscriptions.md) -- Billing, pause/resume, plan changes
- [webhooks.md](webhooks.md) -- Signatures, event types, retry behavior
- [license-keys.md](license-keys.md) -- Generation, validation, activation
- [cli.md](cli.md) -- Full lmsq CLI reference

## Documentation

- [Help docs](https://docs.lemonsqueezy.com/help) -- Platform behavior
- [API reference](https://docs.lemonsqueezy.com/api) -- Full API docs
- [Guides](https://docs.lemonsqueezy.com/guides) -- Tutorials
