# Public site component sources

The landing uses source-owned React components in `site/src/landing`.
Documentation uses Astro/Starlight and its native Pagefind search. Both share
the [visual system](DESIGN-SYSTEM.md) and `site/src/styles/tokens.css`.

## Component mapping

| Public component | Source or design reference | Implementation |
| --- | --- | --- |
| Actions and navigation | [shadcn Button](https://ui.shadcn.com/docs/components/radix/button) | Local `ui/button.tsx`, Radix Slot, class-variance-authority; native buttons or anchors. |
| Copy commands | [Button](https://ui.shadcn.com/docs/components/radix/button) | Original local `ui/copy-button.tsx`, with written success/failure and retry. No tooltip or motion dependency. |
| Workflow | [LightSprint](https://lightsprint.ai/) composition reference, [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | Original manual stepper, roving focus, arrow/Home/End keys, labeled panel and static first example. No running-agent claim. |
| FAQ | [Accordion](https://ui.shadcn.com/docs/components/radix/accordion) | Native details/summary with matching visual/state recipes, not the Radix Accordion keyboard API. |
| Mobile menu | [Collapsible](https://ui.shadcn.com/docs/components/radix/collapsible) | Native disclosure plus Escape/focus return. Not a modal. |
| Installation and content | [Card](https://ui.shadcn.com/docs/components/radix/card), [Separator](https://ui.shadcn.com/docs/components/radix/separator) | Semantic sections and dividers, not imported Card widgets. |
| Availability | [Badge](https://ui.shadcn.com/docs/components/radix/badge) | Passive text labels for published, source preview and in-development work. |
| Docs search and theme | [Starlight overrides](https://starlight.astro.build/reference/overrides/), [Pagefind UI](https://pagefind.app/docs/ui-usage/), [Input](https://ui.shadcn.com/docs/components/radix/input) | Preserve native components and style actual controls in `site/src/styles/docs.css`. No duplicate search engine. |
| Colors and typography | [LightSprint](https://lightsprint.ai/) visual reference, [Instrument Sans](https://github.com/Instrument/instrument-sans) | Local semantic warm tokens, OFL Instrument Sans, system monospace. No proprietary font or commercial artwork copied. |
| Backgrounds and action feel | LightSprint interaction reference | Original local ordered-halftone WebP with SVG fallback, CSS pixel pattern, gradient-rim orange/secondary actions, small pressed translation and panel crossfade. No shader or animation dependency. |
| Dithered heading | LightSprint effect reference, original implementation | Local `dot-wave-text.tsx` samples native text into dots for a one-pass wave. Semantic DOM fallback, hidden canvas, font/resize/visibility cleanup and reduced-motion bypass. No reference-site source imported. |
| Floating navigation | Original local interaction | `header-nav.tsx` measures anchor bounds for a sliding neutral surface and observes scroll for section and reading progress. Native links work without hydration. |
| Landing theme | Starlight storage convention | Original light/dark icon group sharing the docs' `starlight-theme` preference. Native docs light/dark/auto selector is preserved. |

shadcn source is MIT licensed; its notice is retained in
`site/assets/licenses/shadcn-ui.txt`. Icons come from the installed Lucide
package. This is one control system, not a mix of component kits.

## Identity and assets

The small horse silhouette comes from the previously approved generated Foundry
identity. The name uses Instrument Sans glyph outlines under SIL OFL 1.1, not a
new font. The README banner contains only that mark and name, with an orange
logo tile and warm background. The social image uses the same warm identity.
Assets and font notices are local in `site/assets`.

The old illustration scenes, display font and Animate UI primitives are no
longer shipped. Their history and source boundaries are recorded in
[provenance](PROVENANCE.md). Generation and owner approval are not copyright,
trademark or exclusivity-clearance guarantees.
