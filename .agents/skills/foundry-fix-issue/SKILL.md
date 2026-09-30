---
name: foundry-fix-issue
description: Run the Product Foundry fix-issue workflow explicitly in Codex.
---

# Fix Issue

Read `docs/WORKFLOW.md` first. Reproduce the issue, trace every caller of the failing shared path, fix the root cause once, and run the smallest meaningful regression check plus configured project checks. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.
