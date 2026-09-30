# Landing Page Workflow

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Copy-first, then 4 designers build variants in parallel. User picks a winner.

## Inputs

1. `docs/project/product-overview.md` — what the product is
2. `docs/project/users-and-journeys.md` — who we're talking to
3. `docs/project/brand-guidelines.md` — voice, tone
4. `webapp/app/globals.css` — design tokens
5. `webapp/app/(marketing)/page.tsx` — template A (current live)
6. `webapp/app/(marketing)/landing-template/page.tsx` — template B
7. `webapp/features/marketing/components/` — all section components
8. `.foundry/references/source-docs/patterns/landing-component-catalog.md` — component catalog (designers 3-4)

## Outputs

| Output | Location |
|--------|----------|
| 4 landing page variants | `webapp/app/(marketing)/landing-v{1-4}/page.tsx` |
| Variant section components | `webapp/features/marketing/components/v{1-4}/` |
| Winner (after user picks) | `webapp/app/(marketing)/page.tsx` |

---

## Steps

### Step 1: Copy (sequential, before designers)
`steps/01-copy.md`

Write ALL copy using the copywriting skill. One copy document shared by all 4 designers. Copy covers every possible section (hero, social proof, problem, solution, features, testimonials, pricing, FAQ, CTA, footer).

### Step 2: Build (4 designers in parallel)
`steps/02-build.md`

Spawn 4 designer agents simultaneously:

| Designer | Strategy | Template/Source | Route |
|----------|----------|-----------------|-------|
| 1 | Clone & Adapt | `page.tsx` (v2 components) | `landing-v1` |
| 2 | Clone & Adapt | `landing-template/page.tsx` | `landing-v2` |
| 3 | Catalog-Creative (dark/bento) | Component catalog | `landing-v3` |
| 4 | Catalog-Creative (contrast/screenshots) | Component catalog | `landing-v4` |

Designers 1-2: follow `steps/02-build.md` (clone-adapt process).
Designers 3-4: follow `steps/02-build-creative.md` (catalog-creative process).

### Step 3: Test (parallel per variant)
`steps/03-test.md`

Visual test all 4 variants at 375px, 768px, 1280px. Fix issues.

### Step 4: Pick winner (user decision)

User reviews all 4 variants. Orchestrator:
1. Renames winner route to `(marketing)/page.tsx`
2. Deletes losing variant routes
3. Cleans up unused variant components

---

## Required Skills

- `copywriting` — PAS/AIDA frameworks for Step 1
- `ui-ux-pro-max` — visual design (all 4 designers have this)

Load `marketing-psychology` only if the product needs non-obvious persuasion angles.
