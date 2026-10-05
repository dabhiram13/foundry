---
name: foundry-settings
description: Run the Foundry settings workflow explicitly in Codex.
---

# Settings

Read `docs/WORKFLOW.md` first. Inventory user-visible settings, ownership, defaults, persistence, validation, and permission boundaries. Implement one coherent settings flow with accessible forms and verified save, error, and reload behavior. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
