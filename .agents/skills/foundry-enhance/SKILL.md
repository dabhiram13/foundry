---
name: foundry-enhance
description: Run the Product Foundry enhance workflow explicitly in Codex.
---

# Enhance

Read `docs/WORKFLOW.md` first. Treat the enhancement as a new bounded spec against the existing product. Inspect the current behavior, preserve established contracts, define acceptance checks, then use the normal start, verify, and complete lifecycle. Never edit runtime state by hand.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/enhance.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
