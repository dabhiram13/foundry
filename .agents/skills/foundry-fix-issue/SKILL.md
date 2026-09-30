---
name: foundry-fix-issue
description: Run the Product Foundry fix-issue workflow explicitly in Codex.
---

# Fix Issue

Read `docs/WORKFLOW.md` first. Reproduce the issue, trace every caller of the failing shared path, fix the root cause once, and run the smallest meaningful regression check plus configured project checks. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/fix-issue.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
