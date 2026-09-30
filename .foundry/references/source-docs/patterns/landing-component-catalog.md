# Landing Page Component Catalog

Proven, production-grade components available in the codebase. Designers 3-4 MUST use these as building blocks — never invent from scratch.

## Design Philosophy (from real-world references)

### Section Contrast Pattern
Pages feel alive when sections alternate visual weight. Think of the page as 3 stacked cards:
- **Light section** (white/background) with generous spacing
- **Dark rounded card** (`bg-foreground text-background rounded-3xl mx-4 lg:mx-8`) — full-width-ish with rounded corners top AND bottom, subtle `shadow-2xl`
- **Light section** again

This creates depth and rhythm. The dark card feels like a floating surface. Multiple dark cards can exist but never stack directly — always separate with a light section.

### Card Richness Rule
Every card interior must contain MORE than icon + title + description. Add at least 2 of:
- A mini data visualization (chart, progress bar, stat number)
- A product screenshot or mockup fragment
- A secondary piece of metadata (date, status badge, user avatar)
- An interactive hover state that reveals more info
- A decorative background element (DotPattern, AnimatedGridPattern, gradient)

### No Generic Icons
NEVER use a random Lucide icon in a colored circle as the primary visual of a card. Instead:
- Build custom SVG illustrations inline (20-40 lines of SVG JSX)
- Use product mockup fragments as the visual
- Use large stat numbers as the visual (`text-5xl font-bold`)
- Use BentoGrid cards where the `background` slot contains a real visual element
- If you must use an icon, it should be small and secondary — never the hero of a card

### Ultra-Detail Principle
Every section should reward the user for looking closely. Sections that are "just text" fail. Add:
- Subtle background patterns (DotPattern, AnimatedGridPattern)
- Hover-triggered micro-interactions (MagicCard glow, scale transforms)
- Staggered entrance animations (BlurFade with increasing delays)
- Real data in mockups (names, numbers, dates — not "Lorem ipsum")

---

## Component Catalog

### Backgrounds & Patterns

| Component | Path | What it does |
|-----------|------|-------------|
| AnimatedGridPattern | `components/ui/animated-grid-pattern.tsx` | SVG grid with squares that fade in/out randomly. Great for hero backgrounds. |
| DotPattern | `components/ui/dot-pattern.tsx` | Subtle dot grid. `glow` prop adds animated pulsing dots. Use behind cards/sections. |
| Particles | `components/ui/particles.tsx` | Canvas-based floating particles that react to mouse. Use for hero or CTA backgrounds. |
| LightRays | `components/ui/light-rays.tsx` | Animated light beams sweeping across a section. Dramatic — use sparingly (hero or CTA). |
| SplashCursor | `components/shadcn-space/animations/splash-cursor.tsx` | WebGL fluid simulation that follows the cursor. Full-screen overlay. Very high-impact for hero sections. |

**Usage pattern — hero background:**
```tsx
<section className="relative min-h-screen overflow-hidden">
  <AnimatedGridPattern className="absolute inset-0 opacity-30" numSquares={30} />
  <div className="relative z-10">
    {/* Hero content */}
  </div>
</section>
```

### Cards & Containers

| Component | Path | What it does |
|-----------|------|-------------|
| BentoGrid + BentoCard | `components/ui/bento-grid.tsx` | Grid layout with hover-reveal CTA buttons. `background` slot for rich visuals. Cards span columns (`col-span-1`, `col-span-2`). |
| MagicCard | `components/ui/magic-card.tsx` | Card with radial gradient that follows the cursor on hover. Subtle glow border effect. |

**Usage pattern — feature bento grid:**
```tsx
<BentoGrid className="grid-cols-1 md:grid-cols-3 gap-4">
  <BentoCard
    name="Analytics Dashboard"
    description="Real-time metrics at a glance"
    className="col-span-2"
    Icon={BarChart3}
    href="#"
    cta="Explore"
    background={
      <div className="absolute inset-0 p-6">
        {/* Mini dashboard mockup JSX — NOT just an icon */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Revenue</span>
            <span className="font-semibold">$24,500</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary w-3/4" />
          </div>
        </div>
      </div>
    }
  />
</BentoGrid>
```

