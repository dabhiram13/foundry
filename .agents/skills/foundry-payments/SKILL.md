---
name: foundry-payments
description: Run the Product Foundry payments workflow explicitly in Codex.
---

# Payments

Read `docs/WORKFLOW.md` first. Map products, prices, entitlements, checkout, webhook idempotency, and recovery before editing. Use the project's selected provider, test in sandbox mode, protect secrets, and require real signature and authorization checks. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.
