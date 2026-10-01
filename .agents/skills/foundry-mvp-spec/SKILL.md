---
name: foundry-mvp-spec
description: Scope the first complete user journey for a new product, with testable requirements and explicit dependencies.
---

# Mvp Spec

Read `docs/WORKFLOW.md` and the owner's product decisions. Write a spec under `docs/specs/` describing who uses the product, their core journey, observable success, exclusions, and constraints.

Choose a complete vertical slice through the necessary UI/API/data layers. State real service dependencies and distinguish local demonstrations from live integrations. Preserve the chosen stack; surface material alternatives only when unresolved.

Give acceptance criteria stable IDs and a concrete check for each. Include relevant failure, permission, persistence, accessibility, or recovery behavior. Record assumptions and open decisions separately from accepted requirements. Use the existing product documents for durable decisions rather than duplicating them.

Do not start implementation merely because the spec is written. If implementation is already authorized and consequential decisions are resolved, the coordinator may start the runtime run and continue.

Use docs/WORKFLOW-CONTRACTS.md for current records and applicable artifact gates.
Choose small/feature/product depth, reuse current handoffs, and keep accepted
criteria linked to decisions, evidence, or explicit assumptions. UI changes use
the relevant six UX artifacts from WORKFLOW.md. The adopted product brief governs
aesthetics. Reviewers return findings; the coordinator owns final lifecycle
transitions. Missing evidence stays UNVERIFIED and failed repairs preserve FAIL.
