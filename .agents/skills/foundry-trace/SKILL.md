---
name: foundry-trace
description: Run the Foundry trace workflow explicitly with the project's selected provider.
---

# Trace

Read `docs/WORKFLOW.md` first. Trace the requested behavior end to end from user action through state, network, backend, and persistence. Save a concise evidence map with exact files and observations; keep hypotheses labeled until reproduced. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
