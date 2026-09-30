# Catalog-Creative Recipes (Designers 3-4)

Proven patterns from successful landing page builds. Designers 3-4 MUST read this before building.

## The Two Creative Directions

| Designer | Emphasis | Personality |
|----------|----------|-------------|
| 3 | Dark/bento, stat-heavy, particle backgrounds | Bold, dense, data-driven |
| 4 | Light/dark contrast, product screenshots, mockups | Clean, airy, product-forward |

---

## Recipe 1: Dark Rounded Card Section (STAR pattern)

The highest-impact section pattern. Creates depth and rhythm against light backgrounds.

```tsx
<section className="px-2 sm:px-4 lg:px-8 py-4">
  <div className="bg-foreground text-background rounded-3xl px-4 py-16 sm:px-8 lg:px-16 lg:py-24 shadow-2xl relative overflow-hidden">
    <DotPattern className="absolute inset-0 opacity-[0.07]" />
    <div className="relative z-10 max-w-6xl mx-auto">
      {/* Content constrained to max-w, dark bg stays full-width */}
      <h2 className="text-3xl sm:text-4xl font-bold text-background">...</h2>
      <p className="text-background/60">...</p>
    </div>
  </div>
</section>
```

**Rules:**
- Minimum 2 dark card sections per page (features + CTA/footer)
- Never stack two dark cards — always separate with a light section
- Side margins (`px-2` → `lg:px-8`) let the light background peek through
- `DotPattern` at opacity 0.07-0.10 for subtle texture
- Content inside gets `max-w-6xl mx-auto` — the dark rounded bg stays full-width
- Cards inside dark sections: `bg-background/[0.06] border-background/[0.12]` — NOT white
- Text hierarchy: `text-background` (headings) → `text-background/60` (body) → `text-background/40` (muted)

---

## Recipe 2: BentoGrid with SVG Illustration Backgrounds

Each BentoCard `background` slot contains a rich SVG illustration component. Read `.foundry/references/source-docs/patterns/frontend/svg-illustrations.md` for the full SVG pattern library.

**MANDATORY: SVG illustrations, not HTML mockups.** Every bento card gets a unique SVG component (hub-and-spoke, chart, form sketch, pipeline, layered stack, shield, etc.)

### Grid Layout
```tsx
<BentoGrid className="auto-rows-[22rem] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {features.map((feature) => (
    <BentoCard key={feature.name} className="col-span-1" /* ... */ />
  ))}
</BentoGrid>
```

### Card Styling Inside Dark Sections
```tsx
<BentoCard
  className="bg-background/[0.06] border-background/[0.12] text-background
    [&_a]:text-primary [&_h3]:text-background [&_p]:text-background/60 [&_svg]:text-background"
  background={<MyIllustrationSVG />}
/>
```

### Rules
- **6 cards in 3x2 grid** — all `col-span-3 lg:col-span-1` for responsive, `auto-rows-[22rem]`
- **Cards inside dark sections**: `bg-background/[0.06] border-background/[0.12] text-background [&_a]:text-primary [&_h3]:text-background [&_p]:text-background/60 [&_svg]:text-background`
- **SVG wrapper**: `<div className="flex items-center justify-center p-4 h-full">` — fills the card
- **SVG element**: `<svg viewBox="0 0 200 160" fill="none" className="w-full h-full">`
- **No `max-h-*` constraints** — SVGs fill available space
- **All content always visible** — no hover-to-reveal, no text shifting, no overlays
- **Each card**: Lucide icon + title + description + CTA link, all static and readable
- **Content inside dark bg gets `max-w-6xl mx-auto`** — the dark rounded bg stays full-width
- **Read `.foundry/references/source-docs/patterns/frontend/svg-illustrations.md`** for SVG patterns + code examples

