<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: landing-design
description: Landing page design competition — four designer teammates, four routes, four strategies; you pick the winner live.
---

# /landing-design — Landing Page Design Competition

4 designer teammates, 4 routes, 4 distinct strategies. User picks the winner live.

---

## Orchestration Flow

### Phase 1: Load Full Product Context

Read everything. The designers need to KNOW this product inside out:

```
docs/project/product-overview.md          — what the app does, pricing, positioning
docs/project/users-and-journeys.md        — personas, pain points, who we're selling to
docs/project/brand-guidelines.md          — voice, tone, personality
docs/project/feature-map.md              — key features (for feature cards)
dev/active/discovery/research/market.md   — competitors, what the market looks like
webapp/app/globals.css                    — current design tokens
```

Synthesize into a **context brief** — a dense paragraph covering: what the product is, who it's for, what pain it solves, pricing model, brand personality, top 3 value propositions, and the primary CTA. Save to `dev/active/landing-design/context-brief.md`.

**CRITICAL — Visual Identity is OPEN for Exploration:**
`brand-guidelines.md` provides personality, voice, mood, and vibe references — but NOT locked-in colors or fonts. Each designer MUST create their own unique color palette and font stack. If brand-guidelines.md happens to contain specific color values or font names, designers should treat them as ONE possible direction, not a mandate. The whole point of this competition is to explore different visual identities — same product, different themes. The winning direction's palette + fonts become the brand's final visual identity.

### Phase 2: Read the Current Template + Design System

Read the existing landing page and the full design system toolkit:

```
webapp/app/(marketing)/page.tsx                    — current page structure
webapp/features/marketing/components/              — ALL section components
.foundry/references/source-docs/patterns/landing/design-system.md             — cinematic design system (sections, micro-interactions, animations)
.foundry/references/source-docs/patterns/landing/preset-generator.md          — how to generate design presets
.foundry/references/source-docs/patterns/landing/catalog-creative-recipes.md  — proven recipes (dark sections, bento grids, terminals, stats)
.foundry/references/source-docs/patterns/frontend/component-catalog.md        — available components + interactions
.foundry/references/source-docs/patterns/frontend/svg-illustrations.md        — SVG illustration patterns (MANDATORY reading)
.foundry/workflows/landing-page/steps/01-copy.md    — copy writing process
```

### Phase 3: Create Design Team & Spawn 4 Designers

```
TeamCreate("landing-design")
```

Spawn all 4 as **general-purpose teammates** — do NOT set `subagent_type`. No agent definition. Each teammate gets a clean slate and follows ONLY the prompt below. The designer agent (`.foundry/agents/designer.md`) is for feature UI work and would add conflicting noise about connectors, specs, and pipelines.

**Every teammate gets the SAME full product context.** The difference is their strategy and creative brief.

**File structure per direction:**

```
webapp/app/(landing-design)/                  — NEW route group, NO shared header
  layout.tsx                                  — bare layout: just <div>{children}</div>
  landing-v1/page.tsx                         — Direction 1 (includes its OWN header inline)
  landing-v2/page.tsx                         — Direction 2 (includes its OWN header inline)
  landing-v3/page.tsx                         — Direction 3 (includes its OWN header inline)
  landing-v4/page.tsx                         — Direction 4 (includes its OWN header inline)

webapp/features/marketing/components/v1/     — Direction 1 components (including header)
webapp/features/marketing/components/v2/     — Direction 2 components (including header)
webapp/features/marketing/components/v3/     — Direction 3 components (including header)
webapp/features/marketing/components/v4/     — Direction 4 components (including header)
```

**WHY `(landing-design)` not `(marketing)`:** The `(marketing)/layout.tsx` adds a shared `<Header />`. Variants placed under it would all inherit that header, killing design freedom. The `(landing-design)` route group has a bare layout — each variant renders its OWN header as part of its unique design (different logo, nav items, CTAs, sticky behavior, etc.).

**The orchestrator must create** `webapp/app/(landing-design)/layout.tsx` before spawning designers:
```tsx
export default function LandingDesignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Each designer works ONLY in their `v{N}/` folder and `landing-v{N}/page.tsx`. No conflicts.

---

#### Direction 1 — "Template Adaptation" (the safe bet)

```
You are adapting our existing landing page template to a new product.

## The Product
{full context brief}

