---
name: foundry-schema-sync
description: Run the Product Foundry schema-sync workflow explicitly in Codex.
---

# Schema Sync

Read `docs/WORKFLOW.md` first. Inspect the live or local schema only through the project's authorized database tooling. Regenerate `db-schema.md` from observed tables, policies, indexes, and migrations; never infer production state from migration files alone. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/schema-sync.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
