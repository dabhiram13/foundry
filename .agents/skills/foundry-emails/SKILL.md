---
name: foundry-emails
description: Run the Product Foundry emails workflow explicitly in Codex.
---

# Emails

Read `docs/WORKFLOW.md` first. Define the email's trigger, recipient, consent, content, and failure behavior. Use the project's existing email provider and templates, render-test the output, and never send a real message without explicit authorization. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/emails.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
