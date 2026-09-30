# Plan: {feature}

## Work Type
**{new-feature | enhancement}**

## Goal
{One-line goal from feature spec or enhancement description}

## Source Docs
- `docs/features/{feature}/backend.md` — current state
- `docs/features/{feature}/frontend.md` — current state
{If enhancement:}
- `docs/features/{feature}/enhancements/backend.md` — changes to implement
- `docs/features/{feature}/enhancements/frontend.md` — changes to implement

---

## Feature Brief

> Condensed from feature specs by planner agents. Every agent reads this section.
> Target: **under 80 lines**. Dense, no filler. Every line carries information.

### Problem
{Why this feature exists — 3-5 lines. What user pain it solves.}

### Users & Access
{Who uses it, auth tier (protected/admin/public), role requirements.}

### Core Flows
{Primary user journeys — numbered steps, mapping to procedures and components.}

1. User navigates to `/protected/{feature}` → `{feature}/page.tsx` renders list via `list{Feature}` procedure
2. User clicks item → `{feature}/[id]/page.tsx` renders detail via `get{Feature}` procedure
3. User submits form → `create{Feature}` procedure → `{Feature}Form` component handles optimistic update
{etc — connect the dots between UI actions, components, and procedures}

### Data Model
| Table | Key Columns | Relationships |
|-------|-------------|---------------|
| {table_name} | id, user_id, title, status, created_at | user_id → auth.users |
{From backend planner analysis — condensed, not full DDL}

### Key Behaviors
| Procedure / Component | Behavior | Edge Cases |
|---|---|---|
| `create{Feature}` | Creates entity, returns `{ success, entity }` | Missing required fields → validation error, unauthorized → 403 |
| `{Feature}List` | Paginated list with filters, server component | Empty → "No items yet" CTA, loading → skeleton |
{From both planner analyses — this is the contract between spec and implementation}

### Acceptance Criteria
- [ ] {testable criterion 1 — from spec}
- [ ] {testable criterion 2}
- [ ] {testable criterion 3}
{From spec — what "done" looks like}

### Out of Scope
- {Explicit exclusion 1}
- {Explicit exclusion 2}
{From spec — prevents agents from over-building}

---

## Phases
{Mark which phases are active for this work:}
- [x] Backend {or "[ ] Backend — SKIP (no backend changes)"}
- [x] Frontend {or "[ ] Frontend — SKIP (no frontend changes)"}
- [x] Tests
- [x] Docs Update
- [x] Complete

## Phase 1: Backend

