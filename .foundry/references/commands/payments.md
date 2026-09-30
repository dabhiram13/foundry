<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: payments
description: Route payment and billing work across Stripe, Lemon Squeezy, and Polar. Choose the provider, scope the billing model, and verify the purchase flow safely.
---

# Payments

Use this when the user wants payments, subscriptions, checkout, billing, entitlements, or provider selection.

Load `payment-processing` first.

Do not assume Stripe unless it is clearly the best fit.
Do not ask for every billing credential upfront.
Do not implement payment flows without a verification path.

Arguments: `$ARGUMENTS`
- no args = inspect the request and propose the best payment path
- `--stripe` = force Stripe
- `--lemon` = force Lemon Squeezy
- `--polar` = force Polar
- `--verify` = focus on checkout/webhook/portal verification

## Purpose

`/payments` owns:
- provider choice
- billing model choice
- setup handoff for missing keys
- payment-flow planning
- purchase verification planning

## Output

Always respond with:

> Payments path:
> - provider: {Stripe | Lemon Squeezy | Polar}
> - why: {short reason}
> - billing model: {one-time | subscription | mixed}
> - skills activated: {list}
> - setup later: {keys, webhooks, products, env vars}
> - best next move: {one action}

Then proceed through the narrowest relevant path.

## Rules

1. Choose the provider before writing billing logic.
2. Separate provider choice from verification.
3. Route credentials and product IDs through `/setup` later.
4. Always verify checkout, webhook, and post-purchase state before calling the flow done.
5. Use `payments-verification` when the task is validation-heavy.
