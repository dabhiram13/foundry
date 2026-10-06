---
name: foundry-rate-limit
description: Run the Foundry rate-limit workflow explicitly with the project's selected provider.
---

# Rate Limit

Read `docs/WORKFLOW.md` first. Identify the protected resource, caller identity, trust boundary, desired burst and recovery behavior. Prefer an existing gateway or datastore primitive, fail safely, and test allowed, rejected, and reset paths. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
