---
name: foundry-verify
description: Run the Product Foundry verify workflow explicitly in Codex.
---

# Verify

Read `docs/WORKFLOW.md` first and inspect `python3 scripts/foundry.py status`. Run `python3 scripts/foundry.py verify`, inspect failed or unavailable check logs, resolve causes within scope, and verify again only after relevant changes. Tests passing is evidence, not owner approval or production qualification; completion remains owned by `python3 scripts/foundry.py complete`.

## Authority

This is a Product Foundry native lifecycle skill. The runtime's verification receipts are authoritative.
