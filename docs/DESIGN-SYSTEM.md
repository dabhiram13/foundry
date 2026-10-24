# Foundry visual system

Fluted Signal is one editorial system for the public landing and documentation. Use the same
colors, type, spacing and control states throughout. The public site stays
static; it is not a mockup of a managed workspace.

## Color

The shared source is `site/src/styles/tokens.css`. Landing is ink-dark; docs support
light, dark and automatic themes using Starlight's native selector.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Background | `#f8f6f1` | `#101015` | Reading surface |
| Card | `#ffffff` | `#19171f` | Controls and contained content |
| Foreground | `#241e2d` | `#f4effa` | Main text |
| Primary | `#563b82` | `#ded0f5` | Primary actions |
| Muted text | `#665e70` | `#b7adca` | Supporting text, not disabled text |
| Muted surface | `#efebf2` | `#292331` | Hover and secondary surfaces |
| Divider | `#ded7e3` | `#3b3346` | Content boundaries |
| Input border | `#7c7189` | `#a59bb6` | Actual form fields |
| Focus | `#654394` | `#d1b6ff` | Keyboard focus and documentation links |
| Error | `#a32838` | `#ffb4bd` | Written error feedback |
| Signal | `#57672d` | `#d8e9a2` | Section labels, not live activity |

Do not rely on color alone for errors or availability. Quiet dividers are not
the only way to recognize an input: fields keep visible labels and clear borders.
Body text must meet WCAG AA contrast in its rendered state.

## Type and layout

- Local Inter variable font for text and controls. System monospace for commands.
  No remote fonts or display font. The Inter OFL notice ships with its outlines.
- Hero up to 76px, section headings 28-42px, body 15-17px. Small labels supplement
  content rather than replacing readable body text.
- A 4px spacing scale. Controls have 9px corners; contained panels have 16px corners.
  Restrained gradients belong to the optical hero and primary action rim, not every card.
- Landing width up to 1200px, 40px desktop gutters, 20px mobile gutters. Stack
  content below 760px; specialist summaries use three, two, then one column.
- Docs keep Starlight's native navigation breakpoints, dialog and table of
  contents. Only code and table regions may scroll horizontally.
- The README banner contains only the monochrome horse mark and Foundry name.

## Controls and states

| Component | Behavior |
| --- | --- |
| Button and link | Distinct primary, outline and text treatment; hover, pressed, visible focus and native disabled state. Use anchors for navigation. |
| Copy commands | Copying, copied, failure and unavailable states; written fallback and retry. Never claim success after a failed clipboard operation. |
| Stage and FAQ disclosure | Native summary/details, readable expanded content, open indicator and keyboard access, including without JavaScript. |
| Mobile menu | Native disclosure; hydrated Escape returns focus to its summary; selecting a link closes it. No fake modal or focus trap. |
| Availability badge | A passive label, not a button or running-agent indicator. |
| Search | Starlight/Pagefind dialog, real input, clear, query, results, no-results and load-more behavior. Preserve native semantics and shortcuts. |
| Theme select | Native light/dark/auto options, focus, hover and readable popup options. |
| Docs navigation | Current page, disclosure, pagination and mobile menu use the same borders, corners and focus treatment. |

Standalone controls have at least 44px targets. Focus is a two-pixel ring with
three-pixel offset, never clipped or removed. Transitions only change color or
opacity, not position or scale. Reduced motion removes animation, transitions
and smooth scrolling. No animation library is needed.

The source mapping is in [component sources](COMPONENT-SOURCES.md). Test actual
desktop/mobile rendering, keyboard behavior, search, both docs themes and
overflow. Passing static tests does not establish appearance or owner acceptance.

## Optical background and fallbacks

The local `fluted-signal.svg` supplies the complete static composition without
JavaScript, remote images or a GPU. It is decorative and hidden from accessibility
APIs. Cult UI's Fluted Glass wrapper is adapted locally with Paper Shaders and a
still frame (`speed={0}`). The enhancement is a separate lazy module, mounted only
while the hero is visible and the document is active. Reduced motion, missing
WebGL2, failed loading and context loss retain the static artwork. No content or
control depends on the shader.

Only hero primary actions use a restrained, static Halo-inspired rim. Native
buttons and anchors retain actual loading/disabled/failure semantics; no simulated
agent activity, animated label dependency or slider showcase is introduced.
The routes and acceptance mapping are recorded in `docs/specs/fluted-signal.md`.
