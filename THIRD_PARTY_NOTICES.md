# Third-party notices

Foundry is distributed under the MIT License in `LICENSE`. Runtime dependency
notices are retained with the package and embedded in each copied runtime:

- Zod: `licenses/Zod-MIT.txt`.
- parse5, used to read research pages without running scripts: `licenses/parse5-MIT.txt`.
- entities, used by parse5: `licenses/entities-BSD.txt`.
- Model Context Protocol server and core libraries, version 2.3.1:
  `licenses/MCP-SDK-LICENSE.txt` (Apache-2.0 with retained MIT contributions).
- jsonc-parser, used for preserving client configuration: `licenses/jsonc-parser-MIT.txt`.

The neutral role kit and vendored skill libraries retain their source and
license records beside their files. `library/provenance.json` records the
supplied source information; absent origins are not claims of new authorship.

## Public site

The static landing and documentation site retains attribution and license files
beside applicable assets in `site/assets/licenses/`. Inter variable Latin is
vendored from `@fontsource-variable/inter` under SIL OFL 1.1. Cormorant Garamond
600 Latin is a local static subset of the Cormorant variable font, also under
SIL OFL 1.1. Its copyright and license are retained in
`site/assets/licenses/Cormorant-OFL.txt`.

The approved main-branch wordmark contains Cormorant glyph outlines, not a new typeface. The horse
mark is a vector silhouette extracted from the owner-approved AI-generated
illustration. Retained scarlet artwork and the social image use AI-generated scenes;
the six owner-supplied reference images are not embedded or distributed.
`site/assets/art/manifest.json` records asset hashes and origins. Neither
generation nor owner approval is a copyright, trademark or exclusivity-clearance
guarantee. See `docs/DESIGN-SYSTEM.md` for the visual and provenance boundaries.

Three.js 0.180.0 renders the optional, original specialist-keycap illustration.
Its MIT license is retained in `site/assets/licenses/Three-MIT.txt` and generated
JavaScript. It is a site-only dependency, not bundled into the CLI. Landscape
vectors and keycap geometry are original; no Imageory artwork or Spline scene
is redistributed.

Site controls adapt shadcn/ui and Animate UI patterns. Their retained notices
are in `site/assets/licenses/shadcn-ui.txt` and
`site/assets/animate-ui.LICENSE.md`. The Animate UI license includes its Commons
Clause restriction. See `docs/COMPONENT-SOURCES.md` for source references.
