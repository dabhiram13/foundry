# Feature Setup — Reference Index

> Orchestrator: read each template only when you need it during Step 3 synthesis. Do NOT load all templates upfront.

| File | Description | Used to generate |
|------|-------------|-----------------|
| `foundation-template.md` | Condensed project rules, relevant schema, banned patterns. | `dev/active/{feature}/foundation.md` |
| `plan-template.md` | Phases, tasks, reference manifest, acceptance criteria. | `dev/active/{feature}/plan.md` |
| `tasks-template.md` | Checkbox list grouped by phase and agent. | `dev/active/{feature}/tasks.md` |
| `decisions-template.md` | Cross-domain decision log format. | `dev/active/{feature}/decisions.md` |
| `context-template.md` | Planning metadata, handoff summaries, file tracking. | `dev/active/{feature}/context.md` |
| `build-kit-factory-workflow.md` | Repeatable repo-level workflow for cloned Build Kit products. | Standard delivery process for every new product repo |
| `automation-pack-template.md` | Standard recurring automation set for each product repo. | Hourly delivery loop + maintenance automations |

## Feature Briefs (written by planners, read by build agents)

Briefs are NOT templates — they're written by planners per feature. Listed here for reference:

| Brief | Written by | Read by | Contains |
|-------|-----------|---------|----------|
| `frontend-brief.md` | planner (M/L) | connector, designer, **flow-tester** | Page pattern, cache strategy, loading states, `## Must Read` docs, `## Testing` with journeys |
| `backend-brief.md` | planner (M/L) | backend, **api-tester** | Procedure templates, schema ref, monetization strategy, `## Must Read` docs, `## Testing` with API contracts + Inngest |
| `build-brief.md` | solo planner (S) | all build + test agents | Combined frontend + backend + testing patterns, `## Must Read` docs |
