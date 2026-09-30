<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: discover
description: Full project discovery for new + complex product work. Agents research your idea autonomously — market, competitors, tools, trends — then come to you already informed. Minimal questions, maximum output. Produces docs/project/ + docs/tools/.
---

# Project Discovery

Use this only when `/start` has routed the request to `new project + complex`.
Do not use this as the default intake path for every project.

Before you begin, warn the user once:

> This is the complex discovery path.
> It is research-heavy and may lead to several external tools or APIs.
> We will ask for API keys and service credentials later during `/setup`, only when each one is needed.

You take an idea and produce EVERYTHING needed to build it. First you make sure you understand the idea perfectly. Then agents do the heavy lifting — researching the market, reverse-engineering competitors, finding tools, validating demand. By the time agents talk to the user about product decisions, they already know the market.

**The flow: understand → research → confirm → discover → confirm tools → deep docs.**

Arguments: `$ARGUMENTS`
- Idea description (required unless resuming)
- `--resume` = resume from where we left off
- `--tools-only` = skip discovery, just research tools from existing external-tools.md
- `--refresh` = re-research tools (update existing docs)

If `$ARGUMENTS` is empty: ask "What are we building? Give me the idea — a reference app URL helps."

---

## Overview

```
Phase 0: Understand the Idea (interactive — get crystal clear before anything)
   → Clear idea brief that agents can research accurately

Phase 1: Autonomous Research (3 agents in parallel — NO user input needed)
   → market.md, tools.md, validation.md

Phase 2: Research Review Gate (present findings, user confirms direction)

Phase 3: Informed Discovery (5 personas, but they ALREADY KNOW the market)
   → docs/project/ (7 files) — way fewer questions because research answers most

Phase 4: Tool Validation Gate (user confirms tool choices before deep investment)

Phase 5: Deep Tool Docs (parallel agents research each tool)
   → docs/tools/{tool}/ (get-started.md + feature docs)

Phase 6: Verify + handoff to the next build flow
```

---

## Phase 0: Understand the Idea (BEFORE any research)

**DO NOT research yet.** First, make sure you understand the idea deeply enough that research agents won't go in the wrong direction. A vague idea = wasted research.

From the user's input, assess what you know and what's unclear. You need to be confident about:

1. **What the app does** — the core value proposition
2. **Who it's for** — the target user (role, context)
3. **Reference app or competitor** — at least one concrete example (URL ideal)
4. **What makes this version different** — the user's angle (optional but helpful)

**If the idea is already clear** (they gave a detailed description + reference URL): summarize what you understood in 3-4 lines, ask "Is this right? Anything I'm missing?" — then proceed.

**If the idea is vague** (just a category or one-liner): ask 2-3 focused questions to sharpen it. Examples:
- "What's the core action a user takes? What do they get out of it?"
- "Is there a specific app you've seen doing this? A URL would help my research agents nail it."
- "Who's the primary user — creators, businesses, consumers?"

**DO NOT ask more than 3 questions.** If the user can't articulate it in 3 rounds, that's fine — proceed with what you have and let the research fill gaps.

**Once you're confident:** Write a brief to `dev/active/discovery/idea-brief.md`:
```markdown
# Idea Brief
## What: {1-2 sentences — what the app does}
## Who: {target user}
## Reference: {app name + URL if available}
## Angle: {what's different about our version, if known}
## Open Questions: {anything still unclear — research should answer these}
```

Then proceed to Phase 1.

---

## Phase 1: Autonomous Research (parallel — zero user input)

The idea is clear. Now GO RESEARCH IT. Spawn 4 specialized agents in parallel.

Each agent is defined in `.foundry/agents/` with Jina and Context7 MCP access baked in.

```bash
mkdir -p dev/active/discovery/research
```

### Spawn 4 agents in parallel

**Agent 1: market-researcher** (`subagent_type: market-researcher`)
```
Research the market for this idea.

Read the idea brief: dev/active/discovery/idea-brief.md
Write your findings to: dev/active/discovery/research/market.md

{If reference URL provided}: Start by reading the reference app's landing page and pricing page.
Then find 3-5 competitors, build the feature matrix, and analyze pricing patterns.
```

**Agent 2: tool-scout** (`subagent_type: tool-scout`)
```
Find every external API/service this idea needs.

Read the idea brief: dev/active/discovery/idea-brief.md
Read the tool catalog first: .foundry/references/source-docs/tools/catalog/INDEX.md
Write your findings to: dev/active/discovery/research/tools.md

Focus on: data sources, AI/ML services, file processing, third-party integrations, scraping.
SKIP: Stripe, Resend, Inngest, Supabase — already in stack.
```

