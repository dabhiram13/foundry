# Step 1: Brand Analysis

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Understand the product's personality and determine design direction before touching any code.

## Do

1. Read `docs/project/product-overview.md` — what is this product?
2. Read `docs/project/brand-guidelines.md` — personality, vibe, voice, any color preferences
3. Read `docs/project/users-and-journeys.md` — who uses this? Professional? Creative? Technical?

## Decide

From the brand docs, determine:

| Decision | Options | Record in decisions |
|----------|---------|-------------------|
| **Vibe** | Professional / Friendly / Technical / Playful / Bold / Minimal | Pick one primary, one secondary |
| **Color direction** | What primary hue fits the vibe? Blue=trust, Green=growth, Purple=creative, Orange=energy | Pick the hue family |
| **Layout type** | Sidebar (dashboard-heavy apps, many nav items) vs Topbar (simple apps, few nav items) | Based on feature count + product type |
| **Typography feel** | Clean sans-serif (Geist is already set) — keep or change? | Almost always keep Geist |
| **Border radius** | Current: 1.3rem (very rounded). Adjust? Sharp=professional, Round=friendly | Match the vibe |

## Output

Write decisions to `dev/active/{feature}/decisions.md` or note them for the next step.

**Pass to Step 2:**
- Primary hue direction (e.g., "blue around 245 hue in OKLCH")
- Vibe summary (e.g., "Professional but approachable, clean, trustworthy")
- Layout choice (sidebar or topbar)
- Radius preference (keep 1.3rem or adjust)

## Done when

You have a clear color direction, vibe, and layout choice. No code changes yet.
