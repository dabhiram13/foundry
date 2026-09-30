# Landing Page Builder

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

4 designer agents build landing page variants. 2 strategies, same copy.

## Strategy A: Clone & Adapt (Designers 1-2)

Source templates:
- `webapp/app/(marketing)/page.tsx` (current live page)
- `webapp/app/(marketing)/landing-template/page.tsx` (alternate template)
- `webapp/features/marketing/components/` (all section components)

Each designer takes ONE template and adapts it to the user's product:
- **Designer 1**: adapts `page.tsx` (current live — v2 components)
- **Designer 2**: adapts `landing-template/page.tsx`

Adaptation = swap copy, swap mockups, adjust sections. Keep the proven layout structure. These are reliable and produce good results.

## Strategy B: Catalog-Creative (Designers 3-4)

Source: `.foundry/references/source-docs/patterns/landing-component-catalog.md` + `components/ui/` + `components/blocks/` + `components/shadcn-space/`

Each designer composes a NEW layout from the proven component catalog. They MUST:
1. Read the full component catalog (`.foundry/references/source-docs/patterns/landing-component-catalog.md`)
2. Pick a section recipe combination (e.g., dark hero + bento features + light pricing + dark CTA card)
3. Build each section using ONLY catalog components (BentoGrid, MagicCard, BlurFade, Marquee, AnimatedGridPattern, etc.)
4. Follow ALL 10 mandatory rules from the catalog

Key differentiation between designers 3 and 4:
- **Designer 3**: emphasis on dark sections with bento grids and stat-heavy cards (like Content Verification / Appfittle style)
- **Designer 4**: emphasis on light/dark contrast with product screenshots and animated elements (like Swipeeely / Postiz style)

## Rules (all 4 designers)

- Design tokens only (`bg-primary`, `text-foreground`). No raw colors.
- Page root = Server Component. Each section = `"use client"`.
- No data fetching. Everything is static copy.
- Mobile-first. Responsive at 375px, 768px, 1280px.
- Both light + dark mode via semantic tokens.
- Copy comes from Step 1 — designers don't write copy, they implement it.

## The Hard Part: Detail

Generic landing pages fail because sections are too simple. Every section must reward the user for looking closely:
- Card interiors with stats, badges, progress bars, mockup fragments
- Custom inline SVG illustrations (not Lucide icons in circles)
- Staggered animations (BlurFade, AnimatedGroup)
- Hover interactions (MagicCard glow, scale transforms)
- Background textures (DotPattern, AnimatedGridPattern, Particles)
- Realistic data in all mockups (real names, real numbers)
