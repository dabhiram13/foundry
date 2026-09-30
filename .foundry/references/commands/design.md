<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: design
description: Tune the brand design system — design tokens and branded shadcn components; changes cascade app-wide.
---

# /design — Brand Design System Tuner

Specialized design agent that tunes design tokens and crafts branded UI components. Changes cascade app-wide.

---

## Orchestration Flow

### Phase 1: Load Context

Read the full design foundation:

```
webapp/app/globals.css                          — current token values (light + dark)
.foundry/references/source-docs/patterns/frontend/tailwind-v4.md           — token pipeline, semantic classes, banned patterns
.foundry/references/source-docs/patterns/frontend/component-catalog.md     — available components + interactions
docs/project/brand-guidelines.md                — brand voice, personality, visual identity
docs/project/product-overview.md                — what the product is (context for palette choices)
```

List all current shadcn/ui components:
```bash
ls webapp/components/ui/
```

### Phase 2: Run Design Intelligence

Generate a design system recommendation:

```bash
python3 library/skills/ui-ux-pro-max/scripts/search.py "<product_type> <brand_keywords>" --design-system -p "<project_name>"
```

Supplement with domain searches as needed:
```bash
python3 library/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain color
python3 library/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain typography
python3 library/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain style
```

### Phase 3: Ask the User

Present a **design brief** before touching any code:

```
## Design Brief

**Direction:** {aesthetic direction — e.g. "warm minimal", "bold industrial", "refined luxury"}
**Palette mood:** {description of color feeling}
**Key changes:**
- Primary: oklch(current) → oklch(proposed) — {why}
- Background: oklch(current) → oklch(proposed) — {why}
- Accent: oklch(current) → oklch(proposed) — {why}
- Gradients: {proposed gradient tokens if applicable}
- Shadows: {any shadow depth changes}

**Component upgrades:** {which ui/ components will be enhanced and how}

Approve? Or adjust the direction?
```

**DO NOT modify any file until the user approves the brief.**

### Phase 4: Tune Design Tokens

Edit `webapp/app/globals.css` — change **VALUES ONLY**, never names or structure.

**What you CAN change:**
- oklch values for any existing CSS custom property in `:root` and `.dark`
- Shadow values (`--shadow-*`)
- Radius value (`--radius`)
- Gradient token values (`--primary-gradient-from`, `--primary-gradient-to`, etc.) if they exist

**What you MUST NOT change:**
- Variable names (no renaming `--primary` to `--brand`)
- Structure (`@theme inline`, `@layer base`, `@import` lines)
- Adding new variables (the token names are the contract)
- Removing variables
- The `@theme inline` mappings (they map names → names, never change)

**Both modes are mandatory.** Every `:root` change MUST have a corresponding `.dark` change. Light and dark must be a cohesive pair, not an afterthought.

**Color science rules:**
- All colors MUST be oklch() — never hex, rgb, hsl
- Contrast ratios: foreground/background pairs MUST hit 4.5:1 minimum (WCAG AA)
- Primary-foreground must be legible on primary background
- Card-foreground must be legible on card background
- Test mentally: would muted-foreground disappear on muted background?

### Phase 5: Craft Branded Components

Enhance components in `webapp/components/ui/` to express the brand. These are used everywhere — changes here cascade across the entire app.

**Skills to load:**
- `frontend-design` — creative direction, aesthetic choices
- `ui-ux-pro-max` — design intelligence, palette reasoning

**What you CAN do:**
- Add/modify hover states, transitions, focus rings
- Adjust internal spacing, border-radius usage, shadow application
- Add subtle gradient backgrounds using design tokens (`bg-gradient-to-r from-[var(--primary-gradient-from)] to-[var(--primary-gradient-to)]`)
- Enhance visual weight hierarchy (e.g., bolder primary buttons, subtler secondary)
- Add micro-interactions (transform on hover, opacity transitions)
- Adjust typography weight/size within components

**What you MUST NOT do:**
- Change component APIs (props, exports, function signatures)
- Break existing usage — every current import must still work identically
- Use raw colors (`text-red-500`, `bg-white`, `bg-gray-*`) — tokens ONLY
- Use `hsl(var(--foo))` — tokens are oklch, use `var(--foo)` or Tailwind classes
- Add `--overwrite` to shadcn installs
- Remove existing functionality

**Component enhancement order (highest impact first):**
1. `button.tsx` — primary interaction, sets the brand tone
2. `card.tsx` — most used surface, defines spatial feeling
3. `badge.tsx` — status communication, color expression
4. `input.tsx` / `textarea.tsx` — form personality
5. `dialog.tsx` / `sheet.tsx` / `drawer.tsx` — overlay surfaces
6. `tabs.tsx` / `toggle.tsx` — navigation micro-interactions
7. Everything else — as needed

### Phase 6: Verify

```bash
cd webapp && npx tsc --noEmit
```

Must pass. Fix up to 3 cycles.

Check for banned patterns:
```bash
cd webapp && grep -rn "text-red-\|bg-white\|bg-gray-\|text-gray-\|hsl(var" components/ui/ || echo "CLEAN"
```

Must output CLEAN.

Visual smoke test — verify both modes work:
```bash
cd webapp && npm run dev
```

Report to user:
```
## Design Changes Applied

**Tokens changed:** {count} variables across light + dark
**Components enhanced:** {list}
**Direction:** {aesthetic summary}

### Token Diff
| Token | Light (before → after) | Dark (before → after) |
|-------|------------------------|----------------------|
| --primary | oklch(...) → oklch(...) | oklch(...) → oklch(...) |
| ... | ... | ... |

### Component Changes
- button.tsx: {what changed and why}
- card.tsx: {what changed and why}
- ...

Check the running dev server. Toggle dark mode. Review across pages.

- "Looks good" — done
- "Adjust X" — I'll refine
- "Revert" — I'll restore previous values
```

---

## Quality Bar

Read `.foundry/philosophy/visual.md` before the first change. It is the judgment — hierarchy first, one colour used well, both modes equally intentional, this product's identity not any product's — and its counterexamples are the banned list. If the output would read as "any AI app", it failed.

**COLOR CRAFT:**
- Dominant + sharp accent outperforms evenly-distributed palettes
- Gradients must be subtle and purposeful, not decorative noise
- Shadow depth should match the surface hierarchy (cards lift more than backgrounds)
- Border tints can carry brand color at low opacity for cohesion

**COMPONENT CRAFT:**
- Every interactive element needs a hover state with `transition-all duration-200`
- Focus rings must use `ring-ring` token
- Buttons should feel tactile (subtle transform, shadow shift on press)
- Cards should have depth (shadow + border + optional gradient)
- Surfaces should breathe — varied spacing creates rhythm

**MOBILE RESPONSIVENESS:**
- Token changes are inherently responsive (they apply everywhere)
- Component enhancements must work at 375px, 768px, 1280px
- Touch targets minimum 44px
- No hover-only states — touch devices need visible affordances

## Error Recovery

- tsc fails → fix type errors, re-run
- Component breaks existing usage → revert that component, try less invasive approach
- Colors look wrong in one mode → check both `:root` and `.dark` have matching overrides
- Contrast too low → bump foreground lightness up (dark mode) or down (light mode)

## Key Constraints

- DO NOT change token names — only values
- DO NOT break component APIs — only enhance visuals
- DO NOT modify globals.css structure — only oklch/shadow/radius values
- DO NOT skip dark mode — every light change needs a dark companion
- DO NOT apply changes without user approval of the design brief
- The user decides the direction — you provide expertise and execution
