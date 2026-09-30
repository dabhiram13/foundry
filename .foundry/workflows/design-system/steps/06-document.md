# Step 6: Document

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Write `docs/design-system.md` — the reference for every agent and developer building UI in this project.

## Content

Document what was built. Include:

### Color System
- Primary color value + hue rationale
- Gradient stops (from/to values)
- Full token table: token name → value → usage
- "One primary color" rule explained

### Shadow System
- Shadow scale table: token → size → typical usage
- Button shadow behavior (default → hover → active)
- Card shadow behavior
- Dark mode shadow differences

### Component Patterns
- Button variants: which use gradient, which don't, why
- Card: shadow default, hover behavior for interactive cards
- Links: primary color, transition

### Layout
- Sidebar or topbar — which was chosen, why
- Key components: where logo sits, where nav lives, where user menu is

### Typography
- Font: Geist Sans (or whatever was chosen)
- Radius: value + rationale

### Rules for Future Development
- Always use semantic tokens, never raw palette
- Buttons need shadow + transition
- Cards need shadow-md minimum
- One primary color — don't add accent colors without updating this doc
- Test both light and dark mode

## Format

Concise. Tables over prose. Code examples where helpful. Token-efficient. This doc is read by AI agents — they need facts, not narrative.

## Done when

- `docs/design-system.md` exists
- Covers color, shadow, component, layout, and rules sections
- No placeholder content
