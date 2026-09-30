<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: mvp-spec
description: Batch-generate specs for all MVP features from /discover docs. Triages features (absorb/merge/split), generates specs for build phases, presents full build plan for review. Run after /discover.
---

# MVP Spec Generator

You have discovery docs. Now triage MVP features into smart build phases and generate specs.

Arguments: `$ARGUMENTS`
- No args = triage + generate specs for all MVP features
- `--review` = re-read existing specs, present for review
- `--add <feature>` = add one more feature to the MVP spec set

---

## Pre-flight Check

Verify discovery is complete:
1. `docs/project/feature-map.md` exists and has MVP features
2. `docs/project/product-overview.md` exists
3. `docs/project/external-tools.md` exists

If any missing, stop: "Run /discover first."

---

## Phase 1: Load Full Context

Read these (the entire knowledge base from /discover):

**Product knowledge:**
1. `docs/project/product-overview.md` — what the app is, pricing, **How It Works** (full system flow), **Business Rules** (exhaustive rules + boundaries)
2. `docs/project/feature-map.md` — all features with priorities
3. `docs/project/users-and-journeys.md` — personas, flows, **Screen Inventory** (what user sees on every screen), **Specific Onboarding** (exact questions/options/changes), funnels
4. `docs/project/ux-patterns.md` — error, loading, empty state decisions
5. `docs/project/brand-guidelines.md` — voice, tone, visual direction

**Architecture:**
6. `docs/project/technical-requirements.md` — data model, real-time, background jobs
7. `docs/project/external-tools.md` — external APIs + which features use them
8. `db-schema.md` — current tables

**Tool docs (for features that use external APIs):**
For each tool in `external-tools.md`, read:
- `docs/tools/{tool}/get-started.md` + feature docs

Now you know EVERYTHING.

---

## Phase 2: Feature Triage (THE CRITICAL STEP)

Do NOT map feature-map items 1:1 to build steps. Triage every MVP feature.

### Step A: Classify Every Feature

For each feature in `feature-map.md` MVP section, assign ONE classification:

| Classification | Meaning | How to spot it |
|---------------|---------|---------------|
| **Absorbed** | Cross-cutting concern or built-in tech stack capability. Not a step — folded into features that use it. | Ask: "Is this a capability of the framework/stack, or a UI pattern that lives inside another page?" If yes → absorbed. |
| **Intensive** | Complex: heavy logic, external API integration, background jobs, or algorithm work. NEVER merge with another intensive. Gets its own dedicated step. | Ask: "Does this involve a non-trivial algorithm, a background job, or deep integration with an external API?" If yes → intensive. |
| **Standard** | Normal feature, clear scope. Can merge with related features if they share the same area. | Most CRUD features, pages with forms, lists, and actions. The bread and butter. |
| **Lightweight** | Too simple for a standalone step. Merge into the nearest related feature. | Ask: "Could an agent finish this in under 30 minutes as a side task?" If yes → lightweight. Static pages, simple CRUD sub-screens, minor UI additions. |

### Step B: Build Phases from Triage

Apply these rules to create BUILD PHASES (not a list of features):

