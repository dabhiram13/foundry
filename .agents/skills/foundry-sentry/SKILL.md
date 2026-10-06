---
name: foundry-sentry
description: Run the Foundry sentry workflow explicitly with the project's selected provider.
---

# Sentry

Read `docs/WORKFLOW.md` first. Use the configured Sentry connector or CLI only when authorized. Correlate events with release and code evidence, reproduce where possible, fix the root cause, and verify with local checks before marking an issue resolved. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
