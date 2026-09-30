# Step 5: Layout Shell

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Implement the protected area layout — sidebar or topbar — based on Step 1's decision.

## Pre-read

- Step 1 decision: sidebar or topbar?
- `webapp/app/protected/layout.tsx` — current layout (basic topbar)
- `webapp/components/ui/sidebar.tsx` — check if shadcn sidebar exists

## If Sidebar

1. Install shadcn sidebar if not present:
   ```bash
   cd webapp && npx shadcn@latest add sidebar
   ```

2. Rewrite `webapp/app/protected/layout.tsx`:
   - Use `SidebarProvider` + `SidebarInset` pattern
   - Logo at top of sidebar
   - Navigation links from current topbar nav
   - User menu (AuthButton) in sidebar footer
   - ThemeSwitcher in sidebar footer
   - NotificationBell in the top header bar

3. Create `webapp/features/_shared/components/app-sidebar.tsx`:
   - Logo component at top
   - Nav items grouped by section
   - Active state uses primary color
   - Collapsible on mobile

4. Sidebar tokens are already in globals.css (`--sidebar-*`). Verify they look correct with the new primary color.

## If Topbar

Keep the current structure but polish it:
1. Add Logo component (replace text link)
2. Ensure consistent spacing
3. Add subtle bottom border shadow
4. Mobile responsive: hamburger menu on small screens

## Shared

Regardless of layout type:
- Logo component in the navigation area
- AuthButton + ThemeSwitcher accessible
- NotificationBell visible
- Mobile responsive
- Uses semantic tokens only (no raw colors)

## Done when

- Protected layout implements the chosen layout type
- Logo is visible in navigation
- Mobile responsive
- All navigation links preserved
- `npx tsc --noEmit` passes
