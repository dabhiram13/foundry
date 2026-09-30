---
name: foundry-sentry
description: Run the Product Foundry sentry workflow explicitly in Codex.
---

# Sentry

Read `docs/WORKFLOW.md` first. Use the configured Sentry connector or CLI only when authorized. Correlate events with release and code evidence, reproduce where possible, fix the root cause, and verify with local checks before marking an issue resolved. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/sentry.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
