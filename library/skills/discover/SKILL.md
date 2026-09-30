---
name: discover
description: >
  Full project discovery. Archetype-aware — runs the right flow for SaaS, internal tools, or client projects.
  Produces docs/project/ + docs/tools/. Everything /mvp-spec needs.
  Use for "discover", "new project", "research idea", "scope project", "scope tool".
---

# Project Discovery — Archetype Router

You take an idea and produce EVERYTHING needed to build it. The archetype flag determines which discovery flow to run.

Arguments: `$ARGUMENTS`
- `--saas <idea>` = SaaS product (public, billing, landing page, SEO)
- `--internal <idea>` = Internal tool (team-only, SSO, no billing, no landing page)
- `--client <idea>` = Client project (built for someone else, their branding, handoff)
- `--resume` = resume from where we left off (reads archetype from idea-brief.md)
- `--tools-only` = skip discovery, just research tools from existing external-tools.md
- `--refresh` = re-research tools (update existing docs)

## Routing

**If `--resume`:** Read `dev/active/discovery/idea-brief.md`, extract `## Archetype:` line, load the matching flow.

**If `--tools-only` or `--refresh`:** These are archetype-agnostic — skip to tool docs phase. See saas-flow.md for the tool docs pipeline (same for all archetypes).

**Otherwise:** The flag is REQUIRED. If no flag is provided, ask:

> "What type of project is this?"
> 1. **SaaS** — public product with billing, landing page, SEO
> 2. **Internal tool** — team-only, SSO/auth, no billing, no public pages
> 3. **Client project** — built for someone else, their branding, delivered to them

Then route to the matching flow.

## Flow Files

| Archetype | Flow | Description |
|-----------|------|-------------|
| `--saas` | `references/saas-flow.md` | Full SaaS discovery: 4 research agents, 5 personas, 7 docs, discovery critics (discovery-critic + ux-critic), tool validation, deep tool docs |
| `--internal` | `references/internal-flow.md` | Scoped internal tool: 1 research agent, 3 personas, 4-5 docs, discovery critic only, tool docs if needed |
| `--client` | `references/client-flow.md` | Client project: 2 research agents, 4 personas, 6-7 docs, discovery critic only, tool docs, handoff plan |

**After routing:** Read the flow file and follow it exactly. The flow file IS the complete instructions.

## Shared References

All flows use these shared assets from `references/project-discovery/`:
- `library/skills/discover/references/project-discovery/agents/team-roster.csv` — persona definitions
- `library/skills/discover/references/project-discovery/references/question-frameworks.md` — question patterns
- `library/skills/discover/references/project-discovery/references/feature-inventory.md` — feature categories
- `library/skills/discover/references/project-discovery/references/output-templates.md` — doc templates

## Idea Brief

All flows write `dev/active/discovery/idea-brief.md` with an `## Archetype:` line:

```markdown
# Idea Brief
## Archetype: {saas|internal|client}
## What: {1-2 sentences}
## Who: {target user}
## Reference: {app name + URL if available}
## Angle: {what's different}
## Open Questions: {research should answer these}
```

## Critics Per Archetype

| Critic | SaaS | Internal | Client |
|--------|------|----------|--------|
| discovery-critic | yes | yes | yes |
| ux-critic | yes | no | no |

The **discovery-critic** (structural integrity) runs for ALL archetypes — every project needs complete, consistent, feasible docs.

The **ux-critic** (monetization UX, gating, upgrade flows, conversion) runs for SaaS ONLY — internal tools and client projects don't have billing/monetization/public conversion flows.

Each flow file specifies which critics to spawn at Phase 3e.
