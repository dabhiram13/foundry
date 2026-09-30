---
name: foundry-help
description: Run the Product Foundry help workflow explicitly in Codex.
---

# Help

Read `docs/WORKFLOW.md` first. Read `docs/CATALOG.md`, `docs/WORKFLOW.md`, and current runtime status. Recommend the narrowest skill or runtime command for the user's goal and explain any missing prerequisite without changing state. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/help.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
