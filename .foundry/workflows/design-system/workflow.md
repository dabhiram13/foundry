# Design System Workflow

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Establishes the visual foundation for the entire project. Everything visual — landing page, auth pages, dashboard, features — builds on what this workflow produces.

## Inputs

Read these before starting:
1. `docs/project/product-overview.md` — what the product is
2. `docs/project/brand-guidelines.md` — personality, vibe, voice, color direction
3. `docs/project/users-and-journeys.md` — who uses it (affects tone: playful vs. serious)
4. `webapp/app/globals.css` — current token structure (NEVER change variable names)
5. `webapp/app/layout.tsx` — current root layout, fonts
6. `webapp/app/protected/layout.tsx` — current protected area layout

## Outputs

| Output | Location |
|--------|----------|
| Design tokens (colors, shadows, radius) | `webapp/app/globals.css` |
| Gradient + shadow custom vars | `webapp/app/globals.css` |
| Button with gradient variant | `webapp/components/ui/button.tsx` |
| Card with shadow system | `webapp/components/ui/card.tsx` |
| SVG logo | `webapp/public/logo.svg` + `webapp/components/logo.tsx` |
| Layout shell (sidebar or topbar) | `webapp/app/protected/layout.tsx` |
| Design system doc | `docs/design-system.md` |

---

## Steps — Checklist

Read the step file, execute it, mark done, move to next.

- [ ] **Step 1: Brand Analysis** → `steps/01-brand-analysis.md`
  Reads brand docs, determines color direction, vibe, layout type

- [ ] **Step 2: Token System** → `steps/02-token-system.md`
  Defines colors, gradients, shadows → writes globals.css values

- [ ] **Step 3: Component Polish** → `steps/03-component-polish.md`
  Updates button (gradient variant), card (shadow system), hover states

- [ ] **Step 4: Logo** → `steps/04-logo.md`
  Creates SVG logo using svg-logo-designer skill

- [ ] **Step 5: Layout Shell** → `steps/05-layout-shell.md`
  Implements sidebar or topbar in protected layout

- [ ] **Step 6: Document** → `steps/06-document.md`
  Writes docs/design-system.md with token reference + usage rules

- [ ] **Step 7: Verify** → `steps/07-verify.md`
  Dark mode check, visual audit, no raw colors, builds clean

---

## Resume

If resuming mid-workflow, read this checklist. Skip completed steps. Read the next pending step file.

## References

- `references/design-rules.md` — color philosophy, gradient pattern, shadow system, banned patterns
