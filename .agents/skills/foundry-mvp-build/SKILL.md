---
name: foundry-mvp-build
description: Implement an accepted product slice through planning, scoped delegation, behavior checks, and integration.
---

# Mvp Build

Read `docs/WORKFLOW.md`, inspect runtime status, and read the active spec. If no active implementation run exists, scope the request before starting one. Resume paused or continued implementation through the runtime; keep the same run identity.

Follow the workflow's coordination rules. Plan shared interfaces before parallel work, give each delegate owned files and acceptance criteria, and integrate actual results. Use the planner only when dependencies justify it; specialist reference stacks are conditional.

Build the smallest complete user journey first. Configure real project checks, exercise changed behavior, and preserve existing tests and owner changes. Investigate failed checks; do not weaken them to obtain a pass.

Before completion, compare each accepted criterion with implemented behavior and evidence. Seek independent review for substantial changes when available. Update relevant work notes before final verification, then run the runtime's verify and complete commands. Report unverified integrations and remaining product decisions explicitly.
