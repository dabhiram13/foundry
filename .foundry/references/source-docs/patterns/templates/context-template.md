# Context: {feature}

## Work Type
**{new-feature | enhancement}**

## Status
- **Phase**: setup complete, ready for backend
- **Started**: {date}
- **Last Updated**: {date}
- **Active Phases**: {backend, frontend, tests, docs-update, complete}

## Source Docs
- `docs/features/{feature}/backend.md` — current state, read on {date}
- `docs/features/{feature}/frontend.md` — current state, read on {date}
{If enhancement:}
- `docs/features/{feature}/enhancements/backend.md` — changes to implement, read on {date}
- `docs/features/{feature}/enhancements/frontend.md` — changes to implement, read on {date}

## Skills Consulted
| Skill | Path | Key Takeaways |
|-------|------|---------------|
| Supabase Postgres Best Practices | `library/skills/supabase-postgres-best-practices/SKILL.md` | Read SKILL.md index, then only the relevant reference files — not all of them |
| Next.js Best Practices | `library/skills/next-best-practices/SKILL.md` | Read SKILL.md index, then only the relevant sub-files — not all of them |
| Next.js Cache Components | `library/skills/next-best-practices/references/next-cache-components/` | {e.g., "PPR: static shell + use cache for lists + Suspense for user data"} |
| Vercel React Best Practices | `library/skills/vercel-react-best-practices/` | {e.g., "async-parallel for independent fetches, bundle-dynamic-imports for heavy components"} |
| Frontend Design | `library/skills/frontend-design/` | {e.g., "Follow existing app aesthetic, shadcn primitives, distinctive typography"} |
| {conditional skills} | {path} | {takeaways} |

## Handoffs

Structured summaries from each agent. The orchestrator extracts these and injects into the next agent's prompt so it doesn't need to re-read raw files.

### Database Architect → oRPC Expert
```
{filled after DB Architect completes}
Tables: {list with key columns}
RLS: {summary}
Indexes: {list}
Migration: {name}
Key decisions: {1-2 lines}
```

### oRPC Expert → Backend Connector
```
{filled after oRPC Expert completes}
Procedures: {list with input/output shapes}
Router: {where wired}
Auth pattern: {context.claims fields used}
Key decisions: {1-2 lines}
```

### Backend Connector → Design Agent
```
{filled after Connector completes}
Types: {file path, key interfaces}
Hooks: {list with return types}
Page: {file path, Suspense structure}
Cache: {tier, tags}
Key decisions: {1-2 lines}
```

## Files Created
{list files created so far}

## Files Modified
{list files modified so far}

## Blockers
None

## Notes
{any relevant observations from reading the spec and skills}
