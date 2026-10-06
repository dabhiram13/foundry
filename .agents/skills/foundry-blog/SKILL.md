---
name: foundry-blog
description: Run the Foundry blog workflow explicitly with the project's selected provider.
---

# Blog

Read `docs/WORKFLOW.md` first. Inspect the product voice, audience, current content model, and publishing boundary. Create or update a draft through the project's existing content path, verify rendering and metadata, and do not publish or notify anyone without authorization. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
