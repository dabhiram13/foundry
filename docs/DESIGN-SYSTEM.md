# Foundry visual system

One quiet system for the public landing page and documentation. Use the same
colors, type, spacing and control states throughout. The public site stays
static; it is not a mockup of a managed workspace.

## Color

The shared source is `site/src/styles/tokens.css`. Landing is light; docs support
light, dark and automatic themes using Starlight's native selector.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Background | `#fafafa` | `#101012` | Reading surface |
| Card | `#ffffff` | `#18181b` | Controls and contained content |
| Foreground | `#18181b` | `#fafafa` | Text and primary actions |
| Muted text | `#61616b` | `#a1a1aa` | Supporting text, not disabled text |
| Muted surface | `#f4f4f5` | `#232326` | Hover and secondary surfaces |
| Divider | `#e4e4e7` | `#3f3f46` | Content boundaries |
| Input border | `#737373` | `#a1a1aa` | Actual form fields |
| Focus | `#2563eb` | `#93c5fd` | Keyboard focus and documentation links |
| Error | `#b91c1c` | `#fca5a5` | Written error feedback |

Do not rely on color alone for errors or availability. Quiet dividers are not
the only way to recognize an input: fields keep visible labels and clear borders.
Body text must meet WCAG AA contrast in its rendered state.

## Type and layout

- Local Inter variable font for text and controls. System monospace for commands.
  No remote fonts or display font. The Inter OFL notice ships with its outlines.
- Hero up to 64px, section headings 28-32px, body 15-17px. Small labels supplement
  content rather than replacing readable body text.
- A 4px spacing scale. Controls have 6px corners; contained panels have 8px corners.
  No gradients, glass surfaces or decorative card grids.
- Landing width up to 1088px, 32px desktop gutters, 20px mobile gutters. Stack
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
