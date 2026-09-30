# Tailwind CSS v4 — Usage Guide

This project uses **Tailwind CSS v4**. No `tailwind.config.ts` exists. All design tokens live in `webapp/app/globals.css` via `@theme inline`. Read this before writing any styles.

## Semantic Color Tokens (ALWAYS use these)

These are the **only** color classes you should use for UI chrome. They auto-switch between light and dark mode.

| Class | Purpose |
|-------|---------|
| `bg-background` / `text-foreground` | Page background, default text |
| `bg-card` / `text-card-foreground` | Card surfaces |
| `bg-popover` / `text-popover-foreground` | Dropdowns, tooltips, popovers |
| `bg-primary` / `text-primary-foreground` | Primary actions (buttons, links) |
| `bg-secondary` / `text-secondary-foreground` | Secondary actions |
| `bg-muted` / `text-muted-foreground` | Subdued text, disabled states |
| `bg-accent` / `text-accent-foreground` | Hover highlights, active states |
| `bg-destructive` / `text-destructive` | Errors, delete actions |
| `bg-success` / `text-success` | Success messages, confirmations |
| `bg-warning` / `text-warning` | Warning messages, cautions |
| `border-border` | Default border color |
| `bg-input` | Input field backgrounds |
| `ring-ring` | Focus ring color |

### Sidebar tokens
`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-primary`, `bg-sidebar-accent`, `border-sidebar-border`, `ring-sidebar-ring` — use inside sidebar layouts only.

### Chart tokens
`bg-chart-1` through `bg-chart-5` — for data visualizations only.

## Banned Patterns

| Do NOT write | Write instead | Why |
|-------------|---------------|-----|
| `text-red-500`, `text-red-600` | `text-destructive` | Semantic token, dark-mode aware |
| `text-green-500`, `text-green-600` | `text-success` | Semantic token, dark-mode aware |
| `text-yellow-500`, `text-amber-500` | `text-warning` | Semantic token, dark-mode aware |
| `text-gray-500`, `text-slate-500` | `text-muted-foreground` | Matches design system |
| `bg-white` | `bg-background` or `bg-card` | Dark-mode aware |
| `bg-gray-100` | `bg-muted` or `bg-accent` | Dark-mode aware |
| `border-gray-200` | `border-border` | Already applied globally via `* { @apply border-border }` |
| `hsl(var(--foo))` | `var(--foo)` directly | Tokens are oklch, not hsl — wrapping in `hsl()` breaks them |

**Exception:** Categorical colors (e.g., status badges with distinct hues like violet, pink, emerald for different categories) may use Tailwind's built-in palette. These are visual distinctions, not semantic states.

## How the Token Pipeline Works

```
globals.css :root / .dark     →  Raw CSS variables (oklch values)
                                   e.g. --primary: oklch(0.67 0.16 245)
                                        ↓
globals.css @theme inline      →  Maps to Tailwind namespace
                                   e.g. --color-primary: var(--primary)
                                        ↓
Components                     →  Use Tailwind classes
                                   e.g. bg-primary, text-primary-foreground
```

- `:root` defines light mode values, `.dark` overrides for dark mode
- `@theme inline` maps CSS variables → Tailwind utility classes
- Never reference `--color-*` directly in code — use Tailwind classes

## v4 Differences from v3 (Do NOT use v3 patterns)

| v3 pattern (WRONG) | v4 pattern (CORRECT) |
|--------------------|----------------------|
| `tailwind.config.ts` | Deleted — config lives in CSS `@theme` |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| `darkMode: ["class"]` in config | `@custom-variant dark (&:where(.dark, .dark *))` in CSS |
| `tailwindcss-animate` plugin | `tw-animate-css` (CSS import, not JS plugin) |
| `require("tailwindcss-animate")` | `@import "tw-animate-css"` |
| `hsl(var(--primary))` | `var(--primary)` — values are already complete oklch |
| `theme.extend.colors` in JS | `--color-*: var(--*)` in `@theme inline` |
| `content: [...]` in config | Automatic detection in v4 |

## Radius Tokens

| Class | Value |
|-------|-------|
| `rounded-sm` | `calc(var(--radius) - 4px)` |
| `rounded-md` | `calc(var(--radius) - 2px)` |
| `rounded-lg` | `var(--radius)` = `1.3rem` |
| `rounded-xl` | `calc(var(--radius) + 4px)` |

## Animations

Available via `tw-animate-css`:
- `animate-in`, `animate-out` — enter/exit transitions
- `fade-in-0`, `fade-out-0` — opacity transitions
- `zoom-in-95`, `zoom-out-95` — scale transitions
- `slide-in-from-*-2`, `slide-out-to-*-2` — directional slides

Built-in Tailwind:
- `animate-spin`, `animate-pulse`, `animate-bounce`

Custom:
- `animate-caret-blink` — for input-otp component

## Quick Reference: Common Component Patterns

```tsx
// Error message
<p className="text-sm text-destructive">{error}</p>

// Success message
<p className="text-sm text-success">{message}</p>

// Warning message
<p className="text-sm text-warning">{message}</p>

// Muted helper text
<p className="text-sm text-muted-foreground">{hint}</p>

// Card surface
<div className="rounded-lg border bg-card p-4">

// Input-like surface
<div className="rounded-md border bg-input px-3 py-2">

// Primary button (use shadcn Button, but for reference)
<button className="bg-primary text-primary-foreground rounded-md px-4 py-2">

// Destructive action
<button className="bg-destructive text-destructive-foreground rounded-md px-4 py-2">
```
