---
name: payment-processing
description: >
  Choose and implement the right payment provider and billing model. Use for "payments",
  "billing", "checkout", "subscriptions", "lemon squeezy", "polar", "stripe",
  "one-time purchase", or "customer portal".
---

# Payment Processing

Use this as the top-level router for billing work.

## What This Skill Does

It chooses:
- provider
- billing model
- setup surfaces
- next implementation path

## Provider Decision Tree

- `references/stripe.md`
  - default for app-integrated billing
  - strongest fit when the product already uses Supabase + server logic
  - best for complex billing surfaces and custom checkout control

- `references/lemon-squeezy.md`
  - strong fit for simpler hosted billing
  - good when lower integration depth is more valuable than full billing ownership
  - useful for straightforward software sales and subscriptions

- `references/polar.md`
  - strong fit for developer tools and productized software
  - useful when entitlements/licensing feel closer to the product than raw payment plumbing

## Core Rules

1. Pick the provider before shaping the whole billing architecture.
2. Pick the billing model before touching checkout UI.
3. Ask for keys, webhooks, and product IDs later in `/setup`.
4. Reuse the current stack when it already strongly favors one provider.
5. Pair implementation with `payments-verification` when money movement is involved.

## Standard Workflow

1. Decide the billing model:
   - one-time
   - subscription
   - mixed
2. Choose the provider
3. List setup requirements
4. Choose the implementation surface
5. Pull in `payments-verification` if validation is in scope

## Output

Always produce:
- chosen provider
- why it fits
- billing model
- setup later
- next skill or command

## References

- `references/stripe.md`
- `references/lemon-squeezy.md`
- `references/polar.md`