## Your Job
Read the current landing page code:
- webapp/app/(marketing)/page.tsx
- webapp/features/marketing/components/ (every file in the ROOT — not v1-v4 folders)

Keep the EXACT same section structure, component architecture, and animation patterns.
Build your version in webapp/features/marketing/components/v1/ and webapp/app/(landing-design)/landing-v1/page.tsx.

Read `.foundry/references/source-docs/patterns/frontend/svg-illustrations.md` — you MUST use SVG illustrations for feature cards and bento backgrounds, NOT Lucide icons with colored backgrounds.

Change ONLY:
- All copy (headlines, descriptions, CTAs, FAQ, testimonials) — rewrite for THIS product
- Color palette — invent YOUR OWN unique palette that fits the product's mood (scoped to your components via CSS variables). Do NOT copy colors from brand-guidelines.md or globals.css — create something fresh.
- Hero content — adapt to this product's value proposition
- Feature cards — swap in this product's features, with unique SVG illustration per card
- Pricing — match this product's pricing model (or remove if none)
- Social proof — relevant to this product's audience

## Skills to Load
- `landing-page-copywriter` — write copy using PAS framework (Problem-Agitate-Solution)
- `humanizer` — run ALL copy through this. No AI-sounding text.

## Copy Process
1. Write all copy section by section
2. Run through humanizer: "What makes this obviously AI generated?" → fix → final
3. Copy must reflect the brand voice, not generic marketing speak

## globals.css Rule
Do NOT modify globals.css. Create a theme.css in your v1/ folder imported by your page.
Use CSS custom properties scoped to a wrapper class (.landing-v1) for any color overrides.
Your page.tsx must wrap all content: `<div className="landing-v1">...</div>`
Your page.tsx must import the theme: `import './theme.css'` (or `import '../components/v1/theme.css'`)

theme.css MUST have BOTH light and dark sections (mirrors globals.css structure):
```css
/* Light mode */
.landing-v1 {
  --primary: oklch(/* your light value */);
  --primary-foreground: oklch(/* ... */);
  --background: oklch(/* ... */);
  --foreground: oklch(/* ... */);
  /* ... all tokens you want to override */
}

/* Dark mode — MANDATORY, do not skip */
.dark .landing-v1 {
  --primary: oklch(/* your dark value */);
  --primary-foreground: oklch(/* ... */);
  --background: oklch(/* ... */);
  --foreground: oklch(/* ... */);
  /* ... matching overrides for dark */
}
```

ONLY override oklch VALUES for these variables:
--background, --foreground, --card, --card-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --success, --warning, --border, --input, --ring, --primary-gradient-from, --primary-gradient-to, --card-gradient-from, --card-gradient-to, --card-border-tint, --chart-1 through --chart-5, --radius, --shadow-*

Same variable NAMES as globals.css, different VALUES. Both modes. No exceptions.

## Quality
- npx tsc --noEmit — must pass
- Mobile responsive: 375px, 768px, 1280px
- No --overwrite when installing shadcn components
- Design tokens only, no raw colors (text-red-500 etc)
- SVG illustrations MANDATORY for feature cards and bento backgrounds — NO Lucide icons with colored background circles
- Card consistency: all cards in a section must have equal height and identical sub-component positioning (title, description, CTA at same Y across cards)
```

---

#### Direction 2 — "Design System — Preset A" (cinematic, bold)

This designer follows the full cinematic design system and generates a bold, high-energy preset.

```
You are a cinematic landing page designer building a page that follows our design system precisely.

## The Product
{full context brief}

## Your Strategy
You follow the cinematic design system to the letter. Your job is to show what the system produces when pushed toward BOLD, HIGH-ENERGY execution — dramatic contrasts, dense sections, strong motion.

Build in webapp/features/marketing/components/v2/ and webapp/app/(landing-design)/landing-v2/page.tsx.

## Required Reading (read ALL before writing any code)
1. `.foundry/references/source-docs/patterns/landing/design-system.md` — the full system: section architecture, micro-interactions, animation specs, interaction patterns. Follow this exactly.
2. `.foundry/references/source-docs/patterns/landing/preset-generator.md` — generate YOUR preset following this format. Your preset identity should lean BOLD: think dark-dominant palettes, tight typography, high motion intensity, particle/dot backgrounds, stat-heavy sections.
3. `.foundry/references/source-docs/patterns/landing/catalog-creative-recipes.md` — proven recipes. You MUST use at least: dark rounded card sections (Recipe 1), BentoGrid with SVG illustrations (Recipe 2). Lean into the "Designer 3" column (dark/bento, stat-heavy, particle backgrounds, bold, dense, data-driven).
4. `.foundry/references/source-docs/patterns/frontend/svg-illustrations.md` — MANDATORY for all feature cards and bento backgrounds.
5. `.foundry/references/source-docs/patterns/frontend/component-catalog.md` — available components and variations.

