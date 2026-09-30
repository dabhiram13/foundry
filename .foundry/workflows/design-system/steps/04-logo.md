# Step 4: Logo & Favicon

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Generate 6 professional logo concepts using parallel `logo-designer` agents, let the user pick, then install everywhere.

## How

Run the `/logo` command. It handles everything:
1. Extracts exact hex colors from globals.css via Chrome DevTools canvas API
2. Spawns 6 `logo-designer` agents in parallel (each with a unique visual style)
3. Each agent iterates 3+ times with visual feedback (write SVG, read back, critique, improve)
4. Assembles preview page at `/logos` for comparison
5. User picks favorite(s) — can request refinements
6. Installs chosen logo everywhere (favicon, OG image, sidebar, header, manifest)

## Quality Bar

- Every logo must be a DESIGNED SYMBOL, not a plain letter or generic shape
- Must be legible at 20px, striking at 72px
- Must work on both light and dark backgrounds
- Must use ONLY colors extracted from globals.css (no hardcoded hex)
- Each of the 6 must be visually distinct (different container, mark style, technique)
- Would a designer at Stripe/Vercel approve it?

## Done when

- User has picked a logo
- `webapp/components/logo.tsx` exports `Logo` and `LogoIcon`
- `webapp/app/icon.svg` exists
- OG image, apple icon, and manifest created
- Sidebar and header use canonical `<Logo />` / `<LogoIcon />`
- `docs/built/logo.md` written
- Passes `npx tsc --noEmit && npm run build`
