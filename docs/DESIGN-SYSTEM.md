# Foundry neutral foundation

The owner approved this foundation on 2026-10-02. It supersedes the earlier
Geist/Notion-only layout contract and all rejected purple, Folk, Focus and modular
logo proposals. The existing canonical mark is preserved. This is an adaptation
of the supplied neutral board into the existing React, shadcn and Tailwind 4 app,
not an Astryx component migration or a copy of another product's layout.

## Approved source and ownership

The exact source identities and acceptance criteria are in
[the implementation spec](specs/neutral-ui-redesign.md). The board (2880 × 2048),
four-page PDF, JSON and CSS tokens were materialized on the implementing Mac and
visually inspected before editing. Only the bot art direction was retained from
the older rejected mockups.

| Concern | Source of truth |
|---|---|
| Color, font, spacing, radius, motion | `app/src/globals.css` |
| Owned accessible primitives | `app/src/components/ui/` |
| Workspace composition and data | `app/src/main.tsx`, existing Factory/Service APIs |
| Workspace layout | `app/src/workspace.css` |
| Landing | `app/src/components/landing.tsx`, `app/src/landing.css` |
| Actual 28 role identities | `app/src/components/specialists.tsx` |
| Canonical mark | `app/assets/foundry-mark.svg` (unchanged) |
| Standalone + embedded output | `scripts/build_panel.py` |

## Exact foundation

| Role | Value |
|---|---|
| Canvas / white surface | `#F1F1F1` / `#FFFFFF` |
| Primary / secondary text | `#000000` / `#474747` |
| Primary action / hover / pressed | `#1B1B1B` / `#262626` / `#111111` |
| Selection / quiet surface | `#E2E2E2` / `#F1F1F1` |
| Decorative divider / functional boundary | `#D4D4D4` / `#777777` |
| Focus / disabled text | `#1B1B1B` / `#919191` |
| Success / surface | `#166534` / `#F0FDF4` |
| Warning / surface | `#854D0E` / `#FFFBEB` |
| Error / surface | `#991B1B` / `#FEF2F2` |
| Progress accent / surface / line | `#C2410C` / `#FFF4ED` / `#FDBA8C` |

Structural colors, including selection and focus, are achromatic. One warm accent
(`--foundry-accent`, 5.2:1 on white) marks progress and the owner's turn only: the
progress bar, the current step marker, the "Needs your review" badge and the
highlighted next-step band. Do not use it for buttons, links, decoration or
selection. Status colors are paired with words and icons. A decorative divider is not the only visible
boundary of a form control. The supplied specification records white-surface
contrast ratios of 9.29:1 for secondary text, 17.22:1 for primary buttons and
4.48:1 for functional borders. Disabled controls are visibly inactive, not normal
body copy. Use a 2px charcoal focus outline with a 2px white separation.

Figtree 400/500/600 is self-hosted as WOFF2, under SIL OFL 1.1. The existing system
monospace stack is reserved for paths, revisions and technical values. Internal
page headings use 24/32 at 600 (-0.48px); sections 20/28 at 600 (-0.2px); body 14/20
at 400; labels 14/20 at 500; supporting text 12/20. The landing uses a larger
editorial display scale; document reading uses extra leading. Do not introduce
unlicensed fonts or synthetic bold weights.

Spacing uses 4/8/12/16/24/32/48/64px. Corner radii are 6/10/12px, with a 28px overlay
radius. Default surfaces have no shadow, grain or texture. Overlay elevation is
limited to the supplied subtle black shadow. Bot artwork supplies the personality.

## Layout and truthful states

The standalone landing explains the actual six-stage flow, provides working
workspace/create actions, and discloses the role library as guidance. It contains
no pricing, testimonials, live metrics, borrowed company logos or autonomy claims.
The embedded panel opens directly into the workspace.

The home page leads with one large idea box, example prompts and a compact name
field; recent products show a small progress bar. A 240px desktop sidebar groups actual products. Below 768px it becomes one
Radix Sheet; it is not duplicated in the DOM. Main content is centered, up to
1200px for product work and 1024px for the idea composer. A compact 200px stage column sits beside one white work panel with a fine border,
12px radius, clear header, light action band and separated documents. Stage rows
are 56px with 22px markers; gray selection and label weight show the inspected
stage. There are no persistent selection bars or stage connector lines. Keyboard
focus remains a distinct temporary outline. Role guidance sits below the workspace. Recent
products remain compact rows. Overview, Documents and Activity use a neutral
segmented tab group; activity logs remain readable and unanimated.