## Preset Generation
Before writing ANY code, generate your complete preset following preset-generator.md:
- Identity: bold, high-energy — think "data war room", "mission control at midnight", "the backend of the future"
- Palette: dark-dominant, high-contrast accent colors, dramatic gradients. Invent YOUR OWN unique colors — do NOT reuse colors from brand-guidelines.md or globals.css.
- Typography: tight tracking, heavy weight contrast between headings and body. Pick YOUR OWN distinctive font pairing — do NOT default to Inter or fonts from brand-guidelines.md.
- Motion: high intensity — staggered reveals, scroll-triggered animations, magnetic buttons
- Section rhythm: dense — more sections with rich content, stat counters, animated terminals

Write your preset to `dev/active/landing-design/preset-v2.md` before building.

## Build Every Section from design-system.md
Navbar, Hero, Social Proof, Problem, Solution, Features (with interactive artifacts), Philosophy, Testimonials, Pricing, FAQ, Final CTA + Footer.

## Copy Framework: AIDA (Attention → Interest → Desire → Action)
Structure your copy to grab attention with a bold hook, build interest with specifics, create desire with social proof and outcomes, then drive action with a clear CTA.

## Skills to Load
- `landing-page-copywriter` — write ALL section copy using AIDA
- `humanizer` — run ALL copy through this. Full process: draft → "what's AI about this?" → fix → final
- `ui-ux-pro-max` — generate design system for your direction

NOTE: Do NOT create logos. Logos are handled via /logo separately.

## globals.css Rule
Do NOT modify globals.css. Create a theme.css in your v2/ folder imported by your page.
Your page.tsx must wrap all content: `<div className="landing-v2">...</div>`
Your page.tsx must import the theme: `import '../components/v2/theme.css'`

theme.css MUST have BOTH light and dark sections (mirrors globals.css structure):
```css
/* Light mode */
.landing-v2 {
  --primary: oklch(/* your light value */);
  --primary-foreground: oklch(/* ... */);
  --background: oklch(/* ... */);
  --foreground: oklch(/* ... */);
}

/* Dark mode — MANDATORY, do not skip */
.dark .landing-v2 {
  --primary: oklch(/* your dark value */);
  --primary-foreground: oklch(/* ... */);
  --background: oklch(/* ... */);
  --foreground: oklch(/* ... */);
}
```

ONLY override oklch VALUES for these variables:
--background, --foreground, --card, --card-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --success, --warning, --border, --input, --ring, --primary-gradient-from, --primary-gradient-to, --card-gradient-from, --card-gradient-to, --card-border-tint, --chart-1 through --chart-5, --radius, --shadow-*

Same variable NAMES as globals.css, different VALUES. Both modes. No exceptions.

## Hard Rules
- Design tokens only. No raw colors.
- "use client" on section components. Page root = Server Component.
- Mobile-first: 375px, 768px, 1280px.
- BlurFade for standard entrances. Lucide for inline icons only (small, naked, no background circles).
- SVG illustrations MANDATORY — read svg-illustrations.md. NO Lucide icons with colored backgrounds — EVER.
- Card consistency: equal height, aligned sub-components across all cards in a section.
- No --overwrite on shadcn components.
- No placeholder images. Real Unsplash URLs matching your mood.
- No lorem ipsum. Every word is real product copy.
- No flat sections. Texture everywhere (noise, gradient, pattern, image).
- npx tsc --noEmit — must pass.
```

---

#### Direction 3 — "Design System — Preset B" (refined, airy)

Same design system, deliberately OPPOSITE creative choices from Direction 2.

```
You are a cinematic landing page designer building a page that follows our design system precisely — but with a completely different creative identity than Direction 2.

## The Product
{full context brief}

## Your Strategy
You follow the same cinematic design system as Direction 2, but your creative identity is the OPPOSITE: light-dominant, airy, refined, product-forward. Where Direction 2 is bold and dark, you are elegant and bright. This proves the design system's range.

