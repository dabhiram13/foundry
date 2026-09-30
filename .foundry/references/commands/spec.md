<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: spec
description: Interactive spec creation wizard. Detects scope (backend/frontend/full-stack), researches external APIs via Jina if needed, writes a production-grade spec, pauses for review, optionally plans and builds. Works with or without prior discovery docs.
---

# Spec Wizard

You are creating a production-grade feature spec. Your job is to deeply understand what the user wants, research any external tools needed, then write a spec so good that agents can build it autonomously.

The user said: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask: "What feature do you want to build? Describe the experience."

---

## Phase 1: Context Gathering

Read these (quick — summaries only):
1. `docs/INDEX.md` — what features exist
2. Scan `docs/built/*.md` titles — read any that relate to the user's request
3. `db-schema.md` — current tables (scan, don't memorize)
4. If present: `docs/project/product-overview.md` — specifically "How It Works" and "Business Rules"
5. If present: `docs/project/users-and-journeys.md` — specifically "Screen Inventory" and "Onboarding Flow"
6. If present: `docs/project/ux-patterns.md` — error, loading, empty state defaults

If the project docs do not exist yet, that is not a blocker. Use the user request, existing built docs, and repo context instead.

Now you know the current state of the app and, when available, the product vision.

## Phase 2: Scope Detection

From the user's description, determine:

**Feature type:**
- Backend only (new API, background job, data pipeline)
- Frontend only (new page, redesign, component)
- Full-stack (new feature end-to-end)
- Algorithm/logic (complex business rules, no UI)

**Size estimate:**
- XS (1 agent, <5 files) | S (1-2 agents, <10 files) | M (2-4 agents, 10-20 files) | L (all agents, 20+ files)

**External APIs detected?**
Scan the user's description for mentions of external services, APIs, or tools (e.g., "OpenAI", "Stripe Connect", "Twilio", "Google Maps", "Resend", "SendGrid", any API name).

## Phase 3: Tool Research (if external APIs detected)

For each detected external API/tool:

1. Check if `docs/tools/{tool}/` already exists
2. If YES → read the get-started.md, note capabilities
3. If NO → research it:

Spawn an Explore agent to search for existing tool docs:
```
Check if docs/tools/{tool}/ exists. If not, check if there's a skill at library/skills/{tool}/
```

If nothing exists, spawn a research agent (using Jina MCP) to:
- Read the tool's official documentation
- Create `docs/tools/{tool}/get-started.md` (setup, auth, key concepts)
- Create `docs/tools/{tool}/{feature}.md` for each relevant API feature
- Keep docs focused on what THIS feature needs, not the entire API

**Do NOT proceed to questions until tool research is complete.** The spec needs full API knowledge.

## Phase 4: Smart Questions

Based on everything you now know (codebase state + external API capabilities + user description), ask 3-5 questions. ALL AT ONCE. Wait for answers.

**Before asking ANY question**, check if the discovery docs already answer it:
- "How It Works" in product-overview.md may already describe this feature's flow
- "Business Rules" may already define the limits and gating
- "Screen Inventory" may already describe what the user sees
- If the answer exists, PROPOSE it instead of asking: "Based on the discovery docs, this screen shows X with Y controls. Sound right?"

If those discovery docs do not exist, do not stall or ask for them. Ask only the minimum product questions needed to write a safe spec.

**Question quality rules:**
- About PRODUCT INTENT, never implementation
- Things you genuinely can't figure out from discovery docs or codebase context
- Build on what you already know — reference specific features/tables/screens that exist
- If an external API has multiple approaches, ask which one fits their vision

**Question categories:**
- **User flow**: "Walk me through what happens when..." / "What does the user see after..."
- **Scope**: "Should this include X or is that separate?" / "Do you need Y now or is that future?"
- **Business rules**: "The discovery docs say X at the boundary — is that still right?"
- **Edge cases**: "What if the external API is down?" / "What if the user has no data yet?"
- **API-specific** (if external tool): "OpenAI has streaming and non-streaming — do you want real-time generation or batch?"

**DO NOT ask about:** tech stack, database design, API shape, component library, deployment. DO NOT ask questions already answered in discovery docs.

## Phase 5: Write the Spec

Read `.foundry/PROMPT.md` for the exact format. Write the spec:

```markdown
# {Feature Name}

## System Flow Context
{If discovery docs exist: where does this feature sit in the product's "How It Works" flow?
If they do not exist: describe the local system flow from the current request and repo context.}

## The Experience

### {Flow name} — as {Persona Name}
{Storyboard-style — present tense, second person. Ground this in the How It Works flow.
What are they thinking? What do they expect to see? What would confuse them?}

### {Another flow}
...

## What The User Sees
{If Screen Inventory exists, pull from it. Otherwise derive from the request and existing UI patterns. For each screen this feature touches:}

### {Screen name}
- **Main content**: {what's on the screen}
- **Info displayed**: {specific data per item}
- **Controls**: {filters, search, sort, tabs, action buttons}
- **Key actions**: {what the user can DO}
- **Empty state**: {first-use empty vs filtered-empty}

## Business Logic
{If Business Rules exist, extract every applicable rule from them.
If they do not exist, define the required rules explicitly from the request.
For each rule, include boundary behavior:}
- {Rule}: {decision} → At boundary: {what user sees}
- {Plan/role restrictions with boundary behavior}
- {External API behavior, timeouts, fallbacks}

## Edge Cases & Error Handling

- **{Trigger}**: {what happens} -> {what user sees}
- {Cover: validation, API failures, permission denied, empty states, rate limits, concurrent actions}
- {Apply defaults from ux-patterns.md}

## User Flows (test these)

1. **{Happy path}**: {Start} -> {Action} -> {Action} -> {Expected result}
2. **{Error flow}**: {Start} -> {Bad action} -> {Expected error handling}
3. **{Boundary flow}**: {Start} -> {Hit a limit from Business Rules} -> {Expected behavior}

## UI Notes

- {Voice and tone from brand-guidelines.md}
- {Responsive behavior — what changes on mobile}
- {Loading states per ux-patterns.md when present; otherwise choose the simplest clear default}
- {Empty states per ux-patterns.md when present; otherwise use a clear empty-state CTA}
- {Error display per ux-patterns.md when present; otherwise choose the narrowest visible pattern}

## What This Step Does NOT Include

- {Explicit scope boundaries}

## Dependencies

- {Previous features required — reference docs/built/ files}

## External Services

- {Service}: {what it's used for}
- Docs: docs/tools/{service}/
```

Save to: `dev/active/{feature}/spec.md`
Create workspace: `mkdir -p dev/active/{feature}/`

## Phase 6: Review Checkpoint

Present to the user:

> **Spec ready for review:** `dev/active/{feature}/spec.md`
>
> **Scope:** {type} | Size: {XS/S/M/L} | Agents: {list}
> **External APIs:** {list or "none"}
>
> **Key decisions:**
> - {2-3 most important design decisions you made}
>
> **Options:**
> 1. **Build it** — I'll plan and start building now
> 2. **Edit first** — Tell me what to change
> 3. **Just the plan** — I'll run the planner so you can review the technical approach

Wait for the user's choice.

## Phase 7: Execute

**"Build it":**
- Git checkpoint: `git add -A && git commit -m "checkpoint: pre-{feature}"`
- Create context.md from template
- Size → plan → build → test → quality → complete (normal orchestrator flow)

**"Edit first":**
- Apply edits to spec.md
- Return to Phase 6

**"Just the plan":**
- Git checkpoint
- Spawn planner (solo for S, planning team for M/L)
- Present plan to user
- Ask: "Ready to build, or want to adjust?"
- If build → continue normal flow
- If adjust → edit plan, re-present
