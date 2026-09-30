---
name: foundry-rate-limit
description: Run the Product Foundry rate-limit workflow explicitly in Codex.
---

# Rate Limit

Read `docs/WORKFLOW.md` first. Identify the protected resource, caller identity, trust boundary, desired burst and recovery behavior. Prefer an existing gateway or datastore primitive, fail safely, and test allowed, rejected, and reset paths. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/rate-limit.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