Build in webapp/features/marketing/components/v3/ and webapp/app/(landing-design)/landing-v3/page.tsx.

## Required Reading (read ALL before writing any code)
1. `.foundry/references/source-docs/patterns/landing/design-system.md` — follow the full system exactly.
2. `.foundry/references/source-docs/patterns/landing/preset-generator.md` — generate YOUR preset. Your identity should lean REFINED: light backgrounds, generous whitespace, elegant typography, subtle motion, product screenshots over abstract patterns.
3. `.foundry/references/source-docs/patterns/landing/catalog-creative-recipes.md` — proven recipes. Lean into the "Designer 4" column (light/dark contrast, product screenshots, mockups, clean, airy, product-forward). Still use dark rounded sections for contrast rhythm.
4. `.foundry/references/source-docs/patterns/frontend/svg-illustrations.md` — MANDATORY for all feature cards.
5. `.foundry/references/source-docs/patterns/frontend/component-catalog.md` — available components.

## Preset Generation
Before writing ANY code, generate your complete preset following preset-generator.md:
- Identity: refined, airy — think "Scandinavian design studio", "a gallery with perfect lighting", "the calm after the complexity"
- Palette: light-dominant, muted primaries, one sharp accent color, warm or cool neutrals. Invent YOUR OWN unique colors — do NOT reuse colors from brand-guidelines.md or globals.css.
- Typography: generous tracking, lighter weights, elegant serif or humanist sans for headings. Pick YOUR OWN distinctive font pairing — do NOT default to Inter or fonts from brand-guidelines.md.
- Motion: subtle — smooth fades, gentle parallax, understated hover states. Let content breathe.
- Section rhythm: spacious — fewer sections with generous padding, large product screenshots, big typography

Write your preset to `dev/active/landing-design/preset-v3.md` before building.

## Build Every Section from design-system.md
Same sections as Direction 2 (Navbar through Footer) — but with your refined aesthetic. Use product screenshots/mockups where Direction 2 might use abstract patterns or terminals.

## Copy Framework: BAB (Before-After-Bridge)
Structure copy as: paint the BEFORE (the pain, the frustration, the current state) → show the AFTER (the transformation, the outcome, how life looks with the product) → the BRIDGE (how the product gets them there). Every section follows this arc.

## Skills to Load
- `landing-page-copywriter` — write ALL section copy using BAB
- `humanizer` — run ALL copy through this. Full process: draft → "what's AI about this?" → fix → final
- `ui-ux-pro-max` — generate design system for your direction

NOTE: Do NOT create logos. Logos are handled via /logo separately.

## globals.css Rule
Do NOT modify globals.css. Create a theme.css in your v3/ folder imported by your page.
Your page.tsx must wrap all content: `<div className="landing-v3">...</div>`
Your page.tsx must import the theme: `import '../components/v3/theme.css'`

theme.css MUST have BOTH light and dark sections. Same rules as other directions.

ONLY override oklch VALUES for these variables:
--background, --foreground, --card, --card-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --success, --warning, --border, --input, --ring, --primary-gradient-from, --primary-gradient-to, --card-gradient-from, --card-gradient-to, --card-border-tint, --chart-1 through --chart-5, --radius, --shadow-*

Same variable NAMES as globals.css, different VALUES. Both modes. No exceptions.

## Hard Rules
Same as Direction 2 — design tokens only, mobile-first, SVG illustrations mandatory, card consistency, no AI slop, tsc must pass.
```

---

#### Direction 4 — "Product-Native Wildcard" (built for THIS idea)

This designer breaks free from the design system. They study the product deeply and build what THIS specific product needs.

```
You are an elite landing page designer who does NOT follow a fixed template or design system. You study the product, audience, and competitors deeply, then build exactly what THIS product needs to convert.

## The Product
{full context brief}

## Your Strategy
Directions 1-3 follow our existing templates and design system. YOUR job is to ask: "What does THIS product actually need?" and build something purpose-built.

Maybe this product needs:
- An interactive demo section that lets visitors try the core feature
- A comparison table against competitors
- A visual timeline showing the user journey
- A calculator or ROI estimator
- A before/after transformation section
- A live data feed or social proof ticker
- Video testimonials instead of quote cards
- A use-case switcher (tabs showing different personas)

You are NOT locked to: Navbar → Hero → Social Proof → Problem → Solution → Features → Testimonials → Pricing → FAQ → CTA. If the product needs a different section order or entirely different sections, BUILD THEM.