### Reference: `features-v3.tsx`
6 SVG illustrations in a BentoGrid inside a dark rounded section: `AgentNetworkSVG` (hub-and-spoke), `BuildPipelineSVG` (sequential steps + parallel agents), `StackLayersSVG` (ellipse layers), `AuthFlowSVG` (login form sketch), `SecurityShieldSVG` (shield + checkmark), `DeployChartSVG` (bar chart + trend line).

### BANNED in BentoCards
- HTML mockup fragments (terminal divs, form divs, code blocks)
- `group-hover:-translate-y` on text
- Overlay gradients that hide content until hover
- White/opaque card backgrounds inside dark sections
- `opacity-60 group-hover:opacity-80` patterns — content must always be fully visible

---

## Recipe 3: Animated Agent Terminal (Dark Section Showpiece)

A live terminal showing agent work — lines appear one by one with a blinking cursor.

```tsx
const terminalLines = [
  { agent: "planner", color: "text-primary", text: "Analyzing spec... 6 tasks identified" },
  { agent: "db-architect", color: "text-primary", text: "Creating users table with RLS..." },
  { agent: "backend", color: "text-accent-foreground", text: "Building 8 oRPC procedures..." },
  { agent: "designer", color: "text-accent-foreground", text: "Building dashboard..." },
  { agent: "tester", color: "text-primary", text: "Running 47 tests... all passed" },
];

// useEffect with setInterval, incrementing visibleLines every 800ms
// Reset after all lines shown (setTimeout 2000ms, then setVisibleLines(0))
```

**Visual structure:**
- Rounded card: `border-background/20 bg-background/5 backdrop-blur-sm`
- Window dots: 3 small circles + monospace title
- Each line: `[agent-name] text...` with agent-specific colors
- Blinking cursor: `animate-pulse bg-primary` bar while typing
- Final line: "All tasks completed" in primary color

---

## Recipe 4: MagicCard Feature Grid with Stats

Each card's hero element is a NUMBER or STAT, not an icon.

```tsx
<MagicCard
  className="rounded-2xl"
  gradientFrom="oklch(0.78 0.12 {YOUR_HUE})"
  gradientTo="oklch(0.65 0.10 {YOUR_HUE - 25})"
>
  <div className="p-6 space-y-4">
    <div className="flex items-center justify-between">
      <span className="text-4xl font-black text-foreground">12</span>
      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
        agents
      </span>
    </div>
    <div>
      <h3 className="text-lg font-semibold text-foreground">Specialist Agents</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Each agent is an expert in its domain — database, API, UI, testing.
      </p>
    </div>
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full bg-primary w-[85%]" />
    </div>
  </div>
</MagicCard>
```

**3+ visual elements per card:** stat number + badge + title + description + progress bar = 5 elements.

---

## Recipe 5: Dashboard Mockup (Hero Visual)

A realistic SaaS dashboard built in JSX — sidebar + stats + chart + activity list.

```tsx
<div className="relative w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
  <div className="flex min-h-[340px] sm:min-h-[420px]">
    {/* Sidebar — hidden on mobile */}
    <div className="hidden sm:flex w-48 flex-col border-r border-border bg-muted/30 p-3 gap-2">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-3">
        <div className="size-6 rounded-md bg-primary/20" />
        <span className="text-xs font-semibold text-foreground">MyApp</span>
      </div>
      {["Dashboard", "Users", "Analytics", "Billing", "Settings"].map((item, i) => (
        <div key={item} className={`rounded-md px-2.5 py-1.5 text-xs ${
          i === 0 ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
        }`}>
          {item}
        </div>
      ))}
    </div>
    {/* Main: topbar + 3 stat cards + chart SVG + activity list */}
    <div className="flex-1 flex flex-col min-w-0">
      {/* ... stat cards, SVG chart, activity list ... */}
    </div>
  </div>
</div>
```

Add gradient fade at bottom: `<div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-background to-transparent" />`

---

## Recipe 6: Custom Logo SVGs

Each landing page needs its own logo. Build inline SVGs using `var(--primary)`.