**Usage pattern — MagicCard grid:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {features.map((f) => (
    <MagicCard key={f.title} className="rounded-2xl">
      <div className="p-6 space-y-4">
        <p className="text-4xl font-bold">{f.stat}</p>
        <h3 className="text-lg font-semibold">{f.title}</h3>
        <p className="text-sm text-muted-foreground">{f.description}</p>
      </div>
    </MagicCard>
  ))}
</div>
```

### Animations & Motion

| Component | Path | What it does |
|-----------|------|-------------|
| BlurFade | `components/ui/blur-fade.tsx` | Fade-in with blur + directional slide. Use for entrance animations. Stagger with `delay`. |
| Marquee | `components/ui/marquee.tsx` | Infinite scrolling content (logos, testimonials). `pauseOnHover`, `reverse`, `vertical` props. |
| AnimatedList | `components/ui/animated-list.tsx` | Items appear one-by-one with spring animation. Great for notification/activity feeds. |
| AnimatedBeam | `components/ui/animated-beam.tsx` | Animated gradient line connecting two elements via refs. Shows data flow between nodes. |

**Usage pattern — staggered section entrance:**
```tsx
<BlurFade delay={0.1} inView>
  <h2 className="text-3xl font-bold">Why teams choose us</h2>
</BlurFade>
<BlurFade delay={0.2} inView>
  <p className="text-muted-foreground max-w-2xl">...</p>
</BlurFade>
<div className="grid grid-cols-3 gap-6">
  {items.map((item, i) => (
    <BlurFade key={item.title} delay={0.3 + i * 0.1} inView>
      <MagicCard>...</MagicCard>
    </BlurFade>
  ))}
</div>
```

### Buttons & CTAs

| Component | Path | What it does |
|-----------|------|-------------|
| ShimmerButton | `components/ui/shimmer-button.tsx` | Dark button with animated shimmer border effect. High-impact primary CTA. |
| RainbowButton | `components/ui/rainbow-button.tsx` | Button with animated rainbow gradient border. Eye-catching CTA. |
| Sliding Arrow Button | `components/shadcn-space/blocks/hero-01/hero.tsx` | Rounded pill button where arrow slides from right to left on hover. Pattern to copy. |

**Usage pattern — hero CTA pair:**
```tsx
<div className="flex items-center gap-4">
  <ShimmerButton className="h-12 px-8 text-base">
    Start Building
  </ShimmerButton>
  <Button variant="outline" size="lg" className="rounded-full">
    See Demo
  </Button>
</div>
```

### Text Effects

| Component | Path | What it does |
|-----------|------|-------------|
| Highlighter | `components/ui/highlighter.tsx` | Rough-notation style highlight/underline/circle on text. Draws on scroll-into-view. |
| RotatingText | `components/blocks/hero-section-nexus.tsx` | Text that cycles through an array of strings with animation. Exported from the nexus block. |
| AnimatedGroup | `components/ui/hero-section-with-gradient.tsx` | Staggered children animation with presets: fade, slide, scale, blur, blur-slide, zoom, flip, bounce. |

**Usage pattern — highlighted keyword in heading:**
```tsx
<h2 className="text-4xl font-bold">
  Ship products <Highlighter action="underline" color="hsl(var(--primary))" isView>10x faster</Highlighter>
</h2>
```

### Complete Blocks (copy & adapt)

| Block | Path | What it contains |
|-------|------|-----------------|
| Hero-01 (Agency) | `components/shadcn-space/blocks/hero-01/` | Full hero: sticky pill header (morphs on scroll), fluid cursor background, large heading with serif italic accent, sliding arrow CTA, avatar stack with stars, brand marquee slider. 4 files: index, header, hero, brand-slider. |
| Hero Section with Gradient | `components/ui/hero-section-with-gradient.tsx` | Pastel gradient hero with AnimatedGroup staggered entrance, dual CTAs (solid + gradient border), product screenshot with fade-out overlay, brands grid. |
| Hero Section Nexus | `components/blocks/hero-section-nexus.tsx` | Mega block (~1200 lines) with RotatingText, animated navbar, interactive tabs, code blocks, multi-section landing page. Very rich — extract individual patterns rather than using whole. |

---

## Section Recipes (for Designers 3-4)

These are patterns to compose from the catalog. Each recipe is a section blueprint.

### Recipe: Dark Feature Showcase (like Content Verification screenshot)
```
Container: dark rounded card (bg-foreground rounded-3xl mx-4 py-16)
Layout: BentoGrid with 2 large + 3 small cards
Card interiors:
  - Large cards: big stat number (text-5xl) + description + mini chart
  - Small cards: custom SVG illustration + title + one-liner