{From backend-analysis.md — aggregator fills this from the backend planner's output.}

### Schema
- [ ] Define Zod schemas in `webapp/lib/orpc/procedures/{feature}.ts`
- [ ] Enums: {list from analysis}
- [ ] Input schemas: {list from analysis}

### Database
- [ ] Create migration: `{table_name}` table
- [ ] Columns: {list from analysis}
- [ ] RLS policies: {list from analysis}
- [ ] Indexes: {list from analysis}

### Procedures
- [ ] Create `webapp/lib/orpc/procedures/{feature}.ts`
- [ ] Procedures: {list from analysis}
- [ ] Error handling: {from analysis}

### Router
- [ ] Import `{feature}Router` in `webapp/lib/orpc/procedures/protected.ts`
- [ ] Add `{feature}: {feature}Router` to `protectedRouter`

## Phase 2: Frontend

{From frontend-analysis.md — aggregator fills this from the frontend planner's output.}

### Types
- [ ] Create `webapp/features/{feature}/types/index.ts`
- [ ] Export types matching procedure outputs

### Hooks
- [ ] Create `webapp/features/{feature}/hooks/` with TanStack Query hooks
- [ ] {list hooks from analysis}

### Components
- [ ] Create `webapp/features/{feature}/components/`
- [ ] {list components from analysis}
- [ ] Skeleton component for loading states

### Pages
- [ ] Create `webapp/app/protected/{feature}/page.tsx`
- [ ] PPR structure: {from analysis — static shell, Suspense boundaries, cache tiers}

## Phase 3: Tests
- [ ] API tests: `webapp/tests/e2e/{feature}-api.spec.ts` (written by oRPC Expert)
- [ ] Visual smoke test via agent-browser (run during quality gates)

## Phase 4: Docs Update
- [ ] Read implemented code (procedures, components, hooks)
- [ ] Rewrite `docs/features/{feature}/backend.md` to match current implementation
- [ ] Rewrite `docs/features/{feature}/frontend.md` to match current implementation
{If enhancement:}
- [ ] Merge changes from `enhancements/` into main docs
- [ ] Delete `docs/features/{feature}/enhancements/` directory

## Phase 5: Quality Gate
- [ ] Code gates pass (tsc + lint + build)
- [ ] API tests pass
- [ ] Architecture compliance verified
- [ ] Visual smoke test pass (agent-browser)
- [ ] Performance audit (Lighthouse, bundle budgets)

## Cross-Domain Decisions

{From aggregator cross-talk — minimum 3 decisions.}

| # | Decision | Domain | Resolution |
|---|----------|--------|-----------|
| 1 | {decision} | {backend/frontend/cross} | {resolution} |

## Reference Manifest

Per-agent list of exactly which files to read. **Populated by the planner agents** during feature-setup, merged by the aggregator. Agents read ONLY what's listed here — nothing else.

### Database Architect
{From backend-analysis.md → Reference Manifest → Database Architect section.}
{Example:}
- `.foundry/references/source-docs/supabase/security.md`
- `library/skills/supabase-postgres-best-practices/references/security-rls-basics.md`
- `.foundry/references/source-docs/supabase/security.md`

### oRPC Expert
{From backend-analysis.md → Reference Manifest → oRPC Expert section.}
{Example:}
- `docs/orpc/procedures.md`
- `.foundry/references/source-docs/patterns/backend/orpc.md`
- `docs/orpc/procedures.md`

### Backend Connector
{From frontend-analysis.md → Reference Manifest → Backend Connector section.}
{Example:}
- `.foundry/references/source-docs/patterns/frontend/hook-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/page-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/gotchas.md`
- `docs/orpc/client.md`

### Design Agent
{From frontend-analysis.md → Reference Manifest → Design Agent section.}
{Example:}
- `.foundry/references/source-docs/patterns/frontend/component-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/tailwind-v4.md`
- `.foundry/references/source-docs/patterns/frontend/gotchas.md`

## Acceptance Criteria
{List from feature spec}

## Design Notes
{From frontend-analysis.md — aesthetic direction, layout approach, token mapping}

---

<!-- FIX VARIANT — used when Work Type is "fix". Replace everything above with this simpler structure. -->

<!--
# Plan: {feature}

## Work Type
**fix**

## Problem
{Problem description from CEO remediation doc or human input — paste verbatim}

## Scope
**{backend | frontend | both}**

## Source Docs
- `docs/features/{feature}/backend.md` — existing feature spec
- `docs/features/{feature}/frontend.md` — existing feature spec

## Fix Tasks

### Database Architect (if scope includes backend + schema change needed)
- [ ] {specific fix task from problem description}

### oRPC Expert (if scope includes backend)
- [ ] Read existing `webapp/lib/orpc/procedures/{feature}.ts`
- [ ] {specific fix task from problem description}
- [ ] Type check passes: `npx tsc --noEmit`

### Backend Connector (if scope includes frontend)
- [ ] Read existing `webapp/features/{feature}/`
- [ ] {specific fix task from problem description}
- [ ] Type check passes: `npx tsc --noEmit`

### Design Agent (if scope includes frontend)
- [ ] Read existing `webapp/features/{feature}/components/`
- [ ] {specific fix task from problem description}
- [ ] Type check passes: `npx tsc --noEmit`

## Reference Manifest

Core patterns only — no planner analysis needed.

### Database Architect
- `.foundry/references/source-docs/supabase/security.md`
- `docs/orpc/schemas.md`
- `.foundry/references/source-docs/supabase/performance.md`
- `.foundry/references/source-docs/supabase/security.md`

### oRPC Expert
- `docs/orpc/procedures.md`
- `docs/orpc/schemas.md`
- `.foundry/references/source-docs/patterns/backend/orpc.md`

### Backend Connector
- `.foundry/references/source-docs/patterns/frontend/hook-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/page-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/gotchas.md`

### Design Agent
- `.foundry/references/source-docs/patterns/frontend/component-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/tailwind-v4.md`
- `.foundry/references/source-docs/patterns/frontend/gotchas.md`
-->
