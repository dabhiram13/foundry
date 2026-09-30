# Component Catalog — Landing Page Inspiration

Reference for landing page designers. Components already installed, ready to compose.

## Hero Components

### AnimatedGridPattern (`@/components/ui/animated-grid-pattern`)
Subtle animated grid background. Current landing page hero uses it behind gradient.
**Best for:** Tech/SaaS hero sections. Clean, modern feel. Pairs with gradient overlays.

### HeroSectionWithGradient (`@/components/ui/hero-section-with-gradient`)
Full hero block with GSAP-animated gradient blob, blur-in text, and motion transitions.
**Best for:** Bold, high-energy hero. Agency/startup vibe. Uses framer-motion + GSAP.

### SplashCursor (`@/components/shadcn-space/animations/splash-cursor`)
WebGL fluid simulation that follows the cursor. Colorful ink-splash effect.
**Best for:** Creative/artistic hero. Very interactive. Desktop-only (falls back gracefully on mobile).

### LightRays (`@/components/ui/light-rays`)
Animated light ray beams emanating from a point. Motion-based.
**Best for:** Dramatic dark-mode hero. Product launch energy. Pairs with centered text.

### Particles (`@/components/ui/particles`)
Floating particle field. Configurable density, color, connections.
**Best for:** Abstract/tech backgrounds. Can go behind any section, not just hero.

### DotPattern (`@/components/ui/dot-pattern`)
Subtle repeating dot grid. Already used in solution section.
**Best for:** Clean backgrounds that need texture without distraction.

---

## Card Components

### MagicCard (`@/components/ui/magic-card`)
Card with gradient spotlight that follows the mouse cursor. Glowing border effect.
**Best for:** Feature cards, pricing cards, testimonials. Makes any card feel premium.

### BentoGrid + BentoCard (`@/components/ui/bento-grid`)
Asymmetric grid layout with variable card sizes. Each card takes a background ReactNode.
**Best for:** Feature showcase. Replace the linear feature list with a visual bento layout.

### HoverCard (`@/components/ui/hover-card`)
Card with rich hover preview popup.
**Best for:** Team sections, partner logos with detail on hover.

---

## Button & CTA Components

### ShimmerButton (`@/components/ui/shimmer-button`)
Button with animated shimmer/shine effect across its surface.
**Best for:** Primary CTA. "Start building" or "Get started" — draws the eye.

### RainbowButton (`@/components/ui/rainbow-button`)
Button with animated rainbow gradient border.
**Best for:** Playful/creative CTAs. Stand out from standard primary buttons.

---

## Animation Components

### BlurFade (`@/components/ui/blur-fade`)
Entrance animation: elements blur-in and fade up on scroll/mount.
**Best for:** Every section. Standard entrance animation for this project.

### Marquee (`@/components/ui/marquee`)
Infinite horizontal or vertical scrolling content.
**Best for:** Social proof bars, testimonials, brand logos, partner showcases.

### AnimatedList (`@/components/ui/animated-list`)
List items that animate in one-by-one with stagger.
**Best for:** Notification demos, activity feeds, feature lists that reveal progressively.

### AnimatedBeam (`@/components/ui/animated-beam`)
Animated connection lines between elements (like data flowing between nodes).
**Best for:** "How it works" sections showing data flow, integrations, pipeline visualization.

---

## Background Components

### Highlighter (`@/components/ui/highlighter`)
Text highlighting effect with animated color sweep.
**Best for:** Emphasizing key phrases in headlines or testimonials.

---

## Block Templates

### ShadcnSpace Hero-01 (`@/components/shadcn-space/blocks/hero-01/`)
Complete hero block: floating header + splash cursor hero + brand slider.
**Includes:** Header with nav, hero with Instrument Serif italic font, avatar stack, brand logo marquee.
**Best for:** Agency/creative landing. Very different feel from current marketing hero.

---

## Components to Install (Not Yet in Project)

These can be added via `npx shadcn@latest add` or npm. DO NOT use `--overwrite`.

### react-bits LightRays (`@react-bits/LightRays-JS-CSS`)
```bash
npx shadcn@latest add @react-bits/LightRays-JS-CSS
```
Animated light ray effect. Check if it overlaps with existing `light-rays.tsx` — if different, install under a new name.

### Suggested New Imports for Variant Agents

| Component | Source | Good For |
|-----------|--------|----------|
| `globe` | magic-ui | Hero background — rotating 3D globe |
| `orbiting-circles` | magic-ui | "How it works" — elements orbiting center |
| `retro-grid` | magic-ui | Retro/synthwave background pattern |
| `ripple` | magic-ui | Subtle ripple animation behind CTA |
| `border-beam` | magic-ui | Animated border beam on cards |
| `meteors` | magic-ui | Falling meteor animation for dark sections |
| `number-ticker` | magic-ui | Animated counting numbers for stats |
| `text-reveal` | magic-ui | Text that reveals on scroll |
| `typing-animation` | magic-ui | Typewriter effect for hero headlines |
| `word-rotate` | magic-ui | Rotating words in headlines ("Build X / Ship X / Scale X") |

Install pattern:
```bash
npx shadcn@latest add "https://magicui.design/r/globe"
npx shadcn@latest add "https://magicui.design/r/orbiting-circles"
```

---

## Section Composition Ideas

### Hero Variations
| Style | Background | Text | CTA | Vibe |
|-------|-----------|------|-----|------|
| Current | AnimatedGridPattern + gradient | BlurFade H1 | Standard Button | Clean SaaS |
| Agency | SplashCursor | Instrument Serif italic | Button + avatar stack | Creative/bold |
| Dramatic | LightRays or Particles | Large centered text | ShimmerButton | Dark/premium |
| Playful | Retro grid or gradient blob | Word-rotate headline | RainbowButton | Fun/approachable |

### Feature Section Variations
| Style | Layout | Cards | Animation |
|-------|--------|-------|-----------|
| Current | Sticky-stacking full-screen | Text + mockup | Scroll-triggered |
| Bento | BentoGrid asymmetric | BentoCard with backgrounds | BlurFade stagger |
| Cards | 3-column grid | MagicCard with spotlight | Hover effects |
| Flow | AnimatedBeam connections | Node-based diagram | Data flow animation |

### Social Proof Variations
| Style | Layout | Animation |
|-------|--------|-----------|
| Current | Marquee horizontal | Infinite scroll |
| Stats | Number tickers + logos | Count-up animation |
| Testimonial wall | Masonry grid | BlurFade stagger |
| Video testimonials | Carousel | Play on hover |

### Pricing Variations
| Style | Cards | Highlight |
|-------|-------|-----------|
| Current | 3-column grid | Middle card elevated |
| Magic | MagicCard per tier | Gradient spotlight on popular |
| Toggle | Monthly/yearly toggle | AnimatedList features |
| Comparison | Table layout | Highlighted row |
