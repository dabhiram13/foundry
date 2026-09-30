---
name: foundry-emails
description: Run the Product Foundry emails workflow explicitly in Codex.
---

# Emails

Read `docs/WORKFLOW.md` first. Define the email's trigger, recipient, consent, content, and failure behavior. Use the project's existing email provider and templates, render-test the output, and never send a real message without explicit authorization. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.
