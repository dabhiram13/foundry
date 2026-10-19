# Third-party notices

Foundry is distributed under the MIT License in `LICENSE`. Runtime dependency
notices are retained with the package and embedded in each copied runtime:

- Zod: `licenses/Zod-MIT.txt`.
- parse5, used to read research pages without running scripts: `licenses/parse5-MIT.txt`.
- entities, used by parse5: `licenses/entities-BSD.txt`.
- Model Context Protocol server and core libraries, version 2.3.1:
  `licenses/MCP-SDK-LICENSE.txt` (Apache-2.0 with retained MIT contributions).
- jsonc-parser, used for preserving client configuration: `licenses/jsonc-parser-MIT.txt`.
- OpenCode JavaScript SDK 1.19.0, used by the internal lifecycle qualification:
  `licenses/OpenCode-MIT.txt`. The OpenCode executable is not bundled.

The neutral role kit and vendored skill libraries retain their source and
license records beside their files. `library/provenance.json` records the
supplied source information; absent origins are not claims of new authorship.

## Public site

The static landing and documentation site retains attribution and license files
beside applicable assets in `site/assets/licenses/`. Inter variable Latin is
vendored from `@fontsource-variable/inter` under SIL OFL 1.1. Its notice is
retained in `site/assets/licenses/Inter-OFL.txt` and applies to the outlined
Foundry name as well as the font file.

The wordmark contains Inter glyph outlines, not a new typeface. The horse
mark is a vector silhouette extracted from the owner-approved AI-generated
illustration. The former artwork scenes are no longer shipped; owner-supplied
reference images were not embedded or distributed. Neither
generation nor owner approval is a copyright, trademark or exclusivity-clearance
guarantee. See `docs/DESIGN-SYSTEM.md` for the visual and provenance boundaries.

Site controls adapt shadcn/ui under the MIT notice in
`site/assets/licenses/shadcn-ui.txt`. The former Animate UI components were
removed, not relicensed. Their historical notices remain with those revisions.
See `docs/COMPONENT-SOURCES.md` for current source references.
