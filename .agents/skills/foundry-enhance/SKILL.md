---
name: foundry-enhance
description: Run the Foundry enhance workflow explicitly with the project's selected provider.
---

# Enhance

Read `docs/WORKFLOW.md` first. Treat the enhancement as a new bounded spec against the existing product. Inspect the current behavior, preserve established contracts, define acceptance checks, then use the normal start, verify, and complete lifecycle. Never edit runtime state by hand.

Use docs/WORKFLOW-CONTRACTS.md for current records and applicable artifact gates.
Choose small/feature/product depth, reuse current handoffs, and keep accepted
criteria linked to decisions, evidence, or explicit assumptions. UI changes use
the relevant six UX artifacts from WORKFLOW.md. The adopted product brief governs
aesthetics. Reviewers return findings; the coordinator owns final lifecycle
transitions. Missing evidence stays UNVERIFIED and failed repairs preserve FAIL.
