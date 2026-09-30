# Internal Tool Discovery Flow

Scoped internal tool discovery: 1 research agent, 3 personas (PM, UX, Architect — no Brand, no Analyst), 4-5 docs, 1 adversarial critic (discovery-critic only, no ux-critic). No billing, no landing page, no SEO, no brand personality.

**The flow: understand → research → confirm → discover → critic → confirm tools → deep docs.**

---

## Overview

```
Phase 0: Understand the Tool (interactive — get crystal clear before anything)
   → Clear idea brief with archetype: internal

Phase 1: Autonomous Research (1 agent — tool-scout ONLY)
   → tools.md (what APIs/services the tool needs)

Phase 2: Research Review Gate (present findings, user confirms direction)

Phase 3: Informed Discovery (3 personas — PM, UX, Architect)
   → docs/project/ (4-5 files)

Phase 3e: Discovery Critic (1 agent — structural review only, no ux-critic)
   → discovery-feedback.toon

Phase 4: Tool Validation Gate (if external tools exist — otherwise skip)

Phase 5: Deep Tool Docs (parallel agents research each tool)

Phase 6: Verify + handoff to /mvp-spec
```

---

## Phase 0: Understand the Tool (BEFORE any research)

**DO NOT research yet.** First, make sure you understand what this internal tool does.

From the user's input, assess what you know and what's unclear. You need to be confident about:

1. **What the tool does** — the core workflow it enables
2. **Who uses it** — which roles/departments
3. **What it replaces** — existing process, spreadsheet, manual workflow, or another tool
4. **What data it accesses** — internal DBs, APIs, services, third-party integrations

**If the idea is already clear:** summarize in 3-4 lines, ask "Is this right? Anything I'm missing?" — then proceed.

**If the idea is vague:** ask 2-3 focused questions:
- "What workflow does this tool automate or simplify?"
- "Who uses it day-to-day? What's their role?"
- "What do they use today? (spreadsheet, Notion, another tool, manual process?)"

**DO NOT ask more than 3 questions.**

**Once you're confident:** Write a brief to `dev/active/discovery/idea-brief.md`:
```markdown
# Idea Brief
## Archetype: internal
## What: {1-2 sentences — what the tool does}
## Who: {roles/departments that use it}
## Replaces: {current process or tool}
## Data: {what internal data/APIs it needs access to}
## Open Questions: {anything still unclear — research should answer these}
```

Then proceed to Phase 1.

---

## Phase 1: Autonomous Research (1 agent only)

Internal tools don't have a market to research. Only find the APIs/services needed.

```bash
mkdir -p dev/active/discovery/research
```

### Spawn 1 agent

**Agent: tool-scout** (`subagent_type: tool-scout`)
```
Find every external API/service this internal tool needs.

Read the idea brief: dev/active/discovery/idea-brief.md
Read the tool catalog first: .foundry/references/source-docs/tools/catalog/INDEX.md
Write your findings to: dev/active/discovery/research/tools.md

Focus on: internal data connectors, APIs the tool integrates with, any third-party services.
SKIP: Stripe, Resend (internal tools don't need billing or transactional email)
SKIP: market analysis — there is no market for an internal tool
```

**Wait for completion.**

---

## Phase 2: Review Gate (MANDATORY — NEVER SKIP)

Read research:
- `dev/active/discovery/research/tools.md`

Present a summary:

> **Research complete for: {tool name}**
>
> **Tools/APIs needed:**
> | Service | Tool | Pricing | Why |
> |---------|------|---------|-----|
> | {need} | {tool} | {cost} | {reason} |
>
> **Shall I proceed with full scoping? Or adjust anything?**

**STOP. Wait for user confirmation.**

---

## Phase 3: Informed Discovery (3 personas)

**Read these:**
1. `library/skills/discover/references/project-discovery/agents/team-roster.csv` — use PM, UX, Architect only
2. `library/skills/discover/references/project-discovery/references/question-frameworks.md`
3. `library/skills/discover/references/project-discovery/references/feature-inventory.md`
4. `library/skills/discover/references/project-discovery/references/output-templates.md`

**Known stack (never ask about):**
Supabase | Vercel | Inngest | oRPC | Next.js | Tailwind v4 | shadcn/ui

**NO Analyst** (no market to analyze). **NO Brand** (internal tools use functional UI, no brand personality).

### Phase 3a: Purpose & Users (PM)
**Lead:** PM

