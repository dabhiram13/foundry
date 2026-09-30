# Step 2: Build (Catalog-Creative — Designers 3-4)

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Build a landing page from the component catalog. You are NOT cloning a template — you are composing sections from proven components.

## Read First (mandatory)

1. `.foundry/references/source-docs/patterns/landing-component-catalog.md` — the FULL catalog. Read every section.
2. `webapp/app/globals.css` — design tokens
3. The copy document from Step 1
4. Your layout brief from the orchestrator (dark/bento OR contrast/screenshots)

## Read Components You'll Use

Before building, read the actual source of every component you plan to use:
- `components/ui/bento-grid.tsx` — understand BentoGrid + BentoCard props
- `components/ui/magic-card.tsx` — understand MagicCard props
- `components/ui/blur-fade.tsx` — understand BlurFade delay/direction/inView
- `components/ui/marquee.tsx` — understand Marquee reverse/pauseOnHover
- `components/ui/animated-grid-pattern.tsx` — understand numSquares/maxOpacity
- `components/ui/dot-pattern.tsx` — understand glow prop
- `components/ui/shimmer-button.tsx` — understand shimmerColor/background
- `components/ui/light-rays.tsx` — understand count/color/speed
- `components/ui/animated-list.tsx` — understand delay
- `components/ui/animated-beam.tsx` — understand fromRef/toRef/curvature
- `components/ui/highlighter.tsx` — understand action/color/isView
- `components/ui/rainbow-button.tsx` — understand variant/size
- `components/ui/particles.tsx` — understand quantity/color/staticity
- `components/shadcn-space/blocks/hero-01/` — full hero block (header, hero, brand-slider)
- `components/ui/hero-section-with-gradient.tsx` — AnimatedGroup + gradient hero
- `components/blocks/hero-section-nexus.tsx` — RotatingText, tabs, complex patterns

Only use components you've actually read. Don't guess at APIs.

## Compose Your Page

### 1. Plan the section sequence (5-8 sections)

Pick from the catalog recipes. Example sequences:

**Designer 3 (dark/bento emphasis):**
```
1. Dark hero — Particles bg, large heading, ShimmerButton CTA
2. Brand marquee — Marquee with logos
3. Stats bento — BentoGrid with 5 cards, stat numbers as visuals
4. Dark feature showcase — rounded-3xl dark card, 3 MagicCards inside
5. Testimonials — Marquee of quote cards
6. Pricing — light bg, 3 clean cards
7. Dark CTA + Footer — rounded-3xl dark card combining CTA and footer
```

**Designer 4 (contrast/screenshots emphasis):**
```
1. Light hero — AnimatedGridPattern bg, product screenshot with gradient overlay
2. Social proof row — real integration SVGs + Marquee logos
3. Light feature grid — MagicCard grid with mockup fragments in each
4. Dark showcase card — rounded-3xl, product screenshot + feature bullets side-by-side
5. Light testimonials — clean cards with BlurFade
6. Dark pricing card — rounded-3xl, 3 tier cards
7. Light CTA — Highlighter on key phrase, ShimmerButton
8. Dark footer card — rounded-3xl, nav columns + brand
```

### 2. Build each section as a separate component

File structure:
```
webapp/features/marketing/components/v{3 or 4}/
  hero-v{N}.tsx
  brands-v{N}.tsx
  features-v{N}.tsx
  showcase-v{N}.tsx
  testimonials-v{N}.tsx
  pricing-v{N}.tsx
  cta-v{N}.tsx
```

Each component:
- `"use client"` directive
- Imports from `@/components/ui/` — the catalog components
- Imports from `lucide-react` — only for small secondary icons
- Uses BlurFade for entrance animations
- Uses design tokens only

### 3. Build the page

```
webapp/app/(marketing)/landing-v{N}/page.tsx
```

Server Component. Dynamic imports for below-fold sections. Metadata with title/description/OG.

## Section Contrast (MANDATORY)

Your page MUST have at least one dark rounded card section:

```tsx
{/* Dark card section */}
<section className="px-2 sm:px-4 lg:px-8 py-4">
  <div className="bg-foreground text-background rounded-3xl px-6 py-16 lg:px-16 lg:py-24 shadow-2xl">
    {/* Content inside uses inverted tokens */}
    <h2 className="text-3xl font-bold text-background">...</h2>
    <p className="text-background/70">...</p>
  </div>
</section>
```

The dark card has margin on the sides so you see the light background peeking through — this creates the "floating card" effect.

## Card Interior Richness (MANDATORY)

Every feature/benefit card must have 3+ visual elements. Bad:

```tsx
{/* BAD — icon + title + text = boring */}
<div className="p-6">
  <Zap className="h-8 w-8 text-primary" />
  <h3>Fast Builds</h3>
  <p>Deploy in seconds</p>
</div>
```

Good:

```tsx
{/* GOOD — stat + title + text + progress + badge = rich */}
<MagicCard className="rounded-2xl">
  <div className="p-6 space-y-4">
    <div className="flex items-center justify-between">
      <span className="text-4xl font-black">2.4s</span>
      <Badge variant="secondary">avg build time</Badge>
    </div>
    <div>
      <h3 className="text-lg font-semibold">Lightning Deploys</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Push to main and watch it go live. Zero config needed.
      </p>
    </div>
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Build</span><span>Deploy</span><span>Live</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary w-[92%]" />
      </div>
    </div>
  </div>
</MagicCard>
```

## Custom SVG Illustrations

When a section needs a visual anchor, build a simple SVG inline:

```tsx
{/* Custom illustration — abstract dashboard */}
<svg viewBox="0 0 200 120" className="w-full h-auto text-primary">
  <rect x="10" y="10" width="180" height="100" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
  <rect x="20" y="50" width="30" height="50" rx="4" fill="currentColor" opacity="0.2" />
  <rect x="55" y="35" width="30" height="65" rx="4" fill="currentColor" opacity="0.4" />
  <rect x="90" y="20" width="30" height="80" rx="4" fill="currentColor" opacity="0.6" />
  <rect x="125" y="40" width="30" height="60" rx="4" fill="currentColor" opacity="0.3" />
  <circle cx="170" cy="30" r="12" fill="currentColor" opacity="0.15" />
  <path d="M20 45 Q60 25 100 35 T180 20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
</svg>
```

20-40 lines, uses `currentColor` so it inherits from the section's text color. Adapts to light/dark mode automatically.

## Build Check

After building all sections:

```bash
npx tsc --noEmit && npm run build
```

Fix all errors. Then hand off to Step 3 (test).

## Checklist Before Done

- [ ] Page has 5-8 sections minimum
- [ ] At least 1 dark rounded card section
- [ ] No icon-in-circle as primary card visual
- [ ] Every card has 3+ visual elements
- [ ] BlurFade on all section entrances
- [ ] At least 1 Marquee or AnimatedList
- [ ] At least 1 background pattern (DotPattern, AnimatedGridPattern, Particles)
- [ ] At least 1 hover interaction (MagicCard, scale transform)
- [ ] All data is realistic (no Lorem ipsum)
- [ ] Design tokens only — no raw hex colors
- [ ] Builds clean with zero errors
