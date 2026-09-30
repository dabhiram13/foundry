# Preset Generator — From Discovery Docs to Design Presets

The orchestrator reads ALL discovery docs and generates 4 product-specific presets. These are NOT generic "blue theme" vs "dark theme". They are fully-realized design identities informed by the brand, audience, competitors, and market position.

## Inputs (orchestrator reads these)

1. `docs/project/brand-guidelines.md` — voice, tone, personality, visual direction
2. `docs/project/product-overview.md` — what the app does, pricing, positioning
3. `docs/project/users-and-journeys.md` — who the users are, what they feel
4. `dev/active/discovery/research/market.md` — competitors, market position
5. `webapp/app/globals.css` — current design token variable names (ONLY change oklch values)

## What a Preset Contains

Every preset is a complete design identity. Nothing is left vague.

```markdown
### Preset {N} — "{Name}" ({Identity Label})

**Identity:** {One sentence — what this feels like as a physical space.
  E.g., "A genome sequencing lab inside a Tokyo nightclub" or
  "A private members' library with floor-to-ceiling windows"}

**Why this works for {product}:** {How this identity connects to the brand/audience.
  E.g., "The target audience (indie developers) values craft and precision.
  This preset's lab aesthetic signals technical depth without corporate coldness."}

**Palette (globals.css oklch overrides):**
- --background: {oklch value} — {color name + why}
- --foreground: {oklch value}
- --primary: {oklch value} — {the dominant brand color}
- --secondary: {oklch value}
- --accent: {oklch value} — {the pop color for CTAs and highlights}
- --muted: {oklch value}
- --card: {oklch value}
- --border: {oklch value}
- --destructive: {oklch value}
- --success: {oklch value}
- --ring: {oklch value}
- (include ALL token overrides for both :root and .dark)

**Typography feel:**
- Headings: {font recommendation} — {why it matches the identity}
- Drama font: {serif/display for hero impact} — {character}
- Data/mono: {monospace for labels and stats}
- Heading tracking: {tight/normal} | Weight contrast: {bold headings, light body}
- Scale: {hero heading size at desktop, e.g., "clamp(3rem, 8vw, 7rem)"}

**Image mood:** {Exact Unsplash search terms for hero/texture images.
  E.g., "dark forest canopy, morning mist, organic textures, macro moss"}

**Hero type:** {Which hero structure from the design system.
  E.g., "Full-bleed image with gradient overlay, text bottom-left" or
  "Split — product screenshot right, copy left" or
  "Centered text-only with subtle particle background"}

**Hero copy pattern:** {Structural pattern for the hero headline.
  Line 1: "[Concept noun] is the" (Bold sans, heading font)
  Line 2: "[Power word]." (Massive drama font italic)}

**Feature card interactions:** {Pick 3 from the Interaction Pattern Library.
  E.g., "Card 1: Mini Dashboard (shows real-time analytics preview),
         Card 2: Code Preview (shows the developer API),
         Card 3: Notification Stream (shows what alerts look like)"}

**Section rhythm:** {How sections flow.
  E.g., "Alternating light/dark with gradient transitions between" or
  "All-dark with accent-colored section dividers" or
  "White background throughout with dark feature section as contrast"}

**Motion intensity:** {Subtle / Moderate / Dramatic.
  Subtle = BlurFade only, no scroll-triggered animations.
  Moderate = BlurFade + scroll reveals + hover interactions.
  Dramatic = Full scroll-triggered stacking, parallax, interactive cursors.}
```

## How the Orchestrator Generates 4 Presets

### Step 1: Analyze the Brand Space

From brand-guidelines.md, extract:
- **Personality axis:** Playful ←→ Serious
- **Energy axis:** Calm ←→ Energetic
- **Density axis:** Minimal ←→ Information-dense
- **Audience technical level:** Consumer ←→ Developer

### Step 2: Map Competitors to Visual Space

From market.md, identify what competitors look like:
- Are they all dark mode? → One preset should be light to differentiate.
- Are they all minimal? → One preset should be denser.
- Do they all use blue? → Avoid blue as primary in all presets.

### Step 3: Generate 4 Presets That Cover the Space

The 4 presets MUST span different quadrants. Use this matrix:

| Preset | Energy | Density | Mode | Differentiator |
|--------|--------|---------|------|---------------|
| 1 | Calm | Sparse | Light | Editorial confidence — the "we don't need to shout" approach |
| 2 | High | Moderate | Dark | Cinematic impact — the "this is the future" approach |
| 3 | Moderate | Dense | Light/Dark | Product-forward — the "look what it does" approach |
| 4 | Extreme | Sparse | Dark | Bold minimal — the "three words per screen" approach |

Adjust based on the brand personality. If the brand is playful, shift energies up. If serious, shift down. If developer-focused, increase density. If consumer, decrease.

### Step 4: Ground Each Preset in a Real-World Analogy

Each preset's **Identity** line must be a physical space analogy that connects to the product:
- Health app → "A precision clinic with warm wood and cold steel"
- Dev tool → "A control room for the future — no decoration, pure signal"
- Creative tool → "A gallery opening in a converted warehouse"
- Finance → "A private members' club meets a Swiss watchmaker's atelier"

The analogy guides every micro-decision the designer makes.

### Step 5: Assign Feature Interactions Based on Product

From feature-map.md, identify the 3 key value props. Then assign interaction patterns that DEMONSTRATE the product:

- Analytics product → Metric Ticker, Mini Dashboard, Telemetry Typewriter
- Developer tool → Code Preview, Cursor Protocol, Notification Stream
- Creative tool → Before/After Slider, Diagnostic Shuffler, Mini Dashboard
- Marketplace → Notification Stream, Metric Ticker, Before/After Slider

Each preset can use different interaction patterns for the same value props — this creates structural variation beyond just color.

---

## What the Orchestrator Passes to Each Designer Agent

Each designer gets:
1. The **full context brief** (product, personas, pain points, pricing)
2. Their **specific preset** (complete — palette, typography, identity, interactions, everything)
3. The **fixed design system** (`.foundry/references/source-docs/patterns/landing/design-system.md`)
4. The **component catalog** (`.foundry/references/source-docs/patterns/frontend/component-catalog.md`)
5. Their **copy framework** assignment (PAS, AIDA, StoryBrand, or Direct)
6. The **real inspiration URL** from Phase 1.5 research
7. **Explicit instruction:** "Do not build a website; build a digital instrument. Every scroll intentional, every animation weighted and professional. Eradicate all generic AI patterns."

The designer has ZERO ambiguity. They know exactly what to build.
