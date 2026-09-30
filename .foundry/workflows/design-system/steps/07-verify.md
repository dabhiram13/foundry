# Step 7: Verify

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Final checks. Everything must pass before this workflow is done.

## Checks

### 1. Build
```bash
cd webapp && npm run build
```
Must pass. Zero errors.

### 2. Type check
```bash
cd webapp && npx tsc --noEmit
```
Must pass. Zero errors.

### 3. No raw colors
```bash
cd webapp && grep -rn "bg-blue\|bg-red\|bg-green\|bg-yellow\|bg-purple\|bg-pink\|bg-orange\|text-blue\|text-red\|text-green" components/ features/ app/ --include="*.tsx" --include="*.ts" || echo "CLEAN"
```
Must output "CLEAN". Exceptions: only in `globals.css` token definitions.

### 4. Shadow system active
Verify `globals.css` shadows have non-zero opacity values. The old shadows were all `0.00` opacity (invisible).

### 5. Gradient variables present
Verify `globals.css` contains these in both `:root` and `.dark`:
- `--primary-gradient-from` and `--primary-gradient-to` (button gradient)
- `--card-gradient-from` and `--card-gradient-to` (card tint gradient)
- `--card-border-tint` (card border color)

### 6. Dark mode
- All tokens have dark mode counterparts in `.dark` block
- Gradient works in dark mode
- Shadows use darker tint in dark mode

### 7. Files exist
- [ ] `webapp/app/globals.css` — updated with real values
- [ ] `webapp/components/ui/button.tsx` — gradient default variant
- [ ] `webapp/components/ui/card.tsx` — shadow-md
- [ ] `webapp/public/logo.svg` — logo file
- [ ] `webapp/components/logo.tsx` — logo component
- [ ] `webapp/app/protected/layout.tsx` — layout shell implemented
- [ ] `docs/design-system.md` — documentation

## Done when

All checks pass. Design system workflow is complete.
