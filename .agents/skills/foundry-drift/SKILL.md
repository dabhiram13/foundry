---
name: foundry-drift
description: Run the Product Foundry drift workflow explicitly in Codex.
---

# Drift

Read `docs/WORKFLOW.md` first. Compare documented contracts with current code, configuration, and schemas. Report exact differences, select the owning source of truth, and update only the stale side after preserving intentional local changes. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.
