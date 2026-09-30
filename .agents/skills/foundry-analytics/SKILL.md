---
name: foundry-analytics
description: Run the Product Foundry analytics workflow explicitly in Codex.
---

# Analytics

Read `docs/WORKFLOW.md` first. Inspect the product's real events and decision questions. Define a small event contract with names, properties, identity, consent, and one validation path; implement against the provider already chosen by the project and add an executable check. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/analytics.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
