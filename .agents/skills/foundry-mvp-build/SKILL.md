---
name: foundry-mvp-build
description: Implement an accepted product slice through planning, scoped delegation, behavior checks, and integration.
---

# Mvp Build

Read `docs/WORKFLOW.md`, inspect runtime status, and read the active spec. If no active implementation run exists, scope the request before starting one. Resume paused or continued implementation through the runtime; keep the same run identity.

Follow the workflow's coordination rules. Plan shared interfaces before parallel work, give each delegate owned files and acceptance criteria, and integrate actual results. Use the planner only when dependencies justify it; specialist reference stacks are conditional.

Build the smallest complete user journey first. Configure real project checks, exercise changed behavior, and preserve existing tests and owner changes. Investigate failed checks; do not weaken them to obtain a pass.

Before completion, compare each accepted criterion with implemented behavior and evidence. Seek independent review for substantial changes when available. Update relevant work notes before final verification, then run the runtime's verify and complete commands. Report unverified integrations and remaining product decisions explicitly.

Use docs/WORKFLOW-CONTRACTS.md for current records and applicable artifact gates.
Choose small/feature/product depth, reuse current handoffs, and keep accepted
criteria linked to decisions, evidence, or explicit assumptions. UI changes use
the relevant six UX artifacts from WORKFLOW.md. The adopted product brief governs
aesthetics. Reviewers return findings; the coordinator owns final lifecycle
transitions. Missing evidence stays UNVERIFIED and failed repairs preserve FAIL.
