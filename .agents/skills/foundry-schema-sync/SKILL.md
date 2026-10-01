---
name: foundry-schema-sync
description: Run the Marketcraft schema-sync workflow explicitly in Codex.
---

# Schema Sync

Read `docs/WORKFLOW.md` first. Inspect the live or local schema only through the project's authorized database tooling. Regenerate `db-schema.md` from observed tables, policies, indexes, and migrations; never infer production state from migration files alone. Use `scripts/marketcraft.py` for lifecycle state; do not handcraft state or receipts.
