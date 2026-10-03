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
The wispy Canvas sky is original Foundry code, not ForgeUI's paid Zephyr source.