- Who uses this tool? (roles, departments, experience level)
- What problem does it solve internally?
- What existing tool/process does it replace?
- What data does it access? (internal DBs, APIs, services)
- What are the access rules? (who can do what, role-based)

**PM MUST produce these two CRITICAL sections early:**
1. **"System Flow"** — Plain English, numbered steps describing the internal workflow from trigger to outcome. Not user-facing narrative — the actual work process.
2. **"Access Rules"** — Exhaustive rules for who can do what. Role-based access, department restrictions, data visibility rules. For each rule, answer "what happens at the boundary?" (e.g., "non-admin tries to delete → sees 'Contact your admin' message")

Output: `product-overview.md` (adapted)
- "How It Works" → renamed "System Flow"
- "Business Rules" → renamed "Access Rules"
- NO pricing section
- NO landing page description
- Add "## Replaces" (what current tool/process this replaces)

### Phase 3b: Experience (UX)
**Lead:** UX

- Screen inventory (same format, but for internal users — they have different expectations)
- Internal users are TRAINED, not onboarded — no onboarding flow needed
- Focus on: efficiency, keyboard shortcuts, bulk actions, data density
- Internal tools can be more data-dense than consumer products

**UX MUST produce:**
1. **Screen Inventory** — Same format as SaaS, but:
   - No "empty state for first use" (users are assigned, not new)
   - Instead: "default view" (what they see day one with existing data)
   - More emphasis on power-user workflows (keyboard shortcuts, bulk select)

Output: `users-and-journeys.md` (adapted)
- NO onboarding flow section
- NO brand personality
- Personas are internal roles, not market segments
- Journeys are task-oriented workflows, not exploration

Output: `ux-patterns.md` (same format)

### Phase 3c: Scope & Architecture (PM + Architect)
**Leads:** PM + Architect

- Feature map (same format)
- Technical requirements:
  - Auth = SSO/LDAP/internal auth (NOT OAuth for public users)
  - No billing/subscription
  - Data model may need to connect to existing internal databases
- External tools (if any — many internal tools only need the stack)

Output: `feature-map.md`, `technical-requirements.md`
Output: `external-tools.md` (only if external APIs needed — skip if none)

### Phase 3d: Cross-Examination (3 personas)
**All 3, adversarial. Minimum 3 challenges.**
Review ALL docs, find gaps. Focus on: does this solve the actual workflow problem? Are access rules complete? Is the data model feasible?

**Progressive Write Protocol:** Write confirmed answers to disk IMMEDIATELY. Don't batch. Use `<!-- TBD -->` for unfilled sections.

---

## Phase 3e: Discovery Critic (single agent — NO ux-critic)

All docs are written. Spawn 1 adversarial critic to attack structural integrity.

**NO ux-critic for internal tools.** Internal tools don't have monetization, upgrade flows, or conversion funnels. The ux-critic is SaaS-only.

### Spawn 1 agent

**Agent: discovery-critic** (`subagent_type: discovery-critic`)
```
Review all discovery docs for structural integrity.

Read the idea brief: dev/active/discovery/idea-brief.md
Read ALL files in docs/project/

Attack from 3 angles: completeness, consistency, feasibility.
Note: this is an INTERNAL TOOL — no pricing, no onboarding, no brand guidelines expected.
Adapt your completeness checks: skip pricing tier checks, skip onboarding checks, skip brand voice checks.
Focus on: every feature has a screen, access rules have boundary behavior, data model supports all features.
Return structured TOON feedback.
```

**Wait for completion.**

### Process Critic Results

Write output to `dev/active/discovery/discovery-feedback.toon`.

**If verdict=PASS:** proceed to Phase 4 as normal.

**If verdict=NEEDS_REVIEW:** present findings:

> **Discovery review found {N} issues:**
>
> | # | Severity | Issue |
> |---|----------|-------|
> | 1 | HIGH | Feature "Audit Log" has no screen in Screen Inventory |
> | 2 | MEDIUM | Access rule "admin only" has no boundary behavior — what does non-admin see? |
>
> **Options:**
> 1. **Fix these before proceeding** (recommended for HIGH severity)
> 2. **Proceed anyway** — I'll address them during spec generation
> 3. **Dismiss** — these aren't real issues

---

## Phase 4: Tool Validation Gate

**If no external tools needed:** SKIP this phase entirely. Many internal tools only use the stack.

**If external tools exist:** Same as SaaS flow — present tool choices, user confirms.

Read `docs/project/external-tools.md` (if it exists).

