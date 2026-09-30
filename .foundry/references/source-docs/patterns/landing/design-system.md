# Cinematic Landing Page — Fixed Design System

Every landing page follows this system. Presets change colors/fonts/mood. This architecture NEVER changes.

## Visual Texture (ALL presets)

Global CSS noise overlay — inline SVG `<feTurbulence>` filter at **0.05 opacity**. Eliminates flat digital gradients.

```css
.noise-overlay::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

Radius system: `rounded-[2rem]` to `rounded-[3rem]` for all containers. No sharp corners anywhere except data tables.

## Micro-Interactions (ALL presets)

**Buttons — magnetic feel:**
- Hover: `scale(1.03)` with `cubic-bezier(0.25, 0.46, 0.45, 0.94)` over `300ms`
- `overflow-hidden` with sliding background `<span>` for color transitions
- Active: `scale(0.97)` for press feedback

**Links / interactive elements:**
- `translateY(-1px)` lift on hover
- Underline slides in from left (`scaleX(0)` → `scaleX(1)`, `transform-origin: left`)

**Cards:**
- Hover: `translateY(-4px)` + shadow deepens
- Border glow on hover (accent color at 0.1 opacity)

## Animation Lifecycle

Use **framer-motion** (already in the project) for all entrance animations. BlurFade for standard entrances. Custom variants for hero/feature sections.

**Default easings:**
- Entrances: `[0.25, 0.46, 0.45, 0.94]` (power3.out equivalent)
- Morphs/transitions: `[0.45, 0, 0.55, 1]` (power2.inOut equivalent)
- Bounce (feature cards): `[0.34, 1.56, 0.64, 1]` (spring)

**Stagger values:**
- Text lines: `0.08s`
- Cards/containers: `0.15s`
- Nav items: `0.05s`

**Scroll animations:** Use `whileInView` with `viewport={{ once: true, margin: "-100px" }}`.

## Responsive Breakpoints

Mobile-first. Three breakpoints:
- **375px** (mobile): Single column. Hero text 60% of desktop size. Features stack vertically. Protocol cards become vertical scroll. Nav collapses to logo + hamburger with slide-out drawer.
- **768px** (tablet): Two-column where appropriate. Hero text 80% of desktop. Features 2-col grid.
- **1280px** (desktop): Full layout. Max content width `1200px` centered.

## Section Architecture

Every landing page has these sections in this order. Content adapts to the product. Structure never changes.

### A. NAVBAR — "The Floating Island"
Fixed pill-shaped container, horizontally centered, `top-4`.
- **Morphing:** Transparent + light text at hero top. Scrolls past hero → `bg-background/60 backdrop-blur-xl` with `border` and primary text. Use `IntersectionObserver`.
- Contains: Logo (brand name as styled text — no image), 3-4 nav links (scroll anchors), CTA button (accent).

### B. HERO — "The Opening Shot"
`min-h-dvh`. The preset determines the hero type (see preset generator).
- **Typography:** Massive scale contrast. Line 1 in bold sans (heading font). Line 2 in serif/display italic (drama font), 3-5x size difference.
- **Animation:** Staggered blur-fade-up (y: 40→0, opacity: 0→1, filter: blur(10px)→blur(0)) for text + CTA.
- CTA uses accent color. Secondary CTA optional (ghost button).

### C. SOCIAL PROOF — "The Trust Signal"
Horizontal marquee of brand logos/names. Monospace label: "Trusted by X+ [audience]".
- Logos in muted color, full color on hover.
- If no real logos: use industry-relevant placeholder names in monospace.

### D. PROBLEM — "The Pain Mirror"
3 pain scenarios as cards. Each card: icon (Lucide), title (bold), description (2 lines).
- **Headline pattern:** "Most [audience] struggle with [pain]." or "You [pain verb]. Every [time period]."
- Cards on dark background section. Accent-colored icon.

### E. SOLUTION — "The Shift"
Contrasts the problem. 3-4 steps showing the product's approach.
- **Pattern:** Step number (monospace, accent color) + title + one sentence.
- Optional: AnimatedBeam connecting the steps to show flow.

### F. FEATURES — "Interactive Functional Artifacts"
3 cards derived from the product's key value propositions. Each card must feel like a **functional software micro-UI**, not a static marketing card. Pick interaction patterns from the library below.

**Interaction Pattern Library (pick 3 different ones per landing page):**

1. **"Diagnostic Shuffler"** — 3 overlapping cards that cycle vertically every 3s with spring-bounce transition. Labels from value prop sub-points.
2. **"Telemetry Typewriter"** — Monospace live-text feed typing messages character-by-character with blinking accent cursor. "Live Feed" label with pulsing dot.
3. **"Cursor Protocol"** — Animated SVG cursor enters, moves to a UI element, clicks (scale press), activates it (accent highlight), then moves to next element. Demonstrates a workflow.
4. **"Metric Ticker"** — Numbers counting up with easing to final value. Sparkline chart animating in beside them. Data labels in monospace.
5. **"Code Preview"** — Syntax-highlighted code block that types itself out, showing the developer experience. Terminal-style with accent-colored keywords.
6. **"Before/After Slider"** — Draggable divider showing the "without" vs "with" state. Visual proof.
7. **"Mini Dashboard"** — A small, functional-looking UI panel with animated chart, status indicators, and data. Shows the product's output.
8. **"Notification Stream"** — AnimatedList of notification-style items appearing one by one, showing what the product does in real-time.

All feature cards: `bg-card` surface, subtle border, `rounded-[2rem]`, shadow. Heading (sans bold) + brief descriptor + interactive element.

### G. PHILOSOPHY — "The Manifesto"
Full-width section, dark background.
- Parallaxing texture image at low opacity behind text.
- **Typography:** Two contrasting statements:
  - "Most [industry] focuses on: [common approach]." — neutral, smaller text.
  - "We [differentiated approach]." — massive drama serif italic, accent-colored keyword.
- Word-by-word or line-by-line entrance animation on scroll.

### H. TESTIMONIALS — "Social Proof Deep"
Quote cards in a grid or marquee. Each: quote text, name, role, optional avatar.
- If no real testimonials: use realistic synthetic ones matching the personas from discovery.
- Cards have subtle left border in accent color.

### I. PRICING (if applicable)
Three-tier grid. Middle card pops: accent background, larger scale or ring border.
- If no pricing: convert to a single large CTA section.
- Feature lists use checkmarks (Lucide Check icon) in accent color.

### J. FAQ
Accordion with 5-7 objection-handling Q&As.
- Derived from competitor research (what users complain about) + product-specific concerns.
- Clean expand/collapse with height animation.

### K. FINAL CTA + FOOTER
- CTA headline echoes hero promise in different words. Single button. Reassurance line below.
- Footer: deep dark background, `rounded-t-[3rem]`. Grid: brand + tagline, nav columns, legal.
- **"System Operational" indicator**: pulsing green dot + monospace label (adds polish).

---

## What Designers MUST NOT Do

- No raw Tailwind colors (`text-red-500`). Only design tokens (`text-primary`, `bg-accent`).
- No `--overwrite` on shadcn components.
- No placeholder images. Use Unsplash URLs matching preset's image mood.
- No vague animations ("add smooth transitions"). Every animation has specific easing, duration, stagger.
- No lorem ipsum. Every word is real copy from the copywriter step.
- No flat sections. Every section has texture (noise, gradient, pattern, or image).