**Hexagon/Diamond (geometric, bold):**
```tsx
<svg viewBox="0 0 32 32" fill="none" className={className}>
  <path d="M16 3L6 9v14l10 6 10-6V9L16 3z" fill="var(--primary)" opacity="0.15" />
  <path d="M16 3L6 9v14l10 6 10-6V9L16 3z" stroke="var(--primary)" strokeWidth="1.5" fill="none" />
  <path d="M16 8l-6 4v8l6 4 6-4v-8l-6-4z" fill="var(--primary)" opacity="0.4" />
  <path d="M16 13l-3 2v4l3 2 3-2v-4l-3-2z" fill="var(--primary)" />
</svg>
```

**Leaf/Wave (organic, fresh):**
```tsx
<svg viewBox="0 0 32 32" fill="none" className={className}>
  <path d="M8 24C8 12 16 4 28 4C28 16 20 24 8 24Z" fill="var(--primary)" opacity="0.15" />
  <path d="M8 24C8 12 16 4 28 4C28 16 20 24 8 24Z" stroke="var(--primary)" strokeWidth="1.5" fill="none" />
  <path d="M8 24C12 18 18 12 28 4" stroke="var(--primary)" strokeWidth="1" opacity="0.4" />
  <circle cx="18" cy="14" r="2" fill="var(--primary)" />
</svg>
```

---

## Theme CSS Scoping (MANDATORY)

Each landing page gets its own CSS that overrides design tokens:

```css
/* theme-v{N}.css */
.landing-v{N}-theme {
  --primary: oklch(/* YOUR value */);
  --primary-foreground: oklch(/* ... */);
  --background: oklch(/* ... */);
  --foreground: oklch(/* ... */);
  /* ... all semantic tokens ... */
}

/* Dark mode */
:where(.dark) .landing-v{N}-theme {
  --primary: oklch(/* YOUR dark value */);
  /* ... */
}

/* Button gradient fix — override hardcoded blue gradient */
.landing-v{N}-theme [data-variant="default"][data-slot="button"] {
  background: linear-gradient(180deg,
    oklch(/* lighter hue */ ) 0%,
    var(--primary) 60%,
    oklch(/* darker hue */) 100%
  ) !important;
  box-shadow: 0 4px 14px 0 oklch(/* primary */ / 0.25),
    inset 0 1px 0 oklch(1 0 0 / 0.2) !important;
}
```

**Why:** The default Button component has hardcoded blue oklch values. The CSS override makes it match your theme automatically.

**Layout wraps content:**
```tsx
// layout.tsx
import "./theme-v{N}.css";
export default function Layout({ children }) {
  return <div className="landing-v{N}-theme min-h-screen bg-background text-foreground">{children}</div>;
}
```

**ShimmerButton:** Pass `background="oklch(YOUR_PRIMARY)"` directly as prop — it doesn't use CSS vars.

---

## Component Props Cheatsheet

| Component | Key Props | Theme Integration |
|-----------|-----------|-------------------|
| `MagicCard` | `gradientFrom`, `gradientTo` | Pass oklch values matching your primary hue |
| `ShimmerButton` | `background` | Pass oklch string of your primary color |
| `Particles` | `color` | Pass HEX color (e.g., `#d97706` for amber) |
| `DotPattern` | `glow`, `className` | Uses `currentColor` — inherits from parent text color |
| `AnimatedGridPattern` | `numSquares`, `maxOpacity` | Uses `currentColor` — inherits from section |
| `BlurFade` | `delay`, `inView` | No color dependency — just animation |
| `Marquee` | `pauseOnHover`, `reverse` | No color dependency |
| `Highlighter` | `action`, `color` | Pass your primary color as string |
| `Button` | `variant` | Gradient auto-fixed by theme CSS |
| `BentoCard` | `background` (ReactNode) | Fill with mockup JSX, not icons |