**Absorb rules — NEVER standalone steps:**
Things that are baked into the tech stack or are UI patterns within other pages:
- Theming / dark mode → Design System (Tailwind + shadcn = toggle + ThemeProvider, not a feature)
- Responsive design → EVERY feature (Tailwind is mobile-first — it's how we build, not what we build)
- Search & filters within a page → the feature that owns that page (search is a UI pattern, not a feature)
- Static error/status pages → App Shell / Layout (a few static pages, done in minutes)
- Any feature the framework already provides out of the box (check tech stack capabilities)

**Merge rules:**
- Lightweight features get absorbed into the nearest related Standard feature
- Features that touch the same screens/pages merge (a list page + search/filter/sort within that list = one phase)
- Features that share a new DB table go in the same phase (creator creates it, consumer uses it)
- Features that represent different views of the same data merge (e.g., "view X" + "manage X" + "export X")

**Split rules:**
- NEVER merge two Intensive features — each gets its own step
- If a Standard feature touches 3+ external APIs, consider splitting
- If a merged phase would exceed ~25 files changed, split it
- If a feature has both a complex backend job AND a complex UI, consider splitting into backend + frontend phases

**Result:** Each build phase has:
- A clear name describing the deliverable
- Which feature-map items it covers (by ID)
- Why they're grouped (or isolated)
- Estimated complexity (XS/S/M/L)

### Step C: Present Triage for Approval

Show the user:

> **Feature Triage: {N} features → {M} build phases**
>
> **Absorbed (not standalone steps):**
> | Feature | Absorbed Into | Why |
> |---------|--------------|-----|
> | {feature} | {phase} | {reason} |
>
> **Intensive (dedicated steps — never merged):**
> | Feature | Why Isolated |
> |---------|-------------|
> | {feature} | {reason} |
>
> **Merged phases:**
> | Phase Name | Contains (IDs) | Why Together |
> |-----------|---------------|-------------|
> | {name} | {feature IDs} | {reason} |
>
> Does this grouping make sense? Want to adjust?

**STOP. Wait for user approval before generating specs.**

---

## Phase 3: Determine Build Order

The build order has TWO parts: a fixed foundation (same for EVERY SaaS) and product-specific phases (from triage).

### Foundation (ALWAYS these 7 steps, ALWAYS this order, NEVER skip any)

| # | Step | Executes via | What the spec describes |
|---|------|-------------|------------------------|
| 1 | Design System + Landing Page | `/landing-design` command | One-sentence: delegates to the command |
| 2 | Logo | `/logo` command | One-sentence: delegates to the command |
| 3 | Auth | `.foundry/workflows/auth/` workflow | What THIS SaaS needs: OAuth providers, verification method, special claims, role types |
| 4 | Onboarding | `.foundry/workflows/onboarding/` workflow | What THIS SaaS needs: exact steps/questions from users-and-journeys.md, what each changes |
| 5 | Billing | `.foundry/workflows/billing/` workflow | What THIS SaaS needs: plan tiers, pricing, limits, credit system if any |
| 6 | Legal | `.foundry/workflows/legal/` workflow | What THIS SaaS needs: specific terms, privacy considerations, compliance needs |
| 7 | Settings | `/settings` command | One-sentence: delegates to the command |
| — | Mid-Build Checkpoint | — | User reviews the running foundation before product features |

### Product-specific phases (from triage)

After the foundation, the MERGED phases from triage Step B. Order by dependencies:

```
8+ — product-specific phases, parallel where possible
N  — Final Review (always last)
```

**Rules for product-specific ordering:**
- Features using the same external API can be parallel (API is stateless)
- Features sharing a new DB table must be sequential (first one creates it)
- Features gated by plan tier depend on billing (already done in foundation)
- Group truly independent phases for parallel execution

---

## Phase 4: Generate Specs

### Foundation steps 1, 2, 7 — command-delegated (one-sentence specs)

These commands handle everything internally. The spec is just a pointer:

- `steps/01-design-system-landing-page.md`: `Execute /landing-design — 4 design team agents compete, user picks the winner live.` + mandatory footer
- `steps/02-logo.md`: `Execute /logo — generates 6 SVG logo concepts, user picks at /logos.` + mandatory footer
- `steps/07-settings.md`: `Execute /settings — adaptive settings page discovery + build.` + mandatory footer

**Every step file (including these) MUST end with the Mandatory Roadmap Update footer (see below).**

### Foundation steps 3-6 — workflow-backed (spec describes THIS SaaS's needs)

These use existing workflows at `.foundry/workflows/{name}/` — no need to read them. The workflows know HOW to build. The spec's job is to describe WHAT this specific SaaS needs. Write a spec for each:

- `steps/03-auth.md`: Workflow: `.foundry/workflows/auth/`. Spec describes: OAuth providers needed, email verification method, custom JWT claims, role types, any special auth rules from product-overview.md Business Rules.
- `steps/04-onboarding.md`: Workflow: `.foundry/workflows/onboarding/`. Spec describes: exact onboarding steps pulled from users-and-journeys.md "Onboarding Flow" (questions, options, what each changes), where user lands after, background jobs triggered.
- `steps/05-billing.md`: Workflow: `.foundry/workflows/billing/`. Spec describes: plan tiers + pricing from product-overview.md, per-plan limits, credit/usage system if any, what happens at plan boundaries.
- `steps/06-legal.md`: Workflow: `.foundry/workflows/legal/`. Spec describes: product-specific legal considerations, data handling, third-party services used, refund/cancellation policies from Business Rules.

Each spec follows this format:

```markdown
# {Step Name}

## Workflow
`.foundry/workflows/{name}/`

## What This SaaS Needs
{Product-specific requirements pulled from discovery docs. NOT generic — specific to THIS product.}

## Business Rules
{EVERY rule from product-overview.md that applies to this step, with boundary behavior.}

## Edge Function Deployment
If this workflow creates or modifies ANY files under `supabase/functions/`, the agent that makes the change MUST deploy immediately after — not later, not deferred to another agent. Run: `npx supabase functions deploy <function-name> --no-verify-jwt --project-ref <project-ref>`. This applies to ANY agent (db-architect, backend, connector, etc.). No exceptions.

## Dependencies
{Prior steps}

## MANDATORY: Update Roadmap
After this step is complete, you MUST update `roadmap.json` — set this feature's status from `in-progress` to `done`. This is NOT optional. The orchestrator depends on roadmap.json to track progress.
```

### Final Review — fixed template

- `steps/{NN}-final-review.md`: `Non-code review — AI checks completeness, coherence, v2 gap analysis, tech debt, recommendations.`

### Product-specific phases — spec-writer agents

For each product phase, spawn a spec-writer agent. Up to 3 in parallel for independent phases.

```
You are writing a feature spec for: {phase name}
This phase covers feature-map items: {list of IDs and names}

PHASE: {description of what this phase delivers}
BUILD ORDER: #{N} of {total} — depends on: {list of prior phases}
PERSONAS: {which personas use these features}

READ THESE FOR CONTEXT:
- docs/project/product-overview.md — specifically:
  - "How It Works" — which step(s) this phase covers
  - "Business Rules" — EVERY rule that applies, including boundary behavior
  - "Pricing" — plan/tier restrictions
- docs/project/users-and-journeys.md — specifically:
  - "Screen Inventory" — screens for these features
  - "Personas" — goals and pain points
  - "Journeys" — where these features appear
- docs/project/ux-patterns.md (error/loading/empty defaults)
- docs/project/technical-requirements.md (data model)
- docs/project/brand-guidelines.md (voice for copy)
- db-schema.md (existing tables)
{IF external API: - docs/tools/{tool}/get-started.md + feature docs}

WRITE spec to: steps/{NN}-{phase-slug}.md

USE THIS FORMAT:

# {Phase Name}

## Covers
{List which feature-map items this phase delivers, by ID and name}

## System Flow Context
{Where does this phase sit in the "How It Works" flow?}

## The Experience
### {Flow name} — as {Persona Name}
{Storyboard-style — present tense, second person.
If multiple personas use differently, separate flow per persona.
Ground in How It Works — don't invent a new narrative.}

## What The User Sees
{Pull from Screen Inventory. For each screen:}

### {Screen name}
- **Main content**: {what's on the screen}
- **Info displayed**: {specific data per item}
- **Controls**: {filters, search, sort, tabs, actions}
- **Key actions**: {what user can DO}
- **Empty state**: {first-use vs filtered-empty}

## Business Rules
{EVERY rule from product-overview.md that applies. Don't summarize.}
- {Rule}: {decision} → At boundary: {what user sees}

## Edge Cases & Error Handling
- {From ux-patterns.md defaults + feature-specific}
- {External API failures if applicable}

## User Flows (test these)
1. **{Happy path}**: {Start} -> {Action} -> {Result}
2. **{Error flow}**: {Start} -> {Bad action} -> {Error handling}
3. **{Boundary flow}**: {Start} -> {Hit limit} -> {Behavior}

## UI Notes
- {Voice/tone from brand-guidelines.md}
- {Loading states per ux-patterns.md}
- {Empty states per ux-patterns.md}
- {Error display per ux-patterns.md}

## Scale Profile
- Items at launch: {estimated count}
- Items at 1K users: {estimated count}
- Items at 10K users: {estimated count}
- Processing pattern: {one-shot | batch-sequential | fan-out | stream}
- External API calls per item: {N calls x N pages/endpoints}
- Estimated wall time at 10K scale: {N items x M calls x Xms = total}
- Verdict: {sequential OK (<60s total) | fan-out required (orchestrator + worker) | batch-fan-out required (batch workers, 10 items each)}
- Data ephemerality: {any API responses with expiring URLs/tokens? Must-persist fields from tool-scout Data Characteristics}

## What This Phase Does NOT Include
- {Scope boundaries}

## Dependencies
- {Prior phases in build order}

## External Services
- {Tool}: {what it's used for}
- Docs: docs/tools/{tool}/

---

## MANDATORY: Update Roadmap
After this step is complete, you MUST update `roadmap.json` — set this feature's `"status"` from `"in-progress"` to `"done"`. This is NOT optional. The orchestrator depends on `roadmap.json` to track progress across sessions. If you skip this, the next `/mvp-build` run will re-attempt this feature instead of moving forward.

RULES:
- Spec must be buildable by agents who only read THIS file + referenced docs
- Use product language, not code language
- "What The User Sees" MUST come from Screen Inventory
- "Business Rules" MUST list every applicable rule with boundary behavior
- Edge cases must cover API-specific failures if external tools are involved
- Include plan/tier gating if pricing restricts features in this phase
- Include a boundary flow for every business rule with a limit
- MUST include the Mandatory Roadmap Update footer at the end of the spec
- "Scale Profile" is MANDATORY for any phase with external API calls, background jobs, or batch processing. Do the math: items x calls x latency = wall time. If >60s at 10K scale, verdict MUST be fan-out.
- Check tool-scout's "Data Characteristics" section for every external API used — if any fields are ephemeral (expiring URLs, temp tokens), document them in Scale Profile and note they must be persisted during processing
```

**Parallel rules:** 3 or fewer independent → all at once. More → batches of 3.

### Mandatory Roadmap Update Footer (ALL specs)

**EVERY spec file** — command-delegated, workflow-backed, AND product-specific — MUST end with this exact footer:

```markdown
---

## MANDATORY: Update Roadmap
After this step is complete, you MUST update `roadmap.json` — set this feature's `"status"` from `"in-progress"` to `"done"`. This is NOT optional. The orchestrator depends on `roadmap.json` to track progress across sessions. If you skip this, the next `/mvp-build` run will re-attempt this feature instead of moving forward.
```

This ensures that no matter which agent or command executes the step, `roadmap.json` always gets updated.

---

## Phase 5: Review Gate (MANDATORY)

Present the full build plan:

> **MVP Build Plan: {M} phases ({N} features)**
>
> | # | Phase | Covers | Size | APIs | Depends On | Spec |
> |---|-------|--------|------|------|------------|------|
> | 1 | Design System + Landing Page | {absorbed IDs} | L | — | — | `steps/01-...` |
> | 2 | Logo | — | S | — | #1 | `steps/02-...` |
> | 3 | Auth | {auth ID} | M | — | #2 | `steps/03-...` |
> | 4 | Onboarding | {onboarding ID} | M | — | #3 | `steps/04-...` |
> | 5 | Billing | {billing ID} | M | — | #3 | `steps/05-...` |
> | 6 | Legal | — | S | — | #5 | `steps/06-...` |
> | 7 | Settings | {settings ID} | M | — | #4,#5,#6 | `steps/07-...` |
> | — | Mid-Build Checkpoint | — | — | — | #7 | — |
> | 8+ | {Product phases from triage} | {IDs} | {size} | {APIs} | {deps} | `steps/{NN}-...` |
> | N | Final Review | — | — | — | all | `steps/{NN}-...` |
>
> **Build order:**
> ```
> #1 → #2 → #3 → ... → #7 → Checkpoint → [#8 | #9] (parallel) → ... → #N Final Review
> ```
>
> **Options:**
> 1. **Walk me through** — review each spec one by one
> 2. **Edit one** — tell me which to change
> 3. **Reorder** — change build sequence
> 4. **Drop one** — move to V2
> 5. **Looks good** — generate roadmap.json

**STOP. Wait for user.**

---

## Phase 6: Handle User Choice

**"Walk me through":** Show each spec: title, summary, key flows, size. User approves or edits.

**"Edit one":** Apply edits, re-present.

**"Reorder":** Update order, rename files, update dependencies.

**"Drop one":** Move to V2 in feature-map.md, delete step file.

**"Looks good":** Generate roadmap.json.

---

## Phase 7: Generate roadmap.json

After approval, write `roadmap.json` to project root.

**IMPORTANT: Inject a mid-build checkpoint after foundation features (design, auth, onboarding, billing, legal, settings).** Non-code step where user reviews the running app before product-specific phases.

```json
{
  "generated": "{ISO date}",
  "features": [
    {
      "order": 1,
      "id": "design-system-landing-page",
      "name": "Design System + Landing Page",
      "type": "landing-design",
      "covers": ["{absorbed feature IDs}"],
      "status": "pending",
      "spec": "steps/01-design-system-landing-page.md",
      "size": "L",
      "depends_on": []
    },
    {
      "order": 2,
      "id": "logo",
      "name": "Logo",
      "type": "logo",
      "status": "pending",
      "spec": "steps/02-logo.md",
      "size": "S",
      "depends_on": ["design-system-landing-page"]
    },
    {
      "order": 3,
      "id": "auth",
      "name": "Auth",
      "type": "workflow",
      "workflow": ".foundry/workflows/auth/",
      "status": "pending",
      "spec": "steps/03-auth.md",
      "size": "M",
      "depends_on": ["logo"]
    },
    {
      "order": 4,
      "id": "onboarding",
      "name": "Onboarding",
      "type": "workflow",
      "workflow": ".foundry/workflows/onboarding/",
      "status": "pending",
      "spec": "steps/04-onboarding.md",
      "size": "M",
      "depends_on": ["auth"]
    },
    {
      "order": 5,
      "id": "billing",
      "name": "Billing",
      "type": "workflow",
      "workflow": ".foundry/workflows/billing/",
      "status": "pending",
      "spec": "steps/05-billing.md",
      "size": "M",
      "depends_on": ["auth"]
    },
    {
      "order": 6,
      "id": "legal",
      "name": "Legal",
      "type": "workflow",
      "workflow": ".foundry/workflows/legal/",
      "status": "pending",
      "spec": "steps/06-legal.md",
      "size": "S",
      "depends_on": ["billing"]
    },
    {
      "order": 7,
      "id": "settings",
      "name": "Settings",
      "type": "settings",
      "status": "pending",
      "spec": "steps/07-settings.md",
      "size": "M",
      "depends_on": ["onboarding", "billing", "legal"]
    },
    {
      "order": 8,
      "id": "mid-build-checkpoint",
      "name": "Mid-Build Checkpoint",
      "type": "checkpoint",
      "status": "pending",
      "spec": null,
      "size": "-",
      "depends_on": ["settings"]
    },
    {
      "order": 9,
      "id": "{phase-slug}",
      "name": "{Phase Name}",
      "covers": ["{feature IDs}"],
      "status": "pending",
      "spec": "steps/09-{phase-slug}.md",
      "size": "{XS/S/M/L}",
      "depends_on": ["mid-build-checkpoint"]
    },
    {
      "order": "N (last)",
      "id": "final-review",
      "name": "Final Review",
      "type": "final-review",
      "status": "pending",
      "spec": "steps/{NN}-final-review.md",
      "size": "-",
      "depends_on": ["all previous"]
    }
  ]
}
```

The `"covers"` field tracks which feature-map IDs each phase delivers. This is how `/mvp-build` knows what's been built.

Special entry types:
- `"type": "landing-design"` — `/mvp-build` executes `/landing-design`
- `"type": "logo"` — `/mvp-build` executes `/logo`
- `"type": "workflow"` — `/mvp-build` reads `"workflow"` field, runs that workflow. The step spec describes what THIS SaaS needs.
- `"type": "settings"` — `/mvp-build` executes `/settings`
- `"type": "checkpoint"` — `/mvp-build` runs interactive review (no code)
- `"type": "final-review"` — `/mvp-build` reviews everything vs v2/future
- No `"type"` field — standard orchestrator flow (product-specific phases)

**Status values:** `pending` | `in-progress` | `done` | `skipped`

### External Tool API Key Check

Before presenting the roadmap, check if external tools need API keys.

1. Read `docs/project/external-tools.md` — extract all env vars listed
2. Read `webapp/.env` (if it exists)
3. For each external tool env var, check if it exists and has a non-empty value in `.env`

**Skip this check if:** no external tools exist, or `external-tools.md` has no env vars.
**Only check external tool keys** — NOT standard stack keys (Supabase, Stripe, Resend, Inngest, Vercel).

If any keys are missing or empty:
1. For each missing env var, append `{ENV_VAR}=` to `webapp/.env` (don't overwrite existing values)
2. Append to the roadmap presentation:

> **Missing API keys for external tools:**
>
> | Tool | Env Var | Signup URL | Needed by Phase |
> |------|---------|-----------|----------------|
> | {tool} | `{ENV_VAR}` | {signup URL} | #{N} {phase name} |
>
> Empty entries added to `webapp/.env`. Go to **localhost:4000/settings/env** to set the values before those phases start.

If all keys are present: no message needed, proceed silently.

---

Then present:

> **Roadmap ready!** `roadmap.json` + `steps/` ({M} phase specs)
>
> Run `/mvp-build` to start. It picks up the next phase automatically.
> Each phase = one session. Run `/mvp-build` again for the next.
>
> Mid-build checkpoint after foundation — you'll review before product features start.

---

## If `--review`

Read all `steps/*.md` + `roadmap.json`. Cross-reference with feature-map.md.
Present the Phase 5 review table. Flag any MVP features not covered by any phase.

## If `--add <feature>`

1. Read existing specs + roadmap
2. Triage the new feature (absorb/merge/split)
3. Either add to existing phase or create new one
4. Update roadmap.json
5. Present updated plan

---

## Error Recovery

**Fixable:** Discovery docs have `<!-- TBD -->` markers → warn user, spec around the gap
**Fixable:** Feature description too vague → ask user to clarify that one feature
**Fixable:** External tool docs missing → spawn tool-scout for that tool first
**Blocking:** No feature-map.md → "Run /discover first"
