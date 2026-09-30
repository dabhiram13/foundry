---
name: foundry-spec
description: Run the Product Foundry spec workflow explicitly in Codex.
---

# Spec

Read `docs/WORKFLOW.md` first. Turn one bounded change into an implementable spec under `docs/specs/`. State behavior, files or boundaries, acceptance checks, and unresolved decisions. Do not claim approval. Start or associate the run through the runtime; do not handcraft `.foundry/state`, run state, receipts, or snapshots.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/spec.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
