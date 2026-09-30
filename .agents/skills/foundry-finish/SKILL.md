---
name: foundry-finish
description: Run the Product Foundry finish workflow explicitly in Codex.
---

# Finish

Read `docs/WORKFLOW.md` first. Inspect status, run `python3 scripts/foundry.py verify`, and resolve every required failure. Complete only with `python3 scripts/foundry.py complete`; that command enforces fresh passing receipts. Report skipped optional checks separately from proof.

## Authority

This is a Product Foundry native lifecycle skill. The runtime's verification receipts are authoritative.
