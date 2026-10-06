---
name: foundry-schema-sync
description: Run the Foundry schema-sync workflow explicitly with the project's selected provider.
---

# Schema Sync

Read `docs/WORKFLOW.md` first. Inspect the live or local schema only through the project's authorized database tooling. Regenerate `db-schema.md` from observed tables, policies, indexes, and migrations; never infer production state from migration files alone. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
