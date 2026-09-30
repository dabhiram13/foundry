---
name: foundry-blog
description: Run the Product Foundry blog workflow explicitly in Codex.
---

# Blog

Read `docs/WORKFLOW.md` first. Inspect the product voice, audience, current content model, and publishing boundary. Create or update a draft through the project's existing content path, verify rendering and metadata, and do not publish or notify anyone without authorization. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/blog.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
