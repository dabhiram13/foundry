# Foundry design system

Status: implementation contract for the React/shadcn workspace. This file owns the
visual system and component rules. Product behavior remains in the workflow and
workspace specifications.

## Direction

Foundry is a quiet product workspace, closer to a document tool than an admin
dashboard. The persistent sidebar answers **where am I?** The page answers **what
needs my attention?** The interface uses neutral light surfaces, compact controls,
Geist, Lucide icons, and one black primary action. It does not use blue admin cards,
marketing gradients, ornamental charts, large hero type, or a grid of equally
prominent panels.

The structural reference is shadcn/ui's `sidebar-07`: a composable sidebar with a
workspace header, grouped navigation, project rows, user controls, and an inset main
surface. Foundry uses the Notion-like off-canvas variation: the desktop sidebar is
either open or hidden rather than reduced to an icon rail. Notion contributes the information model: a collapsible
workspace sidebar, page-like content, breadcrumbs, section headings, recent pages,
and settings at the bottom. Foundry adapts those patterns to products and factory
stages; it does not copy either product's branding or sample content.

Primary references:

- [shadcn Sidebar](https://ui.shadcn.com/docs/components/sidebar)
- [shadcn `sidebar-07` registry entry](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry.json)
- [shadcn Breadcrumb](https://ui.shadcn.com/docs/components/breadcrumb)
- [Notion sidebar behavior](https://www.notion.com/help/navigate-with-the-sidebar)

The installed UI search returned a generic marketing-page pattern, teal/orange
palette, and Roboto. Those recommendations do not fit the owner's specific
Notion/shadcn brief and are rejected. Its density, accessibility, semantic-token,
responsive, and SVG-icon checks still apply.

## Source and ownership

| Concern | Owner | Rule |
| --- | --- | --- |
| Semantic color, type, radius, and sidebar tokens | `app/src/globals.css` | Define once as CSS variables; components consume names, never raw colors. |
| shadcn primitives | `app/src/components/ui/` | Keep upstream composition and accessibility behavior. Change a primitive only when every use should change. |
| Foundry layout and product-specific styling | `app/src/workspace.css` and composition components | Own page widths, stage layout, idea composer, document/activity tabs, and empty states. |
| Brand mark | `app/assets/foundry-mark.svg` | Canonical vector asset for sidebar, app identity, and documentation. |
| Product behavior and data | React workspace components and existing factory API | Styling must not duplicate state or bypass API review gates. |

Use `data-slot` and shadcn variants for stable component styling. Do not recreate a
button, input, dialog, sheet, tabs, breadcrumb, tooltip, badge, separator, or sidebar
primitive in workspace CSS.

## Tokens

The checked-in variables in `app/src/globals.css` are the source of truth. This
table records their intended meaning.

| Token | Current value | Use |
| --- | --- | --- |
| `--background` / `--card` / `--popover` | `oklch(1 0 0)` | Main page, document, modal, and menu surfaces. |
| `--foreground` / `--card-foreground` | `oklch(0.145 0 0)` | Primary text and black actions. |
| `--primary` | `oklch(0.205 0 0)` | The one dominant action on a view. |
| `--primary-foreground` | `oklch(0.985 0 0)` | Text and icons on primary actions. |
| `--secondary`, `--muted`, `--accent` | `oklch(0.97 0 0)` | Selected rows, quiet controls, hover, and subdued regions. |
| `--muted-foreground` | `oklch(0.556 0 0)` | Supporting labels and metadata that still meet contrast. |
| `--border` / `--input` | `oklch(0.922 0 0)` | Hairline separation and input boundaries. |
| `--ring` | `oklch(0.708 0 0)` | Visible neutral focus rings. |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Destructive actions and errors only. |
| `--sidebar` | `oklch(0.985 0 0)` | Sidebar surface. |
| `--sidebar-accent` | `oklch(0.955 0 0)` | Hover and selected navigation rows. |

Do not introduce a general brand blue. Stage state uses text, icons, progress shape,
and semantic labels; color is never the only signal. If a new status color becomes
necessary, add a named semantic pair to `globals.css` and verify contrast before use.

Typography uses the locally bundled `Geist Variable`, then the system sans fallback.
Code uses the system monospace stack; Foundry does not bundle a separate monospace
font. Keep the hierarchy restrained:

- page title: 30/36, weight 650;
- section title: 20/28, weight 600;
- body and document text: 14/22;
- controls and navigation: 13/20, weight 500 when active;
- metadata: 12/16; never use tiny all-caps text as a substitute for hierarchy.

Spacing follows a 4px base: 4, 8, 12, 16, 20, 24, 32, 40, and 48. Use 12px between
related controls, 24px between sections, and 32-48px for page-level separation. The
base radius is `0.5rem`; use the existing `sm`, `md`, `lg`, and `xl` derivations.
Avoid decorative shadow. Menus, dialogs, and sheets may use the shadcn elevation
needed to distinguish an overlay.

## Shell and page anatomy

- Desktop sidebar: `240px` (`15rem`) when open. The trigger hides it off canvas and
  restores the full sidebar; there is no icon-only state. The mobile sheet is `18rem`.
  The sidebar has a sticky header/footer and scrolling content. Products live in one
  labeled group and expose the active row through `isActive`.
- Workspace header: `48px` high. It contains the sidebar trigger, a real breadcrumb,
  and only page-level actions. It has a bottom border and no oversized title block.
- Main content: centered document column, maximum `56rem`, with 40px horizontal and
  52px top padding on desktop. It steps down to 24px horizontally on tablet and 20px
  on mobile.
- Product page: product title and idea summary, horizontal six-stage progress, then
  line-style `Overview`, `Documents`, and `Activity` tabs. The current step and action
  live inside Overview. Activity is a related view rather than a permanent right-hand
  dashboard card.
- Home page: one sparse idea composer. Product name and description are primary;
  examples are quiet fill actions. The black create button is the only dominant CTA.
  Recent products render as page rows with name, current stage, and status.
- Settings: use one contained `Dialog` on desktop and mobile. Its width is bounded by
  the viewport and its body scrolls internally. Account, runtime, and specialists use
  shadcn Tabs with an explicit initial value.
- Artifact review: use a large `Dialog` with a readable document column and a stable
  footer. The approval action stays visible without covering keyboard focus or text.

Buttons use shadcn variants consistently: `default` for the primary black action,
`outline` for secondary actions, `ghost` for navigation and inline utilities,
`destructive` only for destructive work. Inputs are plain white fields with neutral
borders and clear labels. Cards are reserved for bounded objects; do not wrap every
section in a card.

## Icons and mark

Use Lucide React exclusively in application controls. Standard icons are 16px;
top-level actions may use 18px. Keep stroke weight consistent. An icon beside visible
text is decorative and receives `aria-hidden="true"`. An icon-only button has an
accessible name and a tooltip when its meaning is not universal. Use no emoji,
font-icon, or mixed outline/fill libraries.

`app/assets/foundry-mark.svg` is the master mark. Preserve its geometry and native
colors, provide clear space equal to the mark's visible height, and render it at no
less than 24px. Use mark plus `Foundry` in the open sidebar. Do not recolor with CSS
filters, distort, rotate, crop, add a
shadow, or place it in a decorative tile. Raster exports are derivatives; update them
from the SVG rather than editing them separately.

## Responsive and interaction

- At `768px` and above, the sidebar can be shown or hidden off canvas. Below `768px`,
  use the sidebar's Sheet behavior. The page must not retain a hidden 240px offset.
- At 480px and 390px, the header stays one row, the composer and settings become one
  column, dialogs stay within the viewport, and footer actions wrap or stack.
- The six-stage navigation remains horizontal. On narrow screens it scrolls inside
  its own labeled region; the document body must never gain horizontal overflow.
- Tables and long code blocks may scroll inside their content boundary. Long names
  truncate visually while their accessible name remains intact.
- Interactive targets are at least 36px in dense desktop chrome and 44px on touch
  surfaces. Hover never reveals an action that has no keyboard equivalent.
- Motion is limited to 150-200ms opacity, color, or small transform transitions.
  Under `prefers-reduced-motion: reduce`, remove nonessential animation.

Every interactive control uses the existing neutral `focus-visible` border and 3px
ring. Never remove the outline without that replacement. Set page scroll padding to
the 48px header height, keep focused elements at least partially unobscured, return
focus to the trigger when a dialog closes, and move focus to the new page heading
after product navigation. Dialog and Sheet primitives own focus trapping and Escape.

## Review criteria

These are acceptance criteria, not a record that testing passed:

- The first view reads as a document workspace, with no blue admin-dashboard cards.
- The sidebar is 240px when open, hides fully on desktop, and becomes an 18rem Sheet below 768px.
- The 48px header uses `Breadcrumb`; the current page is not rendered as a link.
- Page content is centered and no wider than 56rem except the artifact review dialog.
- Home contains one sparse composer, one black primary action, useful examples, and real recent products.
- Product stages are a horizontal six-step sequence with current, complete, blocked, and review states discernible without color alone.
- Overview, Documents, and Activity are line Tabs above the current-step content.
- Product metadata appears as text rows rather than equal-weight statistic cards.
- Buttons, forms, tabs, dialogs, sheets, breadcrumbs, tooltips, badges, and sidebar behavior come from the shadcn primitives.
- Geist, Lucide, images, and CSS load locally; no UI dependency loads from a CDN.
- Lucide is the only application icon family, and every icon-only control has an accessible name.
- The SVG mark is crisp at 24px and 32px, with clear space and no filter, shadow, gradient, or distortion.
- Keyboard traversal follows visual order; focus remains visible around sticky headers and dialog footers.
- Loading, empty, blocked, failure, cancelled, approval, and completed states use plain language and recovery actions.
- Layout is checked at 1440, 1024, 768, 480, and 390px with no page-level horizontal overflow.
- Reduced-motion mode, 200% zoom, long product names, long documents, and error recovery remain usable.

## Using the installed skills

Installed from the owner's GitHub stars:

- **UI UX Pro Max** and **Brand**: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), commit `09170eec67eefd46a7ae85de61b40c194020f997`.
- **Prototype**: [mattpocock/skills](https://github.com/mattpocock/skills), commit `d81f3a183412e71a5b1e84ca21bc1a35eea03a60`.

These are owner-local Codex skills, available by name on the next turn. They are
not runtime dependencies of products or the Foundry plugin. Ask Codex to use
`ui-ux-pro-max` for component/UX guidance, `brand` for identity work, or `prototype`
when several interaction directions genuinely need exploration.

For a new Foundry surface, read this file first. Then run the local, standard-library
search tool with one narrow question; do not persist or force output over this contract:

```bash
python3 /Users/sridurga/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "sidebar breadcrumb tabs dialog" --stack shadcn

python3 /Users/sridurga/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "keyboard focus dialog" --domain ux
```

Use `/Users/sridurga/.codex/skills/brand/SKILL.md` and its logo, color, typography,
and consistency references when changing the mark or brand assets. Matt Pocock's
installed `prototype` skill remains available for future ambiguous design questions;
this implementation does not use its three-variant flow because the owner supplied a
specific Notion/shadcn direction.
