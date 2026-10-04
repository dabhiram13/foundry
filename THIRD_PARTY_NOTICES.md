# License notices

The framework's MIT license and copyright notices are retained in
`.foundry/LICENSE-framework` (`LICENSE` in the framework repository).

Bundled skills keep their own licenses, copyright notices, and source links beside
their files in `library/skills/`. Retain them when copying or modifying those skills.
`library/provenance.json` records the supplied source information; missing origins
are not claims of new authorship.

## Plugin panel

The MCP panel bundles the official MCP Apps and OpenAI MCP Extensions libraries
and their declared dependencies. Full pinned package notices are retained in
[app/DEPENDENCY-NOTICES.md](app/DEPENDENCY-NOTICES.md). The Python sign-in bridge
is original implementation of the documented OAuth flow; the noncommercial
Sign in with ChatGPT DevKit is not bundled.

## Animate UI

The app adapts [Animate UI](https://github.com/imskyleen/animate-ui)'s button,
copy feedback, Radix control, text splitting and radial introduction patterns
for Foundry. The upstream registry and documentation were inspected October 3,
2026. Copyright (c) 2025 Elliot Sutton. The complete
[MIT + Commons Clause notice](app/assets/animate-ui.LICENSE.md) is retained and
embedded in the generated JavaScript and MCP panel. These adaptations are part
of the Foundry application, not a standalone component bundle. The framework's
MIT license does not remove the upstream restriction on component redistribution.

Motion is pinned in package.json; its MIT notices are retained in the bundle.

## Typography and identity

Inter variable Latin normal is vendored from `@fontsource-variable/inter` 5.2.8
under SIL OFL 1.1. Its [license](app/assets/licenses/Inter-OFL.txt) and
[source record](app/assets/licenses/Inter-SOURCE.md) are retained. It is served
locally and embedded in the MCP panel, not fetched from a font CDN.

The Foundry mark and wordmark are original SVG artwork. Superset's public page
is a visual reference, not a source of copied artwork, code or brand assets.

## shadcn/ui and Base UI

Fields, Select, Card, Item, Alert, Empty, Spinner and supporting primitives adapt
[shadcn/ui New York v4](https://github.com/shadcn-ui/ui/tree/295a1f114a138f23b5dfee0e0c6812394dfeb90c/apps/v4/registry/new-york-v4/ui).
Its MIT license is retained in [app/assets/licenses/shadcn-ui.txt](app/assets/licenses/shadcn-ui.txt)
and embedded in generated assets. Local adaptations share Foundry's tokens and
retain the animated Button. Model suggestions compose Base UI's free-form
Autocomplete; this is not a shadcn Combobox. Base UI and Lucide package notices
are retained by the bundle. See [component sources](docs/COMPONENT-SOURCES.md).
