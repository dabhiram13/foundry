# Patterns Index

Opinionated patterns and templates for building features. Planners read these and curate them into feature briefs for build agents.

## Sub-Indexes

| Index | What | Who reads it |
|-------|------|-------------|
| `backend/INDEX.md` | Procedure, schema, router, Inngest patterns | planner |
| `frontend/INDEX.md` | **Field guide (start here)**, architecture, component, hook, page, form + advanced patterns | planner |
| `templates/INDEX.md` | Workspace file templates (plan, tasks, decisions, context) | planner |
| `testing/INDEX.md` | **Testing patterns**: next-browser, API contracts, Inngest, flows, performance, security | api-tester, flow-tester, perf-tester |
| `quality/INDEX.md` | Quality checklist, archive protocol | quality-gate, complete |

## Standalone Patterns

| Pattern | What | Who reads it |
|---------|------|-------------|
| `stripe-confirm-purchase.md` | 3-layer post-checkout confirm flow | backend, connector |
| `team-workflows.md` | Planning, Design, Testing team coordination for M/L features | orchestrator (as team lead) |

## Pattern Selection Flow (brief-driven)

1. Planner reads sub-indexes + relevant pattern files
2. Planner writes **feature brief** (`frontend-brief.md`, `backend-brief.md`, or `build-brief.md`) with curated decisions and a `## Must Read` section listing specific pattern docs per agent
3. Build agents read the brief first, then the docs in its `## Must Read` section
4. Build agents follow the brief — they don't read all patterns, only what the planner selected
