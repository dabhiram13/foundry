---
name: foundry-verify
description: Verify a Foundry change against acceptance criteria and configured checks, reporting evidence and gaps.
---

# Verify

Read `docs/WORKFLOW.md`, inspect runtime status, and read the active spec. Inspect the actual change and configured checks: check names alone do not demonstrate requirement coverage.

When the Factory Test step invokes this skill in a read-only provider turn, inspect
and report only. Do not run lifecycle commands or edit receipts; the Factory
controller performs and records verification after that turn.

Exercise relevant behavior and map acceptance criteria to results. Include running-app interaction for UI behavior and real boundary checks for persistence, permissions, or integrations in scope. Missing tools or services leave the affected criterion unverified.

Run `python3 scripts/marketcraft.py verify` and inspect failures and unavailable-check logs. A verification-only request authorizes reporting findings, not silently changing the product. When fixing is already authorized, resolve the cause and rerun after relevant changes.

Keep evidence notes settled before final verification; editing included files afterward makes receipts stale. The runtime owns receipts, and only its complete command records local completion. Passing checks do not establish owner acceptance or production qualification.

Use docs/WORKFLOW-CONTRACTS.md for current records and applicable artifact gates.
Choose small/feature/product depth, reuse current handoffs, and keep accepted
criteria linked to decisions, evidence, or explicit assumptions. UI changes use
the relevant six UX artifacts from WORKFLOW.md. The adopted product brief governs
aesthetics. Reviewers return findings; the coordinator owns final lifecycle
transitions. Missing evidence stays UNVERIFIED and failed repairs preserve FAIL.
