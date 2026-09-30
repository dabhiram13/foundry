---
name: foundry-resume
description: Run the Product Foundry resume workflow explicitly in Codex.
---

# Resume

Read `docs/WORKFLOW.md` first, then inspect `python3 scripts/foundry.py status` and the active spec it reports. Run `python3 scripts/foundry.py resume` to continue the same run, reconcile partial edits, and keep working within the existing authorization. If no active run exists, use `foundry-start` or `foundry-spec` for the request.

## Authority

This is a Product Foundry native lifecycle skill. The runtime's verification receipts are authoritative.
