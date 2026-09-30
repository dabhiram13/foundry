---
name: foundry-finish
description: Finish an implemented Product Foundry feature using current checks and an explicit acceptance-to-evidence comparison.
---

# Finish

Read `docs/WORKFLOW.md`, status, the active spec, and review findings. Confirm accepted criteria are addressed and evidence exists; passing configured commands cannot compensate for an unimplemented requirement.

Resolve blocking findings within existing authority. Record relevant decisions and evidence notes before final verification. Run `python3 scripts/foundry.py verify`, inspect required failures, and complete only with `python3 scripts/foundry.py complete` after required checks pass.

Report implemented behavior, actual checks, unverified or optional items, and the completed record. Keep local completion, release, and owner acceptance distinct. Do not handcraft runtime state or receipts.
