# Step 1: Decide What to Ask

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

No code. Decisions only.

## Actions

### 1. Read

- `docs/project/users-and-journeys.md` — Onboarding Flow section (filled by `/discover`)
- `docs/project/users-and-journeys.md` — who the users are
- `docs/project/product-overview.md` — the problem we solve
- `docs/built/onboarding.md` — current skeleton (data model, procedures, components, hooks)

### 2. Pick questions

The skeleton has 5 steps: name → avatar → role → goal → team size.

For THIS project, decide:

| Skeleton step | Keep? | Adapt? | Replace? | Cut? |
|---------------|-------|--------|----------|------|
| Name input | Almost always keep | | | |
| Avatar upload | Keep if social/profile product | | | Cut if not needed |
| "What describes you best?" | | Change options to match this product's user types | | |
| "What's your main goal?" | | Change options to match this product's value props | | |
| "How big is your team?" | Keep if B2B | | | Cut if B2C |

### 3. Validate each question

For every question you keep: **what changes in the product based on this answer?**

If the answer is "nothing" or "analytics only" → cut it.

### 4. Write the options

For each preference question:
- Column name: `preference_{name}`
- Options: 3-4 choices (label + optional description + icon concept)
- What the answer changes: dashboard filter, empty state text, recommended features, etc.

### Output

A simple table of steps this project needs, with options and what each answer changes. Pass to Step 2.
