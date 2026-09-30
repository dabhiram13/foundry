---
name: payments-reference
description: >
  Unified payment integration reference covering Stripe, Polar, and Lemon Squeezy —
  decision criteria, provider-specific patterns, and the non-obvious gotchas of each.
  Use for "which payment provider", "implement checkout", "subscription billing",
  "payment webhook", "license keys", "customer portal", "polar", "lemon squeezy".
  This is a depth reference; the /payments slash command and the payment-processing
  router skill remain the entry points.
---

# Payments

Three providers, different strengths. Pick based on your actual needs, not defaults.

## Decision Table

| Criteria | Stripe | Polar | Lemon Squeezy |
|----------|--------|-------|---------------|
| **Pricing model** | % + fixed per txn | % per txn | % + fixed per txn |
| **Tax handling** | Stripe Tax (add-on) | Polar handles as MoR | Full MoR -- they handle ALL tax/VAT globally |
| **Complexity** | High (most flexible) | Medium | Low |
| **License keys** | No native support | Built-in (benefit type) | Built-in |
| **Marketplace/Connect** | Yes (Connect, Treasury) | No | No |
| **Digital product benefits** | Manual | Built-in (files, Discord, GitHub, credits) | Manual |
| **Seat-based pricing** | Manual implementation | Built-in (beta) | Via usage records |
| **Usage-based billing** | Metered billing API | Events & Meters | Usage records |
| **Framework SDKs** | Stripe.js + server SDKs | Next.js, SvelteKit, Supabase, 12+ adapters | JS SDK, lmsq CLI |
| **Best for** | Complex billing, marketplaces, financial infra | Creator/dev monetization, OSS, digital products | SaaS/software, solo devs wanting zero tax hassle |

## When to Use Which

### Stripe
- You need marketplace/platform payments (Connect)
- Complex billing: metered + tiered + usage + per-seat combinations
- Financial infrastructure (Treasury, Issuing, Capital)
- You want maximum control over the payment UX
- Enterprise with custom requirements
- **Skip if**: You just sell a SaaS product and want simple tax compliance

### Polar
- Developer tools, open-source monetization, digital products
- You want automatic benefit delivery: license keys, file downloads, Discord roles, GitHub repo access
- Simpler API than Stripe with typed SDKs for modern frameworks
- Seat-based team pricing with built-in invite/claim flow
- **Skip if**: You need marketplace payments or complex financial infrastructure

### Lemon Squeezy
- SaaS or software products where tax compliance is your biggest headache
- Merchant of Record model: they handle ALL sales tax, VAT, GST globally -- you never file
- Solo developer or small team wanting the fastest path to selling software
- License key distribution for desktop/CLI software
- **Skip if**: You need marketplace payments or fine-grained billing control

## Provider Guides

### Stripe (`stripe/`)
- [checkout.md](stripe/checkout.md) -- Checkout Sessions, Payment Element, success/cancel, metadata
- [subscriptions.md](stripe/subscriptions.md) -- Billing portal, trials, proration, plan changes
- [webhooks.md](stripe/webhooks.md) -- Signature verification, idempotent handling, event types
- [connect.md](stripe/connect.md) -- Platform/marketplace patterns, Accounts v2, transfers
- [testing.md](stripe/testing.md) -- CLI, test clocks, test cards
- [security.md](stripe/security.md) -- API key management, restricted keys, PCI scope

### Polar (`polar/`)
- [README.md](polar/README.md) -- Overview, quick start, SDK setup
- [checkout.md](polar/checkout.md) -- Checkout links, embedded checkout, API checkout
- [products.md](polar/products.md) -- Products, prices, benefits model
- [subscriptions.md](polar/subscriptions.md) -- Orders, subscriptions, seat-based pricing, trials
- [webhooks.md](polar/webhooks.md) -- Setup, events, delivery, local testing
- [license-keys.md](polar/license-keys.md) -- License key generation, validation, activation
- [sdk.md](polar/sdk.md) -- TypeScript + Python SDK patterns
- [frameworks.md](polar/frameworks.md) -- Next.js, SvelteKit, Supabase integration patterns

### Lemon Squeezy (`lemonsqueezy/`)
- [README.md](lemonsqueezy/README.md) -- Overview, MoR model explained, quick start
- [checkout.md](lemonsqueezy/checkout.md) -- Checkout overlay, hosted checkout, custom data
- [subscriptions.md](lemonsqueezy/subscriptions.md) -- Subscription billing, pause/resume, plan changes
- [webhooks.md](lemonsqueezy/webhooks.md) -- Webhook signatures, event types, retry behavior
- [license-keys.md](lemonsqueezy/license-keys.md) -- License key generation, validation, activation
- [cli.md](lemonsqueezy/cli.md) -- lmsq CLI commands and agent-optimized usage

## Cross-Provider Patterns

**Webhook reliability**: All three retry on failure. Always make handlers idempotent -- store processed event IDs and check before re-processing.

**Test environments**: Stripe uses `sk_test_` keys + test card `4242...`. Polar has a separate sandbox at `sandbox.polar.sh`. Lemon Squeezy uses `--test-mode` flag on CLI and API.

**Customer reconciliation**: All three support external customer IDs. Set them at checkout creation to link back to your user system. Stripe: `metadata.user_id`. Polar: `external_customer_id` field. Lemon Squeezy: `custom` JSON field on checkout.
