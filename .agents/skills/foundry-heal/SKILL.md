---
name: foundry-heal
description: Run the Product Foundry heal workflow explicitly in Codex.
---

# Heal

Read `docs/WORKFLOW.md` first. Diagnose from current evidence, make the smallest root-cause fix within the user's authorization, and run the configured checks once. Do not loop indefinitely, override sandboxing, hardcode a model, or treat warnings as verified repairs.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/heal.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
