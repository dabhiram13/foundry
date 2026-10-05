---
name: foundry-finish
description: Finish an implemented Foundry feature using current checks and an explicit acceptance-to-evidence comparison.
---

# Finish

Read `docs/WORKFLOW.md`, status, the active spec, and review findings. Confirm accepted criteria are addressed and evidence exists; passing configured commands cannot compensate for an unimplemented requirement.

Resolve blocking findings within existing authority. Record relevant decisions and evidence notes before final verification. For scoped work, run `foundry work verify --project PATH`, inspect required failures and nested evidence, then use `foundry work complete --project PATH` only after required checks pass. For a product journey, advance one stage at a time with `foundry run PROJECT`, review pending Plan or Design, and approve only its displayed revision.

Report implemented behavior, actual checks, unverified or optional items, and the completed record. Keep local completion, release, and owner acceptance distinct. Do not handcraft runtime state or receipts.

Use docs/WORKFLOW-CONTRACTS.md for current records and applicable artifact gates.
Choose small/feature/product depth, reuse current handoffs, and keep accepted
criteria linked to decisions, evidence, or explicit assumptions. UI changes use
the relevant six UX artifacts from WORKFLOW.md. The adopted product brief governs
aesthetics. Reviewers return findings; the coordinator owns final lifecycle
transitions. Missing evidence stays UNVERIFIED and failed repairs preserve FAIL.
