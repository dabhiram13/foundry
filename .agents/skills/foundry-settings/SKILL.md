---
name: foundry-settings
description: Run the Product Foundry settings workflow explicitly in Codex.
---

# Settings

Read `docs/WORKFLOW.md` first. Inventory user-visible settings, ownership, defaults, persistence, validation, and permission boundaries. Implement one coherent settings flow with accessible forms and verified save, error, and reload behavior. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/settings.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