Present the tool choices with alternatives considered, env vars needed, estimated cost.

**STOP. Wait for user confirmation.**

---

## Phase 5: Deep Tool Docs + Skill Scout (if applicable)

**Skip entirely if no external tools.**

Read `docs/project/external-tools.md` for the confirmed tool list. Run two parallel tracks:

**Track A: Tool-Scout Agents** — For each tool without docs at `docs/tools/{tool}/`, spawn tool-scout agents (up to 3 in parallel, `subagent_type: tool-scout`). Each researches one tool via Context7 + Jina and writes `docs/tools/{tool}/get-started.md` + feature docs.

**Track B: Skill Scout** — Spawn ONE `skill-scout` agent (`subagent_type: skill-scout`):
```
Scout for agent skills matching this project's external tools.

Read the confirmed tool list: docs/project/external-tools.md
Write results to: dev/active/discovery/research/skills.md

The agent definition (.foundry/agents/skill-scout.md) has the full scoring rubric,
read-via-Jina logic, install/remove decisions, and output format. Follow it exactly.
```

Wait for BOTH tracks to complete before proceeding to Phase 6.

---

## Phase 6: Verify + Handoff

### Verify docs/project/
- [ ] `product-overview.md` exists with "System Flow" and "Access Rules"
- [ ] `users-and-journeys.md` exists with personas, journeys, Screen Inventory
- [ ] `feature-map.md` exists with MVP features
- [ ] `technical-requirements.md` exists with auth=SSO/internal
- [ ] `ux-patterns.md` exists
- [ ] No `<!-- TBD -->` markers remaining

### NOT expected:
- `brand-guidelines.md` — SKIP (internal tool)
- `external-tools.md` — only if external APIs needed

### Verify docs/tools/ (if applicable)
- [ ] Every tool in `external-tools.md` has docs

### Generate Setup Manifest (MANDATORY)

Generate `setup-manifest.json` at the project root. This file drives the dashboard's dynamic setup wizard.

**Read the spec:** `references/setup-manifest-spec.md` — full schema, decision logic, and examples.

**Steps:**
1. Read `references/known-tools.json` — the pre-verified tool registry
2. Read `dev/active/discovery/idea-brief.md` → extract archetype (internal)
3. Read `docs/project/product-overview.md` → access rules, system flow
4. Read `docs/project/technical-requirements.md` → auth (SSO/internal), background jobs?
5. Read `docs/project/external-tools.md` (if it exists) → tool list

**For Internal Tools, apply these rules:**
- Supabase: **required** (always — database + auth)
- Stripe: **skip** (internal tools don't bill)
- Resend: **skip** unless email notifications explicitly mentioned in users-and-journeys.md
- Inngest: include only if background jobs listed
- Turnstile: **skip** (no public forms)
- Sentry: optional
- Each tool in `external-tools.md` (if any): match against `known-tools.json` first, use tool-scout data for unknowns

Write the manifest to `setup-manifest.json` at project root.

### Update project status
In AGENTS.md, add or update:
```markdown
## Project Status
- **Archetype**: internal
- **Discovery**: complete
- **Tool Docs**: {complete|n/a}
- **Setup Manifest**: generated
- **Setup**: not-started
- **Active Feature**: none
```

### Present to user

> **Scoping complete: {tool name}**
>
> **Type:** Internal Tool
> **Users:** {roles/departments}
> **Features:** {MVP count} MVP | {V2 count} V2
> **External tools:** {count or "none — stack only"}
> **Setup manifest:** `setup-manifest.json` generated ({step count} setup steps)
>
> **Project docs:** `docs/project/`
>
> **Next:** Open the dashboard → the setup wizard will guide you through configuring each service.
> Then: `/mvp-spec --internal` — generate specs for all features

---

## Workspace

```
dev/active/discovery/
├── idea-brief.md             (archetype: internal)
├── research/
│   └── tools.md              (tool-scout — APIs, packages, if any)
└── discovery-feedback.toon   (discovery-critic output)

docs/project/                 (4-5 files — no brand-guidelines.md)
docs/tools/{tool}/            (only if external tools exist)
```

After discovery is reviewed: `mv dev/active/discovery dev/archive/discovery`

---

## Error Recovery

**Fixable:** Tool-scout finds nothing → that's fine, many internal tools only need the stack
**Fixable:** User can't describe the workflow → ask for a screenshot of the current tool/spreadsheet
**Blocking:** No clear users identified → need to know who uses it before proceeding
