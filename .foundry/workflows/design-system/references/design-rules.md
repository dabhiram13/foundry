# Design Rules

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Non-negotiable rules for every design decision in this project.

## Color Philosophy

**One primary color. That's it.**

- Primary color = the brand. Every accent, link, active state, CTA derives from it.
- Everything else: white, black, grays. Cards can be slightly tinted gray.
- No rainbow. No multi-color palettes. One color, used well.
- OKLCH color space only. Never hex, never HSL in tokens.

## Gradient System

Primary buttons and key CTAs use a gradient, not flat color.

**Pattern:**
```css
/* Add these custom vars to :root */
--primary-gradient-from: /* lighter shade of primary */;
--primary-gradient-to: /* darker shade of primary */;
```

**Usage in Tailwind:**
```
bg-gradient-to-br from-[var(--primary-gradient-from)] to-[var(--primary-gradient-to)]
```

- Direction: `to-br` (bottom-right) is the default
- "From" = lighter/brighter shade of primary
- "To" = deeper/darker shade of primary
- Both shades stay in the same hue family as `--primary`
- Dark mode: same gradient, may need slight lightness adjustment

## Shadow System

Shadows are large but very transparent — elements float without heaviness.

**Philosophy:** Use high shadow tokens (`shadow-xl`) at low opacity rather than small shadows at high opacity. This gives a refined, airy feel.

**Light mode shadow tint:** `hsl(220 40% 15%)` — blue-gray, subtle
**Dark mode shadow tint:** `hsl(0 0% 0%)` — pure black

| Token | Opacity Range | Use |
|-------|---------------|-----|
| `--shadow-2xs` | 3-4% | Barely visible |
| `--shadow-xs` | 4-5% | Inputs |
| `--shadow-sm` | 5-6% | Button pressed, small elements |
| `--shadow` | 6-8% | Plain button shadow |
| `--shadow-md` | 8-10% | Standard cards, dropdowns |
| `--shadow-lg` | 10-12% | Nested elements on cards (icon boxes, inner panels) |
| `--shadow-xl` | 12-14% | **Cards default** — large shadow, very transparent = floating feel |
| `--shadow-2xl` | 16-18% | Modals, hero elements |

**Card shadow behavior:**
- Default: `shadow-xl` — large spread, low opacity (floating, not heavy)
- Hover (if interactive): `shadow-2xl`
- Card also gets a subtle top-down gradient tint (see Card Gradient below)

**Button shadow behavior:**
- Default state: plain `shadow` — minimal depth
- Hover state: `shadow-md`
- Active/pressed: `shadow-sm` (pressed in)
- Primary buttons rely on gradient color for visual weight, not shadow

**Nested elements on cards (icon boxes, badges):**
- `shadow-lg` at very low opacity — just enough lift to separate from card surface

## Card Gradient & Border Tint

Cards get a barely-there wash of the primary color to feel cohesive with the brand.

**Pattern:**
```
bg-gradient-to-b from-[oklch(0.97_0.01_var(--primary-hue)_/_0.5)] to-white
```

This is NOT a colored card — it's a tinted white card. The gradient:
- Direction: `to-b` (top to bottom)
- "From" = primary color family at very high lightness (~97%), 50% opacity
- "To" = white
- Result: a whisper of color at the top that fades to clean white

**Card border:** Faintly tinted with primary instead of plain gray.
```
border-[oklch(0.92_0.02_var(--primary-hue))]
```

**Dark mode:** Gradient inverts — subtle primary tint fading into the dark card background.

**Implementation:** These card gradient/border values should be defined as CSS custom properties in `:root` and `.dark`, then used via the card component. This keeps them in one place.

## globals.css Rules

**NEVER change variable names.** Only change values.

The structure is:
1. `:root` block — light mode values
2. `.dark` block — dark mode values
3. `@theme inline` block — maps vars to Tailwind `--color-*` namespace
4. `@layer base` — base styles

The `@theme inline` block and `@layer base` block should NEVER be modified unless adding new custom vars. All color changes happen in `:root` and `.dark`.

## Component Rules

**Buttons:**
- Default variant = primary gradient (not flat `bg-primary`)
- Plain `shadow` default → `shadow-md` hover → `shadow-sm` active
- Transition on shadow + transform (slight lift on hover)
- Buttons rely on gradient color for visual weight — shadow is subtle, not heavy
- Destructive variant stays flat red (no gradient)
- Ghost/outline/link variants stay as-is (no gradient, no shadow)

**Cards:**
- `shadow-xl` default (large shadow, low opacity = floating feel)
- Subtle top-down gradient: primary tint fading to white (barely visible)
- Border: faintly tinted with primary (not plain gray)
- Interactive cards get `shadow-2xl` on hover
- Background: gradient from primary-tinted to white (NOT flat `bg-card`)

**Nested elements on cards (icon boxes, badges, inner panels):**
- `shadow-lg` at very low opacity — just enough to lift off card surface

**Hover states:**
- Buttons: gradient brightens slightly + shadow grows to `shadow-md` + subtle translateY(-1px)
- Cards: shadow grows to `shadow-2xl`
- Links: color transition to primary

## Banned

| Pattern | Why |
|---------|-----|
| Raw palette colors (`bg-blue-500`, `text-red-600`) | Use semantic tokens |
| Multiple accent colors | One primary color only |
| Flat buttons with no shadow | Buttons need at least plain shadow |
| Cards with no shadow | Cards need `shadow-xl` (low opacity) for floating feel |
| Heavy opaque shadows on cards | Use large shadow at low opacity instead |
| Cards with flat `bg-card` only | Cards should have subtle primary gradient tint |
| Cards with plain gray border | Card border should be faintly tinted with primary |
| HSL/hex in token values | OKLCH only |
| Changing `--variable-name` | Only change values |
| Inline color values in components | Use token classes |
