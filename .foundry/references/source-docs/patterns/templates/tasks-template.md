# Tasks: {feature}

**Work Type: {new-feature | enhancement}**

## Setup
- [ ] Detect work type (check for enhancements/ folder + existing code)
- [ ] Read feature specs (backend.md, frontend.md)
{If enhancement:}
- [ ] Read enhancement specs (enhancements/backend.md, enhancements/frontend.md)
- [ ] Read existing code (procedures, components, hooks)
- [ ] Run backend planner agent
- [ ] Run frontend planner agent
- [ ] Aggregate analyses + cross-domain cross-talk
- [ ] Generate workspace files (foundation, plan, tasks, decisions, context)

## Backend

### Database Architect Tasks
- [ ] Read Reference Manifest files (see plan.md → Reference Manifest → Database Architect)
- [ ] {tasks from backend analysis — tables, RLS, indexes, migrations}

### oRPC Expert Tasks
- [ ] Read Reference Manifest files (see plan.md → Reference Manifest → oRPC Expert)
- [ ] {tasks from backend analysis — procedures, schemas, router wiring}
- [ ] Write API tests: `webapp/tests/e2e/{feature}-api.spec.ts`
- [ ] Type check passes: `npx tsc --noEmit`

## Frontend

### Backend Connector Tasks
- [ ] Read Reference Manifest files (see plan.md → Reference Manifest → Backend Connector)
- [ ] {tasks from frontend analysis — types, hooks, page structure, cache strategy}
- [ ] Type check passes: `npx tsc --noEmit`

### Design Agent Tasks
- [ ] Read Reference Manifest files (see plan.md → Reference Manifest → Design Agent)
- [ ] {tasks from frontend analysis — components, skeletons, styling, layout}
- [ ] Type check passes: `npx tsc --noEmit`
- [ ] Visual verification (screenshots at 3 breakpoints)

## Tests
- [ ] API tests pass: `webapp/tests/e2e/{feature}-api.spec.ts`
- [ ] Visual smoke test pass (agent-browser during quality gates)

## Docs Update
- [ ] Rewrite `docs/features/{feature}/backend.md` to match implementation
- [ ] Rewrite `docs/features/{feature}/frontend.md` to match implementation
{If enhancement:}
- [ ] Delete `docs/features/{feature}/enhancements/` directory

## Complete
- [ ] Type check: `npx tsc --noEmit`
- [ ] Lint: `npx eslint webapp/`
- [ ] API tests pass
- [ ] Architecture compliance (forward deps only)
- [ ] Move to `dev/archive/{feature}/`

---

<!-- FIX VARIANT — used when Work Type is "fix". Replace everything above with this simpler structure. -->

<!--
# Tasks: {feature}

**Work Type: fix** | **Scope: {backend | frontend | both}**

## Problem
{One-line problem summary}

## Fix Tasks

### {Agent} Tasks
- [ ] Read existing code at {path}
- [ ] {specific fix task from problem description}
- [ ] Type check passes: `npx tsc --noEmit`

{Repeat for each agent in scope}

## Quality
- [ ] Type check: `npx tsc --noEmit`
- [ ] Lint passes
- [ ] API tests pass (if backend scope)

## Complete
- [ ] Move to `dev/archive/{feature}/`
-->
