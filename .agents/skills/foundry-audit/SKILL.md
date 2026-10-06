---
name: foundry-audit
description: Run the Foundry audit workflow explicitly with the project's selected provider.
---

# Audit

Read `docs/WORKFLOW.md` first. Inspect the requested surface and report evidence with exact file references, severity, impact, and a concrete fix. Keep unverified concerns separate from confirmed defects; make changes only when the request includes implementation. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
