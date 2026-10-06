---
name: foundry-drift
description: Run the Foundry drift workflow explicitly with the project's selected provider.
---

# Drift

Read `docs/WORKFLOW.md` first. Compare documented contracts with current code, configuration, and schemas. Report exact differences, select the owning source of truth, and update only the stale side after preserving intentional local changes. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
