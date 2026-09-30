# Visual Quality Pattern — Design Excellence

> Designer: read this BEFORE writing any component. This is your quality bar.

## The Problem

AI-generated UI defaults to the minimum: `h1 + p + grid of cards`. No visual density, no polish, no soul.
This pattern defines what "good" looks like so every page feels crafted, not generated.

## Design Principles

### 1. Full-Bleed Over Contained
- Tool/app pages (maps, editors, dashboards): fill the viewport. No `max-w-3xl mx-auto`.
- Use floating toolbars with `bg-background/80 backdrop-blur-sm` over full-bleed content.
- Content pages (articles, settings): contained is fine.

### 2. Visual Density Over Whitespace
- Every card should show 3+ pieces of information (title, status badge, metadata, progress, count).
- Avoid cards that are just `title + subtitle`. Add: icon, badge, timestamp, metric, progress bar.
- Group related metadata on one line with `flex items-center gap-1.5 text-xs text-muted-foreground`.

### 3. Layered Visual Hierarchy
- Don't rely on font size alone. Use: background tints, borders, badges, icons, opacity changes.
- Status should be communicated through color AND shape AND text (not just one).
- Example: completed = green border + green bg tint + checkmark icon + "Done" badge.

### 4. Micro-Interactions Everywhere
- Every clickable element: `transition-all duration-200` + hover state change.
- Cards: `hover:shadow-md` or `hover:border-primary/50` or `group-hover:scale-105`.
- Buttons in context: show on hover with `opacity-0 group-hover:opacity-100`.
- Status transitions: `transition-colors duration-300` for color changes.

### 5. Component Richness
- Nodes/cards should have: outer container + icon area + content area + metadata row + badge.
- Not just: `<div class="border p-4"><h3>Title</h3><p>Description</p></div>`.
- Think in terms of composition layers, not flat structures.

## Page Type Recipes

### Canvas/Map Pages (React Flow, editors, builders)
```
Layout: full viewport height, no scroll on main container
Top bar: floating, backdrop-blur, compact (py-2), shows title + badge + progress inline
Canvas: flex-1, fills remaining space
Controls: floating panels (minimap, zoom, toolbar) positioned with absolute/fixed
Nodes: rich cards with icon circles, status badges, step numbers, hover effects
Modals: slide-over or dialog for detail views (not inline expansion)
```

### Dashboard Pages
```
Layout: contained (max-w-6xl) with generous padding
Header: stats bar with 3-4 key metrics in a grid, not just h1+p
Segmentation: tabs or filter chips for status groups (active/completed/archived)
Cards: show progress bar, status badge, last activity, quick actions
Grid: responsive (1-col mobile, 2-col tablet, 3-col desktop)
Empty: illustration + motivational copy + primary CTA
```

### List Pages
```
Layout: contained with filter bar
Header: title + count badge + primary CTA button, not just h1+p
Filters: sticky filter bar with search input + category tabs/chips
Cards: image/icon + title + 2-3 metadata items + price/action
Featured: first item or hero card gets larger treatment
Pagination: infinite scroll with sentinel or numbered pages
```

### Detail Pages
```
Layout: contained, possibly with sticky sidebar
Hero: gradient/colored header area with title, badges, key stats
Sections: visually separated with alternating backgrounds or card groups
Actions: sticky bottom bar (mobile) or sidebar section (desktop)
Navigation: breadcrumbs at top, related items at bottom
```

## Node/Card Design Template

When building custom nodes or rich cards, follow this structure:

```
Outer container:
  - rounded-xl border-[1.5px] px-3.5 py-3
  - status-specific: border color, bg tint, hover border, hover shadow
  - transition-all duration-200, cursor-pointer
  - group class for child hover effects

Icon area (left):
  - Fixed size circle/rounded-lg (size-8)
  - Status-colored background + white icon
  - group-hover:scale-110 transition

Content area (middle, flex-1 min-w-0):
  - Title: text-[13px] font-semibold truncate
  - Metadata row: flex items-center gap-1.5
    - Status badge: inline rounded-full px-1.5 py-0.5 text-[10px]
    - Category: text-[10px] text-muted-foreground truncate

Position indicator (corner):
  - Absolute positioned, -top-2 -left-2
  - Small circle with number, bg-background ring-1 ring-border
```

## Color Usage for Status

```
Completed/Success: emerald-500 (border, bg tint, icon bg, badge)
Current/Active: primary (border, bg tint, icon bg, badge)
Locked/Disabled: border/60, muted/30, opacity-55
Warning: amber-500
Error: destructive
```

Always use the pattern: `border-{color}/60 bg-{color}/8 hover:border-{color}` for subtle status tinting.

## Spacing Rhythm

- Between major sections: `space-y-8` or `gap-8`
- Between cards in a grid: `gap-4` or `gap-6`
- Inside cards: `p-3.5` to `p-5` depending on density
- Compact inline elements: `gap-1.5` to `gap-2`
- Text stacks: `gap-0.5` for title+subtitle

## Responsive Breakpoints

- Mobile-first: single column, full-width cards, bottom sheet modals
- sm (640px): 2 columns for cards
- md (768px): sidebar appears, 2-3 columns
- lg (1024px): full layout, 3+ columns
- Canvas pages: always full viewport, controls reposition

## Anti-patterns

The banned list — heading + paragraph + grid, title-only cards, fixed pixel heights, opacity as the only locked cue, confetti in content space, icons in tinted circles, purple gradients, orbs — lives once, as the counterexamples in `.foundry/philosophy/visual.md`. This file is the house conventions; that file is the judgment.
