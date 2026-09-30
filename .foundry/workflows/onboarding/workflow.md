# Onboarding Workflow

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Adapt the existing onboarding skeleton to this project's needs. The skeleton (ORPC procedures, components, flow orchestrator) already exists. This workflow customizes it: what questions to ask, what options to show, what the answers change.

## What Already Exists

- `docs/built/onboarding.md` — ORPC procedures, DB schema, preference columns
- (frontend docs merged into docs/built/onboarding.md) — Typeform-style components, hooks, data flow
- `webapp/features/onboarding/` — working code skeleton
- `webapp/lib/orpc/procedures/onboarding.ts` — procedures wired to router
- `webapp/app/onboarding/page.tsx` — page

**Do NOT rebuild these.** Read them. Adapt them.

## Inputs

1. `docs/project/users-and-journeys.md` — onboarding section, personas, questions, options
3. `docs/project/product-overview.md` — problem/solution (for value messaging)
4. `docs/built/onboarding.md` — existing skeleton (data model, procedures, components, hooks)

---

## Steps — Checklist

- [ ] **Step 1: Decide What to Ask** → `steps/01-decide.md`
  Read discovery docs, pick questions, define options, cut anything that doesn't change the product

- [ ] **Step 2: Adapt the Skeleton** → `steps/02-adapt.md`
  Update preference columns, ORPC schemas, component options, copy

- [ ] **Step 3: Verify** → `steps/03-verify.md`
  Full flow, build check, design system

---

## Prerequisites

- **Auth workflow** completed (sign-in returns onboarding redirect)
- **Design-system workflow** completed (card patterns, tokens)

## Required Skills

| Skill | When |
|-------|------|
| `marketing-psychology` | Step 1 — goal-gradient, commitment & consistency |
| `tailwind-design-system` | Step 2 — card patterns if customizing SelectCard |

## Resume

Read checklist. Skip done steps. Read next pending step.

## References

- `references/onboarding-rules.md` — clicks over inputs, auto-advance, show value, banned patterns