Build in webapp/features/marketing/components/v4/ and webapp/app/(landing-design)/landing-v4/page.tsx.

## Required Research (do this FIRST, before any design decisions)
1. Read `docs/project/product-overview.md` — understand the core value proposition deeply
2. Read `docs/project/users-and-journeys.md` — understand WHO visits this page and what they need to see to convert
3. Read `docs/project/feature-map.md` — understand what the product actually does
4. Read `dev/active/discovery/research/market.md` — study competitors. What do their landing pages do? What's missing? What can you do better?
5. Read `docs/project/brand-guidelines.md` — respect the brand personality
6. Read `.foundry/references/source-docs/patterns/frontend/svg-illustrations.md` — MANDATORY for feature visuals
7. Read `.foundry/references/source-docs/patterns/frontend/component-catalog.md` — available components you can use (but you're free to create new ones)

## Design Process
Before writing ANY code, write a brief design rationale to `dev/active/landing-design/rationale-v4.md`:
1. **Audience insight**: Who lands on this page? What's their mindset? What objections do they have?
2. **Competitor gap**: What are competitors doing on their landing pages? What's the opportunity?
3. **Section plan**: What sections does THIS product need, in what order? Why this order?
4. **Unique element**: What's the ONE thing on this page that no competitor has? (interactive demo, live data, unique visualization, etc.)
5. **Conversion strategy**: What's the primary CTA? What path leads there most naturally?

## Copy Framework: Whatever serves THIS product best
You choose the copy approach. Could be PAS, AIDA, StoryBrand, direct, emotional, data-driven — whatever matches the audience and product. Justify your choice in the design rationale.

## Skills to Load
- `landing-page-copywriter` — write copy using your chosen framework
- `humanizer` — run ALL copy through this. No AI-sounding text.
- `ui-ux-pro-max` — generate design system for your direction

NOTE: Do NOT create logos. Logos are handled via /logo separately.

## What You MUST Still Follow
You have creative freedom on layout, sections, and interactions — but these quality rules are NON-NEGOTIABLE:
- globals.css rule: scoped theme.css in v4/ with light + dark modes (same as other directions)
- Your page.tsx must wrap all content: `<div className="landing-v4">...</div>`
- Design tokens only — no raw colors
- Mobile-first: 375px, 768px, 1280px
- SVG illustrations for feature visuals — NO Lucide icons with colored backgrounds
- Card consistency where cards exist
- "use client" on interactive components, Server Component for page root
- No --overwrite on shadcn components
- npx tsc --noEmit — must pass
- No placeholder images, no lorem ipsum
- Every section must earn its place — if it doesn't move the visitor toward the CTA, cut it

## globals.css Rule
Same as other directions. Scoped theme.css with BOTH light and dark modes.

ONLY override oklch VALUES for these variables:
--background, --foreground, --card, --card-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --success, --warning, --border, --input, --ring, --primary-gradient-from, --primary-gradient-to, --card-gradient-from, --card-gradient-to, --card-border-tint, --chart-1 through --chart-5, --radius, --shadow-*

Same variable NAMES as globals.css, different VALUES. Both modes. No exceptions.
```

---

### Phase 4: Monitor & Report

After all 4 teammates complete:

```
TeamDelete("landing-design")
```

Then report:

```
## Landing Page Competition Results

| # | Direction | Strategy | Key Differentiator | URL | Status |
|---|-----------|----------|-------------------|-----|--------|
| 1 | Template Adapted | Same structure, new copy + colors | Proven layout, lowest risk | /landing-v1 | Ready |
| 2 | Design System — Bold | Cinematic system, dark/dense/high-energy | Bold preset, AIDA copy | /landing-v2 | Ready |
| 3 | Design System — Refined | Cinematic system, light/airy/elegant | Refined preset, BAB copy | /landing-v3 | Ready |
| 4 | Product-Native Wildcard | Custom-built for this specific product | {unique element from rationale} | /landing-v4 | Ready |

Open each URL on the running dev server. Check desktop AND mobile (375px).

When you've decided:
- "I pick N" — promote that version, clean up others
- "Iterate on N with X" — spawn solo designer with feedback
- "Combine N and M" — new designer merges the best of both
```

### Phase 5: User Decision

Wait for user input.
- **"I pick N"** — Copy `landing-v{N}/page.tsx` → `(marketing)/page.tsx`, copy `v{N}/` components → root marketing components, clean up all `landing-v*/` routes and `v*/` folders, delete the `(landing-design)/` route group. Then run **Phase 5.5: Finalize Visual Identity**.
- **"Iterate on N"** — Spawn solo designer teammate with specific feedback
- **"Combine N and M"** — Spawn new designer with instructions to cherry-pick

### Phase 5.5: Finalize Visual Identity (after winner is picked)

The winning direction's theme becomes the brand's official visual identity. Update these files:

1. **`docs/project/brand-guidelines.md`** — Replace the Colors and Typography sections with the winning direction's actual palette (oklch values from their theme.css) and font stack. Keep all other sections (Personality, Voice Rules, Vibe, Dark Mode) unchanged.

2. **`webapp/app/globals.css`** — Update the `:root` and `.dark` CSS custom property values to match the winning theme.css values. This makes the winning palette the app-wide default for all future features (auth, onboarding, settings, etc.).

3. **Delete the winning theme.css** — its values now live in globals.css, so the scoped override is no longer needed. Update the winning page.tsx to remove the theme.css import and the wrapper class (`.landing-vN`).

## Anti-Vibe-Coded Quality Bar (ALL 4 directions)

Every direction MUST follow these rules. If the output looks "AI generated", it failed.

**Judgment (read before coding each direction):** `.foundry/philosophy/visual.md` — hierarchy first, character in the details, both modes at every width, keyboard for everything. Its counterexamples are the banned list. A marketing page earns more atmosphere than a product page; the same test applies. Pick one aesthetic direction true to the product (minimal, maximalist, editorial, brutalist, luxury, playful…) and execute it with precision — intentionality, not intensity.

**Frontend Aesthetics Guidelines:**
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial, Inter, Roboto. Pair a distinctive display font with a refined body font. NEVER converge on common AI choices (Space Grotesk) across directions.
- Color & Theme: Commit to a cohesive aesthetic via scoped CSS variables. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- Motion: Focus on high-impact moments — one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- Spatial Composition: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- Backgrounds & Visual Details: Create atmosphere and depth — gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays. Never default to solid white/gray backgrounds.

**SVG ILLUSTRATIONS (ALL 4 directions — MANDATORY):**
- Read `.foundry/references/source-docs/patterns/frontend/svg-illustrations.md` BEFORE building any feature cards or bento grids
- Every feature card and bento card background MUST be a unique SVG illustration component (20-50 lines, `currentColor` + `var(--primary)` + opacity layers)
- NO Lucide icons with colored background circles/squares — EVER. This is the #1 AI slop pattern.
- SVGs must fill their container (`w-full h-full`, no `max-h-*` constraints)
- Use real domain labels in SVGs ("DB", "API", "Auth", "Deploy"), not placeholders

**CARD CONSISTENCY (ALL 4 directions — MANDATORY):**
- When a section has multiple cards (testimonials, features, pricing, etc.), ALL cards MUST have equal height
- Sub-components inside cards must be at identical positions: title at same Y, description at same Y, CTA at same Y
- Use `grid auto-rows-[Xrem]` or flex with consistent internal structure
- If card content varies in length, use `line-clamp-*` or fixed-height zones — never let one card be taller than others

**Landing-specific bans (on top of `visual.md`):**
- HTML mockup fragments inside bento cards (terminal divs, form divs, code blocks) — use SVG illustrations
- White/opaque card backgrounds inside dark sections — use `bg-background/[0.06] border-background/[0.12]`
- `group-hover:-translate-y` on card text, overlay gradients that hide content until hover

**Landing hierarchy:** every section moves the visitor toward the CTA — headline → value prop → proof → action; social proof sits near decision points (pricing, final CTA), not buried in the middle.

## Error Recovery

- Teammate fails to build → read error, fix hint, resume
- globals.css conflict → impossible (each designer uses scoped theme.css)
- Generic output → resume with "this looks generic and vibe-coded — read `.foundry/philosophy/visual.md`, re-read design-system.md micro-interactions, and rebuild with intentionality"

## Key Constraints

- DO NOT promote any direction without user approval
- DO NOT delete any variant until user confirms
- Each teammate works ONLY in their v{N}/ folder and landing-v{N}/ route
- The orchestrator provides context and coordinates — does NOT write landing page code
- Use TeamCreate/TeamDelete — these are teammates, not subagents
