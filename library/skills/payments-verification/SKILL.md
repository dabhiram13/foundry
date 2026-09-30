---
name: payments-verification
description: >
  Verify payment flows safely: checkout, customer portal, webhook handling, post-purchase state,
  upgrades, and ownership checks. Use for "verify payments", "checkout flow", "webhook test",
  "billing smoke test", or after any payment implementation.
---

# Payments Verification

Use this when money movement is involved or when the billing flow already exists and must be trusted.

## What This Skill Covers

- checkout success path
- cancel path
- webhook or sync confirmation
- portal / billing management path
- post-purchase state in the app
- entitlement / ownership verification

## Core Rules

1. Never call billing done without a verification pass.
2. Test the user-visible path and the system-visible state.
3. Verify ownership and post-purchase entitlements, not just redirect success.
4. Keep verification provider-aware but product-focused.
5. Use screenshots, logs, or test evidence when they change the next action.

## Standard Workflow

1. Read `references/checkout-flow.md`
2. Read `references/webhook-and-state.md`
3. Read `references/post-purchase-verdict.md`

## References

- `references/checkout-flow.md`
- `references/webhook-and-state.md`
- `references/post-purchase-verdict.md`
