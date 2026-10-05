---
name: foundry-payments
description: Run the Foundry payments workflow explicitly in Codex.
---

# Payments

Read `docs/WORKFLOW.md` first. Map products, prices, entitlements, checkout, webhook idempotency, and recovery before editing. Use the project's selected provider, test in sandbox mode, protect secrets, and require real signature and authorization checks. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
