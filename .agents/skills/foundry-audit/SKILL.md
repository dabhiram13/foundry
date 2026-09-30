---
name: foundry-audit
description: Run the Product Foundry audit workflow explicitly in Codex.
---

# Audit

Read `docs/WORKFLOW.md` first. Inspect the requested surface and report evidence with exact file references, severity, impact, and a concrete fix. Keep unverified concerns separate from confirmed defects; make changes only when the request includes implementation. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.
