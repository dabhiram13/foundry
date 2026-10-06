---
name: foundry-emails
description: Run the Foundry emails workflow explicitly with the project's selected provider.
---

# Emails

Read `docs/WORKFLOW.md` first. Define the email's trigger, recipient, consent, content, and failure behavior. Use the project's existing email provider and templates, render-test the output, and never send a real message without explicit authorization. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
