# Client Project Discovery Flow

Client deliverable discovery: 2 research agents (tool-scout + market-researcher for client's market), 4 personas (PM, UX, Brand, Architect — no Analyst), 6-7 docs, 1 adversarial critic (discovery-critic only, no ux-critic). Client's brand, client's users, handoff plan.

**The flow: understand → research → confirm → discover → critic → confirm tools → deep docs.**

---

## Overview

```
Phase 0: Understand the Client Project (interactive — get crystal clear before anything)
   → Clear idea brief with archetype: client

Phase 1: Autonomous Research (2 agents in parallel)
   → tools.md (APIs/services needed) + market.md (client's market, not ours)

Phase 2: Research Review Gate (present findings, user confirms direction)

Phase 3: Informed Discovery (4 personas — PM, UX, Brand, Architect)
   → docs/project/ (6-7 files)

Phase 3e: Discovery Critic (1 agent — structural review only, no ux-critic)
   → discovery-feedback.toon

Phase 4: Tool Validation Gate (if external tools exist — otherwise skip)

Phase 5: Deep Tool Docs (parallel agents research each tool)

Phase 6: Verify + handoff to /mvp-spec
```

---

## Phase 0: Understand the Client Project (BEFORE any research)

**DO NOT research yet.** First, understand what the client needs delivered.

From the user's input, assess what you know and what's unclear. You need to be confident about:

1. **What the deliverable is** — app, tool, dashboard, website?
2. **Who the client is** — company, industry, size
3. **Who the client's users are** — their customers, their employees, their partners?
4. **What the handoff looks like** — deploy to their infra? our hosting? code handoff?
5. **Reference or brief** — client SOW, requirements doc, reference URL

**If the project is already clear:** summarize in 3-4 lines, ask "Is this right? Anything I'm missing?" — then proceed.

**If the project is vague:** ask 2-3 focused questions:
- "What exactly is the deliverable? (web app, dashboard, tool, landing page?)"
- "Do they have a design/brand guide? Or should we define the visual direction?"
- "How is this delivered? (we deploy, they host, code handoff?)"

**DO NOT ask more than 3 questions.**

**Once you're confident:** Write a brief to `dev/active/discovery/idea-brief.md`:
```markdown
# Idea Brief
## Archetype: client
## What: {1-2 sentences — what the deliverable is}
## Client: {company name, industry, size}
## Users: {who will use the delivered product}
## Handoff: {deployment/hosting/code handoff plan}
## Reference: {client brief, SOW, or reference URL if available}
## Open Questions: {anything still unclear — research should answer these}
```

Then proceed to Phase 1.

---

## Phase 1: Autonomous Research (2 agents in parallel)

Understand the client's market (not ours) and find the tools needed.

```bash
mkdir -p dev/active/discovery/research
```

### Spawn 2 agents in parallel

**Agent 1: market-researcher** (`subagent_type: market-researcher`)
```
Research the CLIENT'S market — not ours. We're building this for them.

Read the idea brief: dev/active/discovery/idea-brief.md
Write your findings to: dev/active/discovery/research/market.md

Focus on: the client's competitors, their industry, what their users expect.
{If reference URL provided}: Read the client's current site and competitors.
This is NOT about validating OUR idea — it's about understanding THEIR market.
```

**Agent 2: tool-scout** (`subagent_type: tool-scout`)
```
Find every external API/service this project needs.

Read the idea brief: dev/active/discovery/idea-brief.md
Read the tool catalog first: .foundry/references/source-docs/tools/catalog/INDEX.md
Write your findings to: dev/active/discovery/research/tools.md

Focus on: data sources, third-party integrations the client needs.
SKIP: Stripe (unless client's users pay), Resend (unless transactional email needed)
```

**Spawn both in parallel.** Wait for both to finish.

---

## Phase 2: Review Gate (MANDATORY — NEVER SKIP)

Read all research:
- `dev/active/discovery/research/market.md`
- `dev/active/discovery/research/tools.md`

Present a summary:

> **Research complete for: {project name}**
>
> **Client's Market:**
> - {N} competitors in their space
> - What their users expect: {key expectations}
> - Industry patterns: {relevant patterns}
>
> **Tools/APIs needed:**
> | Service | Tool | Pricing | Why |
> |---------|------|---------|-----|
> | {need} | {tool} | {cost} | {reason} |
>
> **Shall I proceed with full scoping? Or adjust anything?**

**STOP. Wait for user confirmation.**

---

## Phase 3: Informed Discovery (4 personas)

**Read these:**
1. `library/skills/discover/references/project-discovery/agents/team-roster.csv` — use PM, UX, Brand, Architect
2. `library/skills/discover/references/project-discovery/references/question-frameworks.md`
3. `library/skills/discover/references/project-discovery/references/feature-inventory.md`
4. `library/skills/discover/references/project-discovery/references/output-templates.md`

**Known stack (never ask about):**
Supabase | Vercel | Inngest | oRPC | Next.js | Tailwind v4 | shadcn/ui

**NO Analyst** (we're not analyzing a market — we're building what the client asked for).

### Phase 3a: Client Requirements (PM)
**Lead:** PM

- What did the client ask for? (brief, SOW, requirements doc)
- Who are THEIR users? (not our users — the people who will use the delivered product)
- What's the timeline/budget constraint?
- What's the handoff process? (deploy to their infra? our hosting? code handoff?)
- What are the client's business rules?

**PM MUST produce these two CRITICAL sections early:**
1. **"How It Works"** — The client's user flow. Not our workflow — what THEIR users experience.
2. **"Business Rules"** — The client's business rules. What their system enforces.

Output: `product-overview.md`
- Standard "How It Works" and "Business Rules" sections
- Add: `## Handoff Plan` (deployment, hosting, access, documentation to deliver)
- Add: `## Client Constraints` (timeline, budget, tech preferences, must-use services)
- Pricing: only if the client's product charges THEIR users

### Phase 3b: Experience & Brand (UX + Brand)
**Leads:** UX + Brand

- Screen inventory (designed for the CLIENT'S users, not ours)
- Brand: use the CLIENT'S brand guidelines
  - If client provided brand assets (colors, fonts, logo): document them exactly
  - If not: ask user for the client's website URL or brand guide
  - If client has no brand: create brand-guidelines.md with references the client can approve
- Onboarding: only if the client's product needs user onboarding

**UX MUST produce Screen Inventory** — same format as SaaS.

Output: `users-and-journeys.md` (the client's users, client's onboarding if applicable)
Output: `brand-guidelines.md` (the CLIENT'S brand — colors, fonts, logo, voice)
Output: `ux-patterns.md` (same format)

### Phase 3c: Scope & Architecture (PM + Architect)
**Leads:** PM + Architect

- Feature map (same format — what the client asked for)
- Technical requirements:
  - Auth: whatever the client needs (their existing auth, or new)
  - Billing: only if the client's product charges THEIR users
  - Hosting: clarify who hosts, who maintains, what infrastructure
- External tools

Output: `feature-map.md`, `technical-requirements.md`, `external-tools.md`

### Phase 3d: Cross-Examination (4 personas)
**All 4, adversarial. Minimum 4 challenges.**
Focus on: **does this match the client's requirements?** Will they accept this deliverable? Are we building what they asked for, not what we think they should have?

**Progressive Write Protocol:** Write confirmed answers to disk IMMEDIATELY. Don't batch. Use `<!-- TBD -->` for unfilled sections.

---

## Phase 3e: Discovery Critic (single agent — NO ux-critic)

All docs are written. Spawn 1 adversarial critic to attack structural integrity.

**NO ux-critic for client projects.** Client projects don't have OUR monetization/upgrade flows. The client's billing (if any) is documented in the spec — not attacked by our conversion critic.

### Spawn 1 agent

**Agent: discovery-critic** (`subagent_type: discovery-critic`)
```
Review all discovery docs for structural integrity.

Read the idea brief: dev/active/discovery/idea-brief.md
Read ALL files in docs/project/

Attack from 3 angles: completeness, consistency, feasibility.
Note: this is a CLIENT PROJECT — check that Handoff Plan and Client Constraints exist.
Check that brand-guidelines.md reflects the CLIENT'S brand (not generic).
Focus on: every feature has a screen, business rules have boundary behavior, data model supports all features, handoff plan is complete.
Return structured TOON feedback.
```

**Wait for completion.**

### Process Critic Results

Write output to `dev/active/discovery/discovery-feedback.toon`.

**If verdict=PASS:** proceed to Phase 4.

**If verdict=NEEDS_REVIEW:** present findings:

> **Discovery review found {N} issues:**
>
> | # | Severity | Issue |
> |---|----------|-------|
> | 1 | HIGH | No Handoff Plan in product-overview.md — how is this delivered? |
> | 2 | MEDIUM | brand-guidelines.md has generic colors — should reflect client's brand |
>
> **Options:**
> 1. **Fix these before proceeding** (recommended for HIGH severity)
> 2. **Proceed anyway** — I'll address them during spec generation
> 3. **Dismiss** — these aren't real issues

---

## Phase 4: Tool Validation Gate

**If no external tools needed:** SKIP this phase.

**If external tools exist:** Same as SaaS flow — present choices, user confirms.

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
- [ ] `product-overview.md` exists with "How It Works", "Business Rules", "Handoff Plan", "Client Constraints"
- [ ] `users-and-journeys.md` exists with CLIENT'S user personas, journeys, Screen Inventory
- [ ] `brand-guidelines.md` exists with CLIENT'S brand (not generic)
- [ ] `feature-map.md` exists with MVP features
- [ ] `technical-requirements.md` exists with hosting/auth decisions
- [ ] `ux-patterns.md` exists
- [ ] No `<!-- TBD -->` markers remaining

### Verify docs/tools/ (if applicable)
- [ ] Every tool in `external-tools.md` has docs

### Generate Setup Manifest (MANDATORY)

Generate `setup-manifest.json` at the project root. This file drives the dashboard's dynamic setup wizard.

**Read the spec:** `references/setup-manifest-spec.md` — full schema, decision logic, and examples.

**Steps:**
1. Read `references/known-tools.json` — the pre-verified tool registry
2. Read `dev/active/discovery/idea-brief.md` → extract archetype (client)
3. Read `docs/project/product-overview.md` → handoff plan, client constraints, billing model
4. Read `docs/project/technical-requirements.md` → auth, hosting, background jobs?
5. Read `docs/project/external-tools.md` (if it exists) → tool list

**For Client Projects, apply these rules:**
- Supabase: **required** (always)
- Stripe: include only if the client's product charges THEIR users
- Resend: include if transactional emails needed
- Inngest: include if background jobs listed
- Turnstile: include if public-facing forms exist
- Sentry: recommended
- Each tool in `external-tools.md` (if any): match against `known-tools.json` first, use tool-scout data for unknowns

Write the manifest to `setup-manifest.json` at project root.

### Update project status
In AGENTS.md, add or update:
```markdown
## Project Status
- **Archetype**: client
- **Client**: {client name}
- **Discovery**: complete
- **Tool Docs**: {complete|n/a}
- **Setup Manifest**: generated
- **Setup**: not-started
- **Active Feature**: none
```

### Present to user

> **Scoping complete: {project name}**
>
> **Type:** Client Project for {client name}
> **Client's Users:** {who}
> **Features:** {MVP count} MVP | {V2 count} V2
> **Handoff:** {deployment plan}
> **External tools:** {count or "none — stack only"}
> **Setup manifest:** `setup-manifest.json` generated ({step count} setup steps)
>
> **Project docs:** `docs/project/`
>
> **Next:** Open the dashboard → the setup wizard will guide you through configuring each service.
> Then: `/mvp-spec --client` — generate specs for all features

---

## Workspace

```
dev/active/discovery/
├── idea-brief.md             (archetype: client)
├── research/
│   ├── market.md             (market-researcher — client's market)
│   └── tools.md              (tool-scout — APIs, packages, if any)
└── discovery-feedback.toon   (discovery-critic output)

docs/project/                 (6-7 files — includes brand-guidelines.md with client's brand)
docs/tools/{tool}/            (only if external tools exist)
```

After discovery is reviewed: `mv dev/active/discovery dev/archive/discovery`

---

## Error Recovery

**Fixable:** No client brand assets → ask for their website URL, extract colors/fonts from it
**Fixable:** Client brief is vague → ask for a call/meeting reference or written brief
**Fixable:** Unclear handoff → default to "we deploy, they get admin access" and confirm
**Blocking:** No clear client requirements → need written brief or reference before proceeding
