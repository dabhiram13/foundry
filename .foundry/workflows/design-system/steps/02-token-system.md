# Step 2: Token System

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Define all color values, gradient vars, and shadow values in `webapp/app/globals.css`. Only change values, NEVER variable names.

## Pre-read

- `references/design-rules.md` — mandatory rules
- `webapp/app/globals.css` — current structure (the template)

## Color Generation

### Primary color (OKLCH)

From Step 1's hue direction, generate the primary at roughly:
- Lightness: 0.55–0.70 (vibrant but readable)
- Chroma: 0.12–0.18 (saturated but not neon)
- Hue: from brand analysis

Then derive everything else:

| Token | Derivation |
|-------|-----------|
| `--primary` | The chosen primary color |
| `--primary-foreground` | White (`oklch(1.0 0 0)`) — text on primary |
| `--secondary` | Near-black with slight primary hue tint |
| `--secondary-foreground` | White |
| `--accent` | Very light tint of primary (95%+ lightness) |
| `--accent-foreground` | Primary color itself |
| `--muted` | Neutral gray, barely tinted |
| `--muted-foreground` | Mid-gray |
| `--background` | White (light) / Near-black (dark) |
| `--foreground` | Near-black (light) / Near-white (dark) |
| `--card` | Slightly off-white, barely tinted (light) / Dark gray (dark) |
| `--border` | Light gray with slight primary tint |
| `--input` | Very light, almost white |
| `--ring` | Close to primary (focus rings) |
| `--destructive` | Red — keep as-is or adjust to match vibe |
| `--success` | Green — keep as-is |
| `--warning` | Amber/yellow — keep as-is |

### Sidebar tokens

Mirror the main tokens but for sidebar context:
- `--sidebar` = matches `--card` or slightly darker
- `--sidebar-primary` = matches `--primary`
- `--sidebar-accent` = matches `--accent`
- `--sidebar-border` = matches `--border` or slightly more visible

### Chart tokens

Keep the existing 5 chart colors or adjust to harmonize with the new primary. Chart colors CAN be multi-color (they need to be distinguishable).

## Gradient Variables

Add these custom variables inside `:root` (and `.dark`):

```css
--primary-gradient-from: /* primary at +0.08 lightness (brighter) */;
--primary-gradient-to: /* primary at -0.08 lightness (deeper) */;
```

And register them in `@theme inline`:
```css
--color-primary-gradient-from: var(--primary-gradient-from);
--color-primary-gradient-to: var(--primary-gradient-to);
```

**Rule:** Both gradient stops stay in the same hue family as `--primary`. Only lightness changes.

## Shadow Values

Replace the current zero-opacity shadows with real values. Key principle: **large shadows at low opacity** — elements float without heaviness.

Cards use `shadow-xl` (big spread, ~10% opacity) for a refined floating feel. Buttons use plain `shadow` (minimal depth — the gradient does the visual work).

**Light mode** — tint: primary-influenced blue-gray
```css
--shadow-2xs: 0 1px 2px 0 hsl(220 40% 15% / 0.03);
--shadow-xs: 0 2px 4px 0 hsl(220 40% 15% / 0.04);
--shadow-sm: 0 2px 4px -1px hsl(220 40% 15% / 0.05), 0 4px 6px -1px hsl(220 40% 15% / 0.03);
--shadow: 0 4px 8px -2px hsl(220 40% 15% / 0.06), 0 2px 4px -1px hsl(220 40% 15% / 0.03);
--shadow-md: 0 6px 12px -3px hsl(220 40% 15% / 0.08), 0 4px 6px -2px hsl(220 40% 15% / 0.04);
--shadow-lg: 0 12px 20px -4px hsl(220 40% 15% / 0.05), 0 4px 8px -2px hsl(220 40% 15% / 0.03);
--shadow-xl: 0 20px 30px -5px hsl(220 40% 15% / 0.10), 0 8px 10px -3px hsl(220 40% 15% / 0.04);
--shadow-2xl: 0 28px 40px -6px hsl(220 40% 15% / 0.14), 0 12px 16px -4px hsl(220 40% 15% / 0.05);
```

**Dark mode** — tint: pure black, higher opacity
```css
--shadow-2xs: 0 1px 2px 0 hsl(0 0% 0% / 0.12);
--shadow-xs: 0 2px 4px 0 hsl(0 0% 0% / 0.15);
--shadow-sm: 0 2px 4px -1px hsl(0 0% 0% / 0.20), 0 4px 6px -1px hsl(0 0% 0% / 0.12);
--shadow: 0 4px 8px -2px hsl(0 0% 0% / 0.22), 0 2px 4px -1px hsl(0 0% 0% / 0.12);
--shadow-md: 0 6px 12px -3px hsl(0 0% 0% / 0.28), 0 4px 6px -2px hsl(0 0% 0% / 0.15);
--shadow-lg: 0 12px 20px -4px hsl(0 0% 0% / 0.18), 0 4px 8px -2px hsl(0 0% 0% / 0.10);
--shadow-xl: 0 20px 30px -5px hsl(0 0% 0% / 0.30), 0 8px 10px -3px hsl(0 0% 0% / 0.15);
--shadow-2xl: 0 28px 40px -6px hsl(0 0% 0% / 0.40), 0 12px 16px -4px hsl(0 0% 0% / 0.20);
```

## Card Gradient & Border Tokens

Add these custom variables to `:root` and `.dark` for the card's subtle primary tint:

```css
/* :root */
--card-gradient-from: /* primary at ~97% lightness, 50% opacity — barely visible */;
--card-gradient-to: oklch(1.0 0 0); /* white */
--card-border-tint: /* primary at ~92% lightness, low chroma — faint color */;

/* .dark */
--card-gradient-from: /* primary at ~15% lightness, 30% opacity */;
--card-gradient-to: var(--card); /* dark card background */
--card-border-tint: /* primary at ~25% lightness, low chroma */;
```

Register in `@theme inline`:
```css
--color-card-gradient-from: var(--card-gradient-from);
--color-card-gradient-to: var(--card-gradient-to);
--color-card-border-tint: var(--card-border-tint);
```

These tokens keep card styling centralized — the card component references them, individual features don't hardcode tint values.

## Radius

Adjust `--radius` if Step 1 decided to change it. Otherwise keep `1.3rem`.

## Write

Edit `webapp/app/globals.css`:
1. Update all OKLCH color values in `:root`
2. Update all OKLCH color values in `.dark`
3. Add `--primary-gradient-from` and `--primary-gradient-to` to both `:root` and `.dark`
4. Replace all shadow values in both `:root` and `.dark`
5. Add gradient color mappings to `@theme inline`
6. Do NOT touch `@theme inline` color mappings (they reference vars, not values)
7. Do NOT touch `@layer base`
8. Do NOT touch `@keyframes` or `--animate-*`

## Done when

- `globals.css` has real shadow values (not zero-opacity)
- Gradient variables exist in both light and dark
- All colors are OKLCH
- Variable names are unchanged
- `npm run build` passes (no CSS errors)
