# Onboarding Rules

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Philosophy

Onboarding is NOT a form. It's a trust-builder.

Every screen should make the user think: "they get me." The goal is not data collection — it's showing value and building confidence that this product solves their problem.

## UX Rules

### Clicks over inputs

| Good | Bad |
|------|-----|
| Single-select cards (click = answer + advance) | Text inputs for preferences |
| Avatar with skip option | Required file upload |
| Pre-filled name from auth | Empty name field |

Only 2 things should ever require typing: **name** and **custom "other" option**. Everything else is a click.

### Auto-advance on selection

When user clicks a card, that's their answer. Wait 300ms for visual feedback (card highlights), then advance to next step. No "Continue" button on selection steps.

### Show value during the flow

Each question screen should reinforce WHY they signed up:
- Welcome message that references the pain point they came to solve
- Micro-copy that hints at what they'll get ("We'll customize your dashboard based on this")
- Progress indicator showing they're almost there (goal-gradient effect)

### Keep it short

| Steps | Risk |
|-------|------|
| 3 | Ideal. Almost no drop-off |
| 5 | Acceptable if each step is one click |
| 7+ | Too many. Users leave. Cut questions. |

### Every question must earn its place

Before adding a question, answer: **"What changes in the product based on this answer?"**

| Answer changes the UI | Keep it |
|----------------------|---------|
| Filters dashboard content | Yes |
| Routes to different onboarding path | Yes |
| Personalizes empty states | Yes |
| Analytics only | **No — remove it** |
| "Nice to know" | **No — remove it** |

### Required vs skippable

- **Name**: required (only text input)
- **Avatar**: always skippable
- **Preference questions**: skippable but valuable — show a "Skip" link, not just cards

## Onboarding Gate

One check. At auth time. Not middleware. Not per-page.

```
Sign-up → always redirect to /onboarding
Sign-in → query profiles.onboarding_completed → redirect accordingly
```

No middleware DB queries. No proxy. The sign-in procedure returns the redirect target.

## Design Pattern

Typeform-style:
- Full-screen centered card (max-w-lg)
- One question per screen
- Card surface with design system shadow + gradient tint
- Progress dots at top (expanding active dot)
- Slide + fade transitions between steps (300ms)

## File Organization

```
webapp/
├── app/onboarding/
│   └── page.tsx              → Server Component (auth via proxy middleware)
└── features/onboarding/
    ├── index.ts              → Barrel export
    ├── components/
    │   ├── onboarding-flow.tsx  → Step orchestrator
    │   ├── step-name.tsx        → "What's your name?"
    │   ├── step-avatar.tsx      → "Add a photo" (skippable)
    │   ├── step-{preference}.tsx → One per preference question
    │   ├── select-card.tsx      → Reusable single-select card
    │   └── step-progress.tsx    → Progress dots
    ├── hooks/
    │   └── index.ts           → TanStack Query hooks
    ├── types/
    │   └── index.ts           → Profile + preference types
    └── constants/
        └── index.ts           → Options, labels, limits
```

## Banned Patterns

| Pattern | Why |
|---------|-----|
| Text input for preferences | Clicks only. Cards, not fields. |
| More than 5 steps | Users leave. Cut questions. |
| "Continue" button on card-select steps | Auto-advance on click. |
| Middleware onboarding check | One DB query at sign-in. That's it. |
| Questions that don't change the product | If the answer is analytics-only, remove it. |
| Required avatar upload | Always skippable. |
| No progress indicator | Goal-gradient effect — show them they're almost done. |
