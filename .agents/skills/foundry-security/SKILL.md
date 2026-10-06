---
name: foundry-security
description: Run the Foundry security workflow explicitly with the project's selected provider.
---

# Security

Read `docs/WORKFLOW.md` first. Map trust boundaries and sensitive data for the requested scope, run the repository's configured security checks, validate findings, and propose or implement the smallest fix without exposing secret values. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