**Agent 3: trend-validator** (`subagent_type: trend-validator`)
```
Validate demand for this idea.

Read the idea brief: dev/active/discovery/idea-brief.md
Write your findings to: dev/active/discovery/research/validation.md

{If reference URL provided}: Check the reference app's traction (users, revenue, funding).
Search for market growth data, competition density, and risk signals.
```

**Agent 4: social-signal** (`subagent_type: social-signal`)
```
Find real community conversations about this idea's category.

Read the idea brief: dev/active/discovery/idea-brief.md
Write your findings to: dev/active/discovery/research/social.md

Search Reddit, ProductHunt, IndieHackers, Hacker News, and Twitter/X.
Read actual threads — extract specific quotes, complaints, and wishes.
Focus on: what people use today, what they hate, what they wish existed.
```

**Spawn all 4 in parallel.** Wait for all to finish.

---

## Phase 2: Review Gate (MANDATORY — NEVER SKIP)

Read all research:
- `dev/active/discovery/research/market.md`
- `dev/active/discovery/research/tools.md`
- `dev/active/discovery/research/validation.md`
- `dev/active/discovery/research/social.md`

Present a summary:

> **Research complete for: {idea name}**
>
> **Market:**
> - {N} competitors found — {competition level}/5
> - Gaps: {what competitors miss}
> - Recommended pricing: {pricing}
>
> **Tools needed:**
> | Service | Tool | Pricing |
> |---------|------|---------|
> | {need} | {tool} | {cost} |
>
> **Validation:**
> - Demand: {verdict}
> - Risk: {competition}/{complexity}/{monetization}
>
> **Community Signal:**
> - Top user complaints: {top 2-3}
> - Most requested features: {top 2-3}
> - Opportunity gaps: {things no tool provides}
>
> **Shall I proceed with full discovery? Or adjust anything?**

**STOP. Wait for user confirmation.** If they want changes, re-run only affected agents.

---

## Phase 3: Informed Discovery (5 personas — already armed with research)

Now run discovery — but the agents ALREADY KNOW the answers to most questions from Phase 1 research. This means:
- Analyst doesn't need to ask about competitors — they have market.md
- Architect doesn't need to ask about tools — they have tools.md
- PM can propose pricing instead of asking — they have pricing intelligence
- Questions are about the user's VISION, not facts agents can look up

**Read these:**
1. `library/skills/discover/references/project-discovery/agents/team-roster.csv` — all 5 personas
2. `library/skills/discover/references/project-discovery/references/question-frameworks.md`
3. `library/skills/discover/references/project-discovery/references/feature-inventory.md`
4. `library/skills/discover/references/project-discovery/references/output-templates.md`

**Known stack (never ask about):**
Supabase | Vercel | Stripe | Inngest | oRPC | Resend | Next.js | Tailwind v4 | shadcn/ui

**CRITICAL DIFFERENCE from the raw `references/project-discovery/` flow:** Before asking ANY question, check if the research already answers it. If it does, PROPOSE the answer instead of asking. "Based on our research, competitor X charges $29/mo and Y charges $19/mo — I'd recommend $24/mo with a generous free tier. Sound right?" is 10x better than "What should we charge?"

### Phase 3a: Product & Competition
**Leads:** PM + Analyst

PM proposes product definition based on research. Analyst presents competitor matrix.
**Questions are only about:** What the user wants that's DIFFERENT from competitors. Their unique angle. Their vision.

**PM MUST produce these two CRITICAL sections early:**
1. **"How It Works"** — Plain English, numbered steps describing the full system flow from user's first action to core value delivery. No code, no technical terms. This is the bridge between features and specs. (See `output-templates.md` for format.)
2. **"Business Rules"** — Exhaustive rules for EVERY system that has rules (credits, quotas, limits, permissions, plan gating). For each rule, answer "what happens at the boundary?" If that answer is unclear, the rule isn't done.

Scaffold ALL 7 doc files. Fill `product-overview.md` (including pricing, How It Works, Business Rules) immediately from research + user input.

### Phase 3b: Experience & Brand
**Leads:** UX + Brand | **Validates:** PM

