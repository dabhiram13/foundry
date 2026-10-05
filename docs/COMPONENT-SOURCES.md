# Public site component sources

The only Foundry UI shipped to visitors is the static public landing and
documentation site. Shared landing controls live in `site/src/landing`; the
site does not ship an interactive product workspace or app component library.

The retained controls adapt Animate UI patterns in
`site/src/landing/components/ui/animate-ui.tsx` under the license in
`site/assets/animate-ui.LICENSE.md`, and shadcn source under
`site/assets/licenses/shadcn-ui.txt`. Shared styles are in
`site/src/landing/controls.css`. Third-party fonts and asset attribution remain
beside the assets and in `THIRD_PARTY_NOTICES.md`.

`history/COMPONENT-SOURCES-old.md` preserves the earlier application
component research. It mentions dependencies and controls that are not part of
the current runtime or public site.
