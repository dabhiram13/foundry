---
name: foundry-rate-limit
description: Run the Foundry rate-limit workflow explicitly in Codex.
---

# Rate Limit

Read `docs/WORKFLOW.md` first. Identify the protected resource, caller identity, trust boundary, desired burst and recovery behavior. Prefer an existing gateway or datastore primitive, fail safely, and test allowed, rejected, and reset paths. Use `scripts/marketcraft.py` for lifecycle state; do not handcraft state or receipts.