Research → Scope → Design → Build → Verify → Release is the real state sequence.
The UI labels these Research → Plan → Design → Build → Test → Ship; internal stage
ids are unchanged.
Stage buttons can inspect a past or upcoming stage without changing runtime state.
No future document is invented. Overview exposes the actual next action, status,
selected provider and saved documents. A running indicator means the controller
reports a real running job. The panel shows only the roles the controller assigns
to the viewed step; their portraits respond while that step runs.

Account, runtime and specialist settings retain inheritance and failed-save drafts.
Document review displays the reviewed revision, sanitized Markdown, and a stable
approval footer. Approval sends the complete exact digest; stale or changed
documents are rejected. Navigation invalidates pending document requests.
Snapshots are ordered by applied response, and periodic polls do not overlap.
Stop requests are described as requests until the runtime confirms interruption.

## Voice

Write like a helpful colleague: short, plain and confident. Say what happens next
and who does it. Prefer "step", "plan", "test", "ship summary", "AI engine" and
"roles" over "stage", "scope", "verify", "release handoff", "runtime" and
"specialists". Do not use "owner", "gate", "evidence", "receipt", "artifact" or
"coordinator" in the UI. State a limit once, where it matters, instead of adding
disclaimers to every screen.

## Icons and specialist portraits

Lucide supplies all interface icons, with 24-unit source geometry and stroke 2.
Render at 16–20px for controls; decorative icons are hidden from assistive tech.
Icon-only controls need accessible names. Do not replace UI icons with emoji.

The 28 labeled portraits are original role configurations of the free MIT
`bot-avatars` 0.2.2 renderer from [Libraries](https://libraries.dev/bots).
They adapt the owner's plush bot direction through 18 silhouettes and distinct
accessory combinations; they are not unchanged copies of the supplied artwork.
Transparent 160px PNG exports render at 28–40px in dense UI, with larger landing
feature images. `scripts/render_bot_assets.cjs` regenerates them deterministically.
No avatar canvas renderer ships in the application. Full notices are retained in
`app/assets/bots/LICENSE.txt` and `app/assets/licenses/Figtree-OFL.txt`.

## Motion and accessibility

| Interaction | Duration |
|---|---|
| Button/input feedback | 125ms |
| Icon feedback | 160ms |
| Avatar response to interaction | 180ms |
| Tab/stage selection | 220ms |
| Completion | 240ms |
| Card/panel/dialog reveal | 300ms |

Prefer opacity and small transforms. Buttons, examples, navigation rows, stages,
tabs, expanding role lists, sheets, dialogs and completion states give feedback.
Do not animate reading text, continuously animate idle rosters, or move an approval
button when its busy indicator appears. Only actual running work spins.
Reduced motion uses zero duration and a single final iteration; retaining animation
names lets Radix finish an in-progress close when the preference changes. It must
not leave a hidden modal trapping focus. Landing decoration remains static.

Inputs/buttons are at least 40px high, with 44px touch targets in narrow layouts.
At narrow widths the compact stage rows scroll horizontally within their own
region; the page does not overflow. Settings
and long documents scroll inside their dialog with the footer visible. Back/Forward
focus the destination heading; New product focuses the name field. Dialog and
Sheet primitives own focus trapping/Escape and restore the invoking control.

## Attribution and verification

[Astryx Neutral](https://astryx.atmeta.com/Neutral) informed the approved neutral
foundation through the supplied board/tokens. This does not claim the entire
Astryx system is grayscale. [Design Engineering](https://www.designeng.tools/)
and [Transitions](https://transitions.dev/) informed motion cadence and restraint;
no paid assets, Pro components or recipe source code were copied. Transitions'
custom recipe license is not described as MIT. Existing shadcn, Radix, Lucide and
MCP SDK notices remain in [dependency notices](../app/DEPENDENCY-NOTICES.md).

See [UI design and verification boundaries](UI-DESIGN.md) and
[the verification record](NEUTRAL-UI-VERIFICATION.md) for actual evidence and limits.
Criteria include desktop/tablet/mobile/narrow panel, keyboard/focus, 200% zoom,
reduced motion, long content, errors, interrupted/repeated actions, exact approval,
shared build reproducibility and independent design/code review.
