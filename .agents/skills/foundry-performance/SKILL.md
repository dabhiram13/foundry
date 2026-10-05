---
name: foundry-performance
description: Run the Foundry performance workflow explicitly in Codex.
---

# Performance

Read `docs/WORKFLOW.md` first. Measure the requested path before changing it, identify the dominant bottleneck, make one bounded improvement, and remeasure under the same conditions. Record workload and variance with the result. Use `foundry work status --project PATH`, `foundry work start SLUG --spec PATH --project PATH`, and explicit `foundry work verify`/`complete` commands for scoped work. Never hand-edit `.foundry/state`.
