---
name: foundry-design
description: Run the Product Foundry design workflow explicitly in Codex.
---

# Design

Read `docs/WORKFLOW.md` first. Read the approved experience and existing tokens, inspect the actual UI, then implement the smallest coherent interaction. Verify responsive behavior, keyboard access, contrast, loading and error states in a browser. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/design.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
