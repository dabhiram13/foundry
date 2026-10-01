---
name: foundry-performance
description: Run the Marketcraft performance workflow explicitly in Codex.
---

# Performance

Read `docs/WORKFLOW.md` first. Measure the requested path before changing it, identify the dominant bottleneck, make one bounded improvement, and remeasure under the same conditions. Record workload and variance with the result. Use `scripts/marketcraft.py` for lifecycle state; do not handcraft state or receipts.
