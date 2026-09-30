---
name: foundry-security
description: Run the Product Foundry security workflow explicitly in Codex.
---

# Security

Read `docs/WORKFLOW.md` first. Map trust boundaries and sensitive data for the requested scope, run the repository's configured security checks, validate findings, and propose or implement the smallest fix without exposing secret values. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/security.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
