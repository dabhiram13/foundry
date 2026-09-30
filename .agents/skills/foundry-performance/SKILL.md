---
name: foundry-performance
description: Run the Product Foundry performance workflow explicitly in Codex.
---

# Performance

Read `docs/WORKFLOW.md` first. Measure the requested path before changing it, identify the dominant bottleneck, make one bounded improvement, and remeasure under the same conditions. Record workload and variance with the result. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/performance.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
