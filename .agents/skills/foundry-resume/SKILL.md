---
name: foundry-resume
description: Run the Foundry resume workflow explicitly in Codex.
---

# Resume

Read `docs/WORKFLOW.md` first. For a scoped run, inspect `foundry work status --project PATH`, then use `foundry work recover --project PATH` when the saved state is interrupted. For a product run, inspect `foundry status PROJECT` and use `foundry recover PROJECT` before continuing with an explicitly authorized `foundry run PROJECT`. Do not claim that recovery resumed work automatically. If no active run exists, use `foundry-start` or `foundry-spec` for the request.

## Authority

This is a Foundry native lifecycle skill. The runtime's verification receipts are authoritative.

Use docs/WORKFLOW-CONTRACTS.md for current records and applicable artifact gates.
Choose small/feature/product depth, reuse current handoffs, and keep accepted
criteria linked to decisions, evidence, or explicit assumptions. UI changes use
the relevant six UX artifacts from WORKFLOW.md. The adopted product brief governs
aesthetics. Reviewers return findings; the coordinator owns final lifecycle
transitions. Missing evidence stays UNVERIFIED and failed repairs preserve FAIL.
