# Foundry design system

## Direction

The owner selected [Superset](https://superset.sh/) as the reference for a
complete redesign of the actual app. The previous powder-blue Soft studio
palette, rounded paper cards and wispy sky are retired, not layered underneath.

The inspected public reference uses a near-black canvas, Inter, large centered
type, white rectangular actions, orange selection marks and a prominent product
view. Foundry adapts that language with its own composition, vector identity,
copy and original specialist portraits. No Superset assets, code, customer logos
or unsupported product claims are used.

## Product truth

Foundry starts in the terminal; its optional local browser view shows the same
saved projects. The person using it needs to know what is happening, what needs
approval, and what comes next. Research → Plan → Design → Build → Test → Ship remains the actual order.
Plan and Design need approval; Ship is a summary, not automatic publishing.

Codex is the built-in runtime. An OpenAI-compatible endpoint is not automatically
a complete provider. Files stay local, but cloud AI providers receive prompts
and selected content. Do not imply local inference, successful billing checks,
separate live agents, or automatic deployment.

## Foundation

The semantic source is `app/src/globals.css`.

| Role | Value |
| --- | --- |
| Canvas | `#101010` |
| Work surface | `#171717` |
| Raised/quiet surface | `#1d1d1d` |
| Text / primary fill | `#f5f4f2` |
| Secondary text | `#a8a6a3` |
| Structural divider | `#303030` |
| Control boundary | `#77736c` |
| Accent | `#ff854d` |
| Selection | `#292929`; orange detail only for progress/attention |
| Focus | `#d1ceca`, 2px with an offset |
| Success | `#9acda8` on `#1b2a20` |
| Warning | `#e8c27d` on `#2b251b` |
| Error | `#ffaaa0` on `#321e1c` |
| Shape | 0–3px controls; 6px work frames and dialogs |
| Spacing | 4, 8, 12, 16, 20, 24, 32, 48, 64, 80, 96px |

Orange identifies selection, progress and attention; it is not the fill for
every action. Primary buttons are off-white with near-black text. Secondary
actions are outlined or text-only. Destructive controls use a separate dark-red
fill with white text, not the error-text token. Status always includes words or
an icon; color alone is insufficient.

Inter variable is bundled locally under SIL OFL 1.1, with its license and source
under `app/assets/licenses/`. Monospace is reserved for paths, commands and test
output. The original SVG wordmark and F mark share a stepped construction; use
the full wordmark for navigation and the mark at small sizes. Do not put the
white wordmark on a light surface without supplying an appropriate dark variant.

Type: landing title 44–76px, mobile 36–54px; section titles 30–48px; workspace
title 32–46px; task heading 26px; reading text 14–17px; compact controls 12–14px.
Supporting metadata can be 11–12px, never the only place a required action is
explained. Lucide icons are the shared icon family.

## Landing page

One concise promise, installation action, an interactive **example walkthrough**,
three practical benefits, source installation, short FAQ and documentation links.
The example stays visibly labeled at its top and bottom; its displayed commands
do not create product data, run AI or claim a customer outcome.

Use the real commands: clone the repository, enter it, run `./foundry --help`,
then create work from the terminal. The copy control reports both success and
failure. Installation scrolls to and focuses the command section. Open local
browser view enters the actual app; terminal `new` creates the real product.
No invented package installer or waitlist.

The walkthrough uses Radix tabs with arrow-key navigation. It has a finite
entrance, not an autoplay carousel. The heading and reading content stay still.

## Workspace

A compact top bar exposes Projects, creation, Settings and Quiet
motion. The empty workspace contains a labeled idea composer, examples, a name
and one creation action. It never contains example projects or fake history.
The original selectable portraits are secondary to the composer and explain
roles, not live activity. Their existing finite radial motion is retained.

The product desk has three jobs:
1. Left: Research, Plan, Design, Build, Test, Ship. Selected, current, complete
   and future are distinct. Inspecting a step does not start it.
2. Center: current work and one next action. Plan/Design lead with the document
   to review; Build shows tasks/checks; failures expose their actual cause.
3. Right: relevant roles, saved documents and recent activity for this product.

Work, Documents and Activity stay in the same desk. Long ideas can expand;
empty stages never invent output. Settings, product drawers and document
reviews use the same dark tokens, compact controls and semantic states.

## Source-backed controls

Field, Input, Textarea and InputGroup share one neutral focus boundary. Model
settings use Base UI Autocomplete for suggestions and custom IDs; reasoning uses
Radix Select, with “Use the default” saved as the existing empty value. Picker
popups must stay keyboard-safe inside Settings. Never use an action menu for a
form selection. The source map and licenses are in docs/COMPONENT-SOURCES.md.

Keep the composer unboxed around its fields. Group real work surfaces with Card,
use Item for rows and persistent Alert for feedback. Native page/dialog scrolling
remains preferable to nested scroll areas. No arbitrary demo loading placeholders.
Quiet motion is a labeled Radix switch; device reduced motion remains authoritative.

## Interaction and accessibility

- Keep the existing Radix focus traps, Escape handling, scroll lock and opener
  restoration. Do not replace them with hand-rolled modal behavior.
- Visible labels and generous label areas for checkboxes. Subscription consent
  is never preselected. Engine selection never starts a job or signs in.
- Primary actions are 40px on desktop, hero installation 48px. Mobile controls
  are at least 44px. Icon-only controls always have accessible names.
- Finite press feedback ~160ms; selection/reveal ~240ms; portrait entrance
  under 1.4s; landing entrance 600ms. No perpetual decorative animation.
- Quiet motion persists locally. The system reduced-motion preference wins.
  Disabling motion never disables selection, focus or dialog closing.
- The server's style nonce remains intact. No CSP relaxation.

## Responsive layout

Desktop landing content is bounded at 1160px. Desktop work has a 176px stage
sidebar and a 250px context pane. At 1000px context moves beneath the work;
below 768px stages form a locally scrollable horizontal list. The current stage
remains reachable. Narrow layouts place the composer before the portraits.

Use 20px mobile gutters, wrap long titles and file paths, and constrain local
scrolling to the relevant list or document. Check 360px/390px and actual 200%
zoom for horizontal page overflow. Approval remains reachable in long documents.

## Tooling and verification

[Impeccable](https://github.com/pbakaus/impeccable) was loaded for the redesign:
product truth, new visual composition, rendered critique, then mechanical audit.
It is not an installed project hook or a guarantee of design quality.
The existing Radix wrappers, Motion and Animate UI adaptations remain; there
is no second component kit. See [component mapping](ANIMATE-UI.md).

Source ownership: semantic tokens in `globals.css`; workspace layout in
`workspace.css`; landing composition in `components/landing.tsx` and
`landing.css`; shared motion/selection in `studio.css`. Generated browser and
self-contained MCP panel assets must be rebuilt from these sources.

Run TypeScript, panel build, both browser journeys and README framework checks.
Separately inspect rendered desktop/mobile layouts, keyboard/return focus,
reduced motion, 200% zoom, contrast, long/empty/loading/error states and network
errors. A passing simulated-provider journey is not live AI qualification,
successful sign-in, deployment, MCP-host rendering or owner design acceptance.
