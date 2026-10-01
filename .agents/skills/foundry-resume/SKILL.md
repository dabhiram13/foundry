---
name: foundry-resume
description: Run the Marketcraft resume workflow explicitly in Codex.
---

# Resume

Read `docs/WORKFLOW.md` first, then inspect `python3 scripts/marketcraft.py status` and the active spec it reports. Run `python3 scripts/marketcraft.py resume` to continue the same run, reconcile partial edits, and keep working within the existing authorization. If no active run exists, use `foundry-start` or `foundry-spec` for the request.

## Authority

This is a Marketcraft native lifecycle skill. The runtime's verification receipts are authoritative.

Use docs/WORKFLOW-CONTRACTS.md for current records and applicable artifact gates.
Choose small/feature/product depth, reuse current handoffs, and keep accepted
criteria linked to decisions, evidence, or explicit assumptions. UI changes use
the relevant six UX artifacts from WORKFLOW.md. The adopted product brief governs
aesthetics. Reviewers return findings; the coordinator owns final lifecycle
transitions. Missing evidence stays UNVERIFIED and failed repairs preserve FAIL.
