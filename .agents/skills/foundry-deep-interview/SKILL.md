---
name: foundry-deep-interview
description: Run the Foundry deep-interview workflow explicitly in Codex.
---

# Deep Interview

Read `docs/WORKFLOW.md` first. Ask only questions whose answers change scope, behavior, or risk. Maintain a compact decision record, resolve contradictions, and turn the result into a bounded spec rather than an open-ended transcript. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
