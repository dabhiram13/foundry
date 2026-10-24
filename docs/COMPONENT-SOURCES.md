# Public site component sources

The landing uses source-owned React components in `site/src/landing`.
Documentation uses Astro/Starlight and its native Pagefind search. Both share
the [visual system](DESIGN-SYSTEM.md) and `site/src/styles/tokens.css`.

## Component mapping

| Public component | Source or design reference | Implementation |
| --- | --- | --- |
| Actions and navigation | [shadcn Button](https://ui.shadcn.com/docs/components/radix/button) | Local `ui/button.tsx`, Radix Slot, class-variance-authority; native buttons or anchors. |
| Hero primary action | [Cult UI Halo Button](https://www.cult-ui.com/docs/components/halo-button) | Static rim adapted as source-owned CSS in `controls.css`. Visual reference, not a claim to use the Base UI/Motion keyboard or animation implementation. |
| Optical hero | [Cult UI Fluted Glass](https://www.cult-ui.com/docs/components/fluted-glass), [registry source](https://www.cult-ui.com/r/fluted-glass.json) | Local `ui/fluted-glass.tsx` wraps Apache-licensed `@paper-design/shaders-react` 0.0.80. Local original SVG, zero speed, lazy WebGL enhancement with a complete static fallback in `optical-signal.tsx`. |
| Copy commands | [Button](https://ui.shadcn.com/docs/components/radix/button) | Original local `ui/copy-button.tsx`, with written success/failure and retry. No tooltip or motion dependency. |
| Stage and FAQ | [Accordion](https://ui.shadcn.com/docs/components/radix/accordion) | Native details/summary with matching visual/state recipes, not the Radix Accordion keyboard API. |
| Mobile menu | [Collapsible](https://ui.shadcn.com/docs/components/radix/collapsible) | Native disclosure plus Escape/focus return. Not a modal. |
| Installation and content | [Card](https://ui.shadcn.com/docs/components/radix/card), [Separator](https://ui.shadcn.com/docs/components/radix/separator) | Semantic sections and dividers, not imported Card widgets. |
| Availability | [Badge](https://ui.shadcn.com/docs/components/radix/badge) | Passive text labels for published, source preview and in-development work. |
| Docs search and theme | [Starlight overrides](https://starlight.astro.build/reference/overrides/), [Pagefind UI](https://pagefind.app/docs/ui-usage/), [Input](https://ui.shadcn.com/docs/components/radix/input) | Preserve native components and style actual controls in `site/src/styles/docs.css`. No duplicate search engine. |
| Colors and typography | [shadcn theming](https://ui.shadcn.com/docs/theming) | Local semantic tokens, local Inter, system monospace. Notion is a density reference, not a dependency. |

shadcn source is MIT licensed; its notice is retained in
`site/assets/licenses/shadcn-ui.txt`. Icons come from the installed Lucide
package. This is one control system, not a mix of component kits.

Cult UI is MIT licensed. Its notice is retained in `site/assets/licenses/cult-ui.txt`.
Paper Shaders' Apache 2.0 license and NOTICE ship beside it as
`paper-shaders-LICENSE.txt` and `paper-shaders-NOTICE.txt`; bundles also retain
attribution and a pointer to these files. Powered by [Paper Shaders](https://shaders.paper.design).
No remote sample image, paid preset or artwork from another creator is shipped.

## Identity and assets

The small horse silhouette comes from the previously approved generated Foundry
identity. The name uses Inter glyph outlines under SIL OFL 1.1, not a new font.
The README banner contains only that mark and name. The social image uses the
same monochrome identity. Assets and font notices are local in `site/assets`.
The Fluted Signal optical SVG is original source artwork for this revision.

The old illustration scenes, display font and Animate UI primitives are no
longer shipped. Their history and source boundaries are recorded in
[provenance](PROVENANCE.md). Generation and owner approval are not copyright,
trademark or exclusivity-clearance guarantees.
