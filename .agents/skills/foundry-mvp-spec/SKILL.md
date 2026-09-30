---
name: foundry-mvp-spec
description: Run the Product Foundry mvp-spec workflow explicitly in Codex.
---

# Mvp Spec

Read `docs/WORKFLOW.md` first. Define the smallest end-to-end product slice that proves the core user outcome. Include explicit exclusions, real dependencies, acceptance checks, and development versus production boundaries. Save the accepted spec under `docs/specs/`; runtime state remains owned by `scripts/foundry.py`.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/mvp-spec.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