Background: DotPattern with low opacity
Entrance: BlurFade staggered
```

### Recipe: Product Screenshot Hero (like Appfittle screenshot)
```
Container: dark bg, full bleed
Layout: centered text + floating product screenshot below
Text: large heading + subheading + single CTA (ShimmerButton)
Screenshot: wrapped in rounded-2xl border with shadow-2xl,
  overlaid with gradient fade at bottom
  cursor animation or LightRays behind it
Background: radial gradient glow behind screenshot (primary color, very subtle)
```

### Recipe: Social Proof + Integration Row (like Postiz screenshot)
```
Container: light or dark, your choice
Layout: centered heading + row of actual platform/integration icons
Icons: real SVGs (not Lucide) — build them inline or use brand SVGs
Below: Marquee with logo images, or static grid
Entrance: AnimatedGroup with blur-slide preset
```

### Recipe: Alternating Light/Dark Sections (like Swipeeely)
```
Section 1 (light): Hero with AnimatedGridPattern bg
Section 2 (light): Feature cards in MagicCard grid
Section 3 (DARK card): rounded-3xl, contains testimonials or feature deep-dive
Section 4 (light): Pricing with clean cards, subtle shadows
Section 5 (DARK card): Final CTA + Footer combined in one rounded dark surface
```

### Recipe: Stats Bento (bold numbers as visuals)
```
Container: any bg
Layout: BentoGrid — asymmetric (2+3 or 1+2+1)
Each card:
  - Hero element = large number or percentage (text-6xl font-black)
  - Supporting text below
  - Optional: mini progress bar, sparkline, or badge
  - MagicCard wrapper for hover glow
Background per card: subtle gradient or DotPattern
```

### Recipe: Animated Activity Feed
```
Container: split layout — text left, demo right
Left: heading + 3 bullet benefits with BlurFade stagger
Right: AnimatedList showing notifications/events appearing one by one
  Each item: avatar + name + action + timestamp (realistic data!)
Border: rounded-2xl with shadow, slight bg-muted
```

### Recipe: Flow Diagram with Beams
```
Container: centered
Layout: 3-4 nodes in a row (or hub-and-spoke)
Each node: rounded-xl bg-background border p-4 with icon + label
Connections: AnimatedBeam between node refs
Center node: larger, primary colored border
Background: DotPattern
```

---

## Mandatory Rules for Designers 3-4

1. **USE THIS CATALOG** — every visual element must come from a component listed above or be a custom SVG you build inline. Never rely on bare divs with just text.

2. **Section contrast is mandatory** — at least one dark rounded card section per page. Light and dark sections must alternate visually.

3. **No icon-in-circle pattern** — if a card's primary visual is a Lucide icon wrapped in a colored `rounded-full` div, you failed. Use stat numbers, mockup fragments, custom SVGs, or BentoCard backgrounds instead.

4. **Every card must be rich** — minimum 3 visual elements per card (title + description is only 2 — add a stat, badge, progress bar, avatar, or background element).

5. **Animations are layered** — BlurFade for entrances, Marquee for scrolling content, MagicCard for hover states, AnimatedGridPattern/DotPattern for backgrounds. Use at least 2 animation types per page.

6. **Custom SVG over generic icons** — build inline SVG illustrations (20-40 lines) for key visuals. Abstract shapes, simple product outlines, or data visualizations. These take 5 minutes and look 10x better than Lucide icons.

7. **Realistic data everywhere** — mockups show real names, real numbers, real dates. "John Doe" and "Lorem ipsum" are banned.

8. **Both light + dark mode** — use semantic tokens only (`bg-background`, `text-foreground`, `bg-muted`, etc.). Never force dark-only with raw colors.

9. **Mobile responsive** — 375px, 768px, 1280px. BentoGrid collapses to single column. Dark cards keep rounded corners but reduce margin on mobile (`mx-2 lg:mx-8`).

10. **Design tokens only** — `bg-primary`, `text-foreground`, `border-border`. No `bg-[#hex]`, no `white/[opacity]` systems. The ONE exception: gradient stops can use `from-primary/10` opacity modifiers on token colors.