UX proposes user journeys informed by competitor flow analysis. Brand asks about personality (this is genuinely personal — research can't answer it).
**Questions are only about:** Brand personality, visual vibe, onboarding philosophy, what makes THEIR version feel different.

**BRAND GUIDELINES — Colors & Typography Rule:**
`brand-guidelines.md` must NOT specify exact color values (no oklch, no hex) or exact font families. Instead, provide:
- **Color mood**: adjectives + references (e.g., "energetic, high-contrast, bold accents — think Linear meets Superhuman"), 2-3 mood directions to explore
- **Typography mood**: adjectives + references (e.g., "punchy headings, clean body — modern geometric or sharp grotesque"), NOT specific font names
- **What to avoid**: color/font anti-patterns (e.g., "no pastels, no corporate blue")
- **Vibe references**: 2-3 apps/brands whose visual energy matches

The actual color palette and font stack are determined during `/landing-design` — 4 designers compete with different visual identities. The winner's theme becomes the final brand colors/fonts. Locking these in at discovery kills the competition.

**UX MUST produce these two CRITICAL sections:**
1. **Screen Inventory** — For every screen in the app, describe in plain English what the user SEES. Main content, controls, key actions, empty states, who uses it. Not routes — the actual UI. Every feature in the feature map must map to at least one screen. (See `output-templates.md` for format.)
2. **Specific Onboarding** — Exact questions, exact options (for select cards), and exactly what each answer changes in the product. A spec writer should be able to build the onboarding screen from this description alone. Also: what the user sees during onboarding (trust-building moments), and where they land after.

Fill `users-and-journeys.md` (personas + flows + screen inventory + onboarding), `brand-guidelines.md`, `ux-patterns.md`.

### Phase 3c: Scope & Architecture
**Leads:** PM + Architect | **Enriches:** Analyst

PM proposes feature map from competitor matrix + research. Architect proposes data model + external tools from tools.md.
**Questions are only about:** Feature priority (MVP vs V2), any unique business logic, security model.

Fill `feature-map.md`, `technical-requirements.md`, `external-tools.md`.

### Phase 3d: Cross-Examination
**All 5, adversarial. Minimum 5 challenges.**
Review ALL docs, cross-reference with research. Find gaps, contradictions, missing features competitors all have.

**Progressive Write Protocol:** Write confirmed answers to disk IMMEDIATELY. Don't batch. Use `<!-- TBD -->` for unfilled sections.

**If `--resume`:** Read all docs in `docs/project/`, find `<!-- TBD -->` markers, resume from first gap.

---

## Phase 4: Tool Validation Gate (MANDATORY — NEVER SKIP)

The tools chosen will determine everything we build — API patterns, data shapes, rate limits, costs. The user MUST confirm before we invest in deep documentation.

Read `docs/project/external-tools.md` (finalized in Phase 3).

Present the tool choices:

> **These tools will shape the entire build. Please confirm:**
>
> | # | Need | Tool | Package | Pricing | Why this one |
> |---|------|------|---------|---------|-------------|
> | 1 | {need} | {tool} | `{package}` | {cost} | {1-line reason} |
> | 2 | ... | ... | ... | ... | ... |
>
> **Alternatives considered** (for each):
> - {tool}: {why rejected — e.g. "more expensive", "no TS SDK", "rate limits too low"}
>
> **Total additional env vars:** {count}
> **Total estimated monthly cost:** {range at expected usage}
> **Setup note:** These tools may require several API keys or service logins later. `/setup` will collect them one service at a time when we reach that phase.
>
> **Options:**
> 1. **Looks good** — proceed to deep tool documentation
> 2. **Swap a tool** — tell me which one and what you'd prefer
> 3. **I want to check one** — I'll wait while you review the tool's site
> 4. **Remove one** — we don't need that capability

**STOP. Wait for user confirmation.** If they swap or remove tools, update `external-tools.md` before proceeding. If they want to check a tool's website, give them the URL and wait.

---

## Phase 5: Deep Tool Docs (parallel)

User confirmed the tools. Now research each one deeply.

Read `docs/project/external-tools.md` for the confirmed tool list.

For each tool that doesn't already have docs at `docs/tools/{tool}/`:

Spawn tool-scout agents (up to 3 in parallel):

```
You are documenting {tool} for our project. We need these specific features:
{feature list from external-tools.md}

Our stack: Next.js 16, Supabase, oRPC, Tailwind v4, TypeScript, Inngest.

Research using:
1. Context7 MCP: resolve-library-id("{package}") → query-docs per feature
2. Jina MCP: read_url for official docs (ONLY if Context7 has gaps)

Write these files to docs/tools/{tool}/:

1. get-started.md — install, config, env vars, basic setup
2. {feature-1}.md — dedicated doc with code examples
3. {feature-2}.md — dedicated doc with code examples
... one file per feature we need

Template: library/skills/project-tool-docs/references/doc-template.md
Guidelines: library/skills/project-tool-docs/references/doc-guidelines.md

RULES:
- Every code example must be TypeScript
- Every code example must include error handling
- Server-side code uses oRPC pattern (procedures, context)
- Mark uncertain info with <!-- VERIFY: {what to check} -->
- No placeholder code — every example must be functional
```

**Parallel rules:** 3 or fewer → all at once. 4+ → batches of 3.

Also add any newly discovered tools to `.foundry/references/source-docs/tools/catalog/INDEX.md` with quick refs.

---

## Phase 6: Verify + Handoff

### Verify docs/project/
- [ ] All 7 files exist in `docs/project/`
- [ ] No `<!-- TBD -->` markers remaining
- [ ] `product-overview.md` has "How It Works" section (5-8 numbered steps, plain English)
- [ ] `product-overview.md` has "Business Rules" section (every system's rules, every boundary answered)
- [ ] Every feature in `feature-map.md` has a user journey in `users-and-journeys.md`
- [ ] Every feature in `feature-map.md` maps to at least one screen in the Screen Inventory
- [ ] Screen Inventory has plain descriptions (what user sees, controls, actions, empty states)
- [ ] Onboarding has specific questions, options, and what each answer changes
- [ ] `ux-patterns.md` fully filled

### Verify docs/tools/
- [ ] Every tool in `external-tools.md` has `docs/tools/{tool}/get-started.md`
- [ ] Each tool has feature docs for all listed needs
- [ ] No `<!-- VERIFY: -->` markers remaining (or flagged to user)

### Update project status
In AGENTS.md, add or update:
```markdown
## Project Status
- **Discovery**: complete
- **Tool Docs**: complete
- **Setup**: not-started
- **Active Feature**: none
```

### Update docs/INDEX.md
Add any new tool doc folders.

### Present to user

> **Discovery complete: {idea name}**
>
> **Product:** {one-liner}
> **Personas:** {count} defined
> **Features:** {MVP count} MVP | {V2 count} V2 | {Future count} Future
> **External tools:** {count} researched and documented
>
> | Tool | Purpose | Docs |
> |------|---------|------|
> | {tool} | {purpose} | docs/tools/{tool}/ |
>
> **Research:** `dev/active/discovery/research/`
> **Project docs:** `docs/project/`
> **Tool docs:** `docs/tools/`

### Setup Handoff (MANDATORY if external tools exist)

Read `docs/project/external-tools.md`. Extract ONLY external tool env vars — NOT standard stack keys (Supabase, Stripe, Resend, Inngest, Vercel).

Present:

> **Setup will be needed next.**
>
> | # | Tool | Env Vars Needed | Signup URL |
> |---|------|-----------------|-----------|
> | 1 | {tool} | `{ENV_VAR}` | {signup URL from external-tools.md} |
> | 2 | ... | ... | ... |
>
> I have not written any secrets yet.
> `/setup` will collect these keys one service at a time and verify them safely.

Then present:

> **Next:** `/setup` — connect accounts, collect API keys at the right time, and verify the environment
>
> After setup:
> - `/mvp-spec` to generate the roadmap
> - or `/spec` if you want to build one focused feature immediately

---

## Workspace

```
dev/active/discovery/
├── research/
│   ├── market.md         (market-researcher — competitors, pricing, gaps)
│   ├── tools.md          (tool-scout — APIs, packages, env vars)
│   ├── validation.md     (trend-validator — demand, risk, verdict)
│   └── social.md         (social-signal — Reddit, PH, IH, HN, Twitter)

docs/project/             (7 files from informed discovery)
docs/tools/{tool}/        (deep docs per external tool)
.foundry/references/source-docs/tools/catalog/       (quick refs for newly discovered tools)
```

After discovery is reviewed: `mv dev/active/discovery dev/archive/discovery`

---

## If `--tools-only`

Skip Phases 0-3. Read existing `docs/project/external-tools.md`.
Run Phase 4 (tool validation) + Phase 5 (deep docs) only.

## If `--refresh`

For each tool in `docs/project/external-tools.md`:
Re-research via Context7 + Jina, overwrite existing docs. Skip Phase 4 gate (tools already confirmed).

## Error Recovery

**Fixable:** Jina search fails → retry once, note the gap, continue
**Fixable:** Context7 has no library → fall back to Jina read_url on official docs
**Fixable:** Tool-scout finds thin results → flag at review gate, let user decide
**Fixable:** No external APIs needed → skip Phase 4 entirely, some ideas only need the stack
**Blocking:** User can't describe the idea → ask for a reference URL or competitor
