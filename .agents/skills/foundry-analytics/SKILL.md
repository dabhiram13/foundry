---
name: foundry-analytics
description: Run the Foundry analytics workflow explicitly with the project's selected provider.
---

# Analytics

Read `docs/WORKFLOW.md` first. Inspect the product's real events and decision questions. Define a small event contract with names, properties, identity, consent, and one validation path; implement against the provider already chosen by the project and add an executable check. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
