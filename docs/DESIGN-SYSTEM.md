# Foundry visual system

Warm Workbench connects the public landing page, docs and brand artwork. A warm
paper canvas, restrained orange accents and an original textured product frame
take inspiration from LightSprint's composition and physical controls. The
public site remains static, not a managed workspace. Do not show fictional
running agents, completed products, customer quotes or check results as evidence.

## Color

The shared source is `site/src/styles/tokens.css`. Landing supports light/dark;
docs preserve Starlight's light/dark/automatic selector and storage convention.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Background | `#f5f3f0` | `#1b1917` | Warm reading surface |
| Card | `#fffdfb` | `#25211e` | Controls and contained content |
| Foreground | `#292520` | `#f8f4ef` | Primary text |
| Muted text | `#605c56` | `#beb4ac` | Supporting text, not disabled text |
| Primary | `#bf4115` | `#f47d4e` | Actions and selection |
| Muted surface | `#efebe6` | `#312b26` | Hover and secondary surfaces |
| Divider | `#ddd8d2` | `#51463e` | Content boundaries |
| Input border | `#766e66` | `#b7aaa1` | Actual form fields |
| Focus | `#b83b13` | `#ffa471` | Visible keyboard focus |
| Error | `#b91c1c` | `#fca5a5` | Written error feedback |

Primary button faces use darker orange than the decorative art to keep small white
labels readable. Dark-mode buttons use dark labels on light orange. Color is
not the only way to identify errors, selection or availability. Test the actual
rendered colors, not an unrelated reference palette.

## Type and layout

- Local Instrument Sans variable Latin, 400-700, under SIL OFL 1.1. System
  monospace for commands. No font CDN request or proprietary Suisse font.
- A compact editorial hero, a six-step interactive example, install panel,
  approvals/checks, FAQ and footer. The example is
  explicitly illustrative, not a finished booking product or live session.
- Width up to 1120px. Desktop gutters 32px, mobile 16-20px. Inset capsule
  faces on 44px controls, a rounded header and restrained contained surfaces.
  Keep content readable before texture.
- The product scene has original local ordered-halftone WebP artwork with an SVG
  fallback, not WebGL. Texture remains
  decorative; the example is semantic text over a readable surface.
- Docs retain Starlight's responsive shell, navigation, search and TOC. Tables
  and code can scroll without making the entire page overflow.
- The README banner contains only the horse mark and Foundry name, outlined in
  Instrument Sans. GitHub chooses the font for the rest of README Markdown.

## Controls and states

| Component | Behavior |
| --- | --- |
| Actions | Compact solid faces inset inside 44px hit areas. Hover adjusts color; press sinks 1px; focus ring remains clear; disabled removes movement. Anchors navigate, buttons act. |
| Copy commands | Idle, copying, copied, failure and unavailable. Written success/fallback/retry; never claim success after failure. |
| Workflow | Manual selection, arrow/Home/End keys, roving focus and a labeled panel. First example is server-rendered. No autoplay. The docs link remains available without JS. |
| FAQ | Native summary/details, plus/minus indicator, hover/press/focus and keyboard access without JS. |
| Mobile menu | Native disclosure, Escape/focus return after hydration, closes after choosing a link. Not a fake modal or focus trap. |
| Availability | Passive published/source/not-available labels, not fake disabled buttons or running-agent indicators. |
| Search | Starlight/Pagefind dialog, shortcut, input, clear, real results and empty states. Preserve native semantics and dismissal. |
| Theme | Landing light/dark buttons with pressed state; docs native light/dark/auto select. Both share the saved preference. |
| Docs navigation | Warm highlighted current page, responsive sidebar, group disclosure, TOC and tactile previous/next links. |
| Code copy | Actual Expressive Code button, 44px bounds, hover/pressed/focus and built-in feedback. |

The owner requested a detail refinement after the first unaccepted preview.
Workflow tabs use compact text pills, with an ivory inset selected face and no
stage icons, numbered tabs or peach selection blocks. A connected invitation
example replaces the unexplained booking label. The original halftone image
fills the scene and continues into a softer charcoal-to-paper landing backdrop.
The illustration is explicitly labeled as an example.

The rounded floating header uses measured navigation bounds, a moving neutral
hover/focus surface, section tracking and reading progress. Links remain
ordinary anchors. Button faces are inset inside 44px hit areas; Docs previous/next
links use restrained ruled rows rather than large raised cards.
The hero's original dot-wave rasterizer uses readable DOM text and an aria-hidden
canvas; it runs once on entry or pointer entry, then restores native text. Font
loading, resize, visibility, reduced motion and unmount are handled explicitly.
Docs selection is a thin orange edge and text, not a peach block. Pagination
keeps a stable row and moves only its directional arrow on hover. Secondary
pressed states are neutral. Native search, theme and sidebar controls remain.

Standalone controls have 44px minimum targets. Reduced motion removes
transitions, panel animation and smooth scrolling. Texture never replaces a
label or result. No animation library is required.

Docs search is a content-sized capsule, not an input-shaped full-width bar.
Search, the Docs brand label and native theme hover surface use 36px painted
faces within 44px targets. The mobile TOC shares their rounded corners; article
and code surfaces remain rectangular reading areas. Search dialog height follows
the actual content, without a blank minimum-height panel.

The mapping and licenses are in [component sources](COMPONENT-SOURCES.md) and
[provenance](PROVENANCE.md). Static tests do not establish appearance or owner
acceptance. Check actual desktop/mobile rendering, keyboard, both themes,
search, clipboard, selected controls, reduced motion and overflow.
