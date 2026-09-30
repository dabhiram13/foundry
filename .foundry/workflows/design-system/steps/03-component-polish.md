# Step 3: Component Polish

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Update Button and Card components to use the gradient, shadow, and card tint system. These are the two most-used components — getting them right sets the standard for everything else.

## Pre-read

- `references/design-rules.md` — button, card, and shadow rules
- `webapp/components/ui/button.tsx` — current button
- `webapp/components/ui/card.tsx` — current card

## Button Updates

Edit `webapp/components/ui/button.tsx`:

**Default variant** — primary gradient, minimal shadow (gradient does the visual work):
```
"bg-gradient-to-br from-primary-gradient-from to-primary-gradient-to text-primary-foreground shadow hover:shadow-md hover:-translate-y-0.5 active:shadow-sm active:translate-y-0 transition-all duration-200"
```

Key changes:
- Gradient background instead of flat
- Plain `shadow` default → `shadow-md` on hover (NOT heavy `shadow-lg`)
- Subtle lift on hover (`-translate-y-0.5`)
- Press down on active (`translate-y-0`, `shadow-sm`)
- Smooth transition on all (shadow + transform)

**Destructive variant** — keep flat, light shadow:
```
"bg-destructive text-destructive-foreground shadow hover:shadow-md hover:bg-destructive/90 active:shadow-sm transition-all duration-200"
```

**Outline variant** — minimal shadow:
```
"border border-input bg-background shadow-sm hover:shadow hover:bg-accent hover:text-accent-foreground transition-all duration-200"
```

**Secondary variant** — light shadow:
```
"bg-secondary text-secondary-foreground shadow hover:shadow-md hover:bg-secondary/90 transition-all duration-200"
```

**Ghost and Link** — no shadow changes (they're intentionally flat).

## Card Updates

Edit `webapp/components/ui/card.tsx`:

Replace current shadow and add the subtle primary gradient tint:
```
// Old
"rounded-xl border bg-card text-card-foreground shadow"

// New
"rounded-xl border-card-border-tint bg-gradient-to-b from-card-gradient-from to-card-gradient-to text-card-foreground shadow-xl transition-shadow duration-200"
```

Key changes:
- `shadow-xl` (large spread, low opacity = floating feel, NOT heavy)
- Subtle top-down gradient: primary tint fading to white (barely visible wash of brand color)
- Border: faintly tinted with primary instead of plain gray
- `transition-shadow` for smooth hover effects

For interactive cards (links, clickable), consumers add: `hover:shadow-2xl cursor-pointer`

### Why shadow-xl and not shadow-md?

The shadow values defined in Step 2 have very low opacity (10% for `shadow-xl` in light mode). A large shadow at low opacity looks refined and airy. A small shadow at high opacity looks dated. This matches the reference pattern where `shadow-xl shadow-opacity-10` gives cards a floating feel without heaviness.

## Nested Elements on Cards

When building elements that sit inside cards (icon boxes, avatar containers, inner panels), use:
```
shadow-lg
```

This is even subtler than the card shadow (5% opacity at the `shadow-lg` level) — just enough to lift the element off the card surface. See the icon box pattern from the reference:
```tsx
<div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-lg">
  <Icon className="w-7 h-7" />
</div>
```

## Focus Rings

Inputs should use the primary color family for focus rings:
```
focus:ring-2 focus:ring-ring
```

The `--ring` token is already mapped to the primary color family in Step 2.

## Other Components to Check

After button and card, scan these for shadow/transition consistency (fix only if they exist):
- `webapp/components/ui/dialog.tsx` — modal overlay should use `shadow-2xl`
- `webapp/components/ui/popover.tsx` — dropdown should use `shadow-xl`
- `webapp/components/ui/dropdown-menu.tsx` — should use `shadow-xl`
- `webapp/components/ui/tooltip.tsx` — should use `shadow-md`

Don't modify if they don't exist yet. Only update what's there.

## Done when

- Button default variant uses primary gradient + plain `shadow` (not heavy)
- Card has `shadow-xl` (low opacity floating feel) + subtle primary gradient tint + tinted border
- Nested card elements use `shadow-lg` pattern documented
- `npx tsc --noEmit` passes
- No raw color classes in modified components
