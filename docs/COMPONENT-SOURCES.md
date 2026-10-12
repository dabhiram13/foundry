# Public site component sources

The landing page uses React components in `site/src/landing`. Documentation
uses Astro/Starlight, with shared styles in `site/src/styles/docs.css`.

The scarlet/ink/paper identity is defined in [the visual system](DESIGN-SYSTEM.md).
The landing content is server-rendered and hydrated; native stage, FAQ and
mobile-menu disclosures work without JavaScript. Clipboard feedback uses the
retained control below. Artwork is still, local WebP with responsive sources;
there is no remote embed, WebGL scene, CSS grain filter or font-service request.

The portrait horse, discovery, craft and handoff scenes are AI-generated.
The wide horse variant, SVG identity and share image extend the same system.
The manifest in `site/assets/art/manifest.json` records source boundaries,
dimensions and hashes. Supplied reference images are not shipped. Cormorant
Garamond 600 supplies the local display font and outlined wordmark; its SIL OFL
license and source record are in `site/assets/licenses/`.

The retained controls adapt Animate UI patterns in
`site/src/landing/components/ui/animate-ui.tsx` under the license in
`site/assets/animate-ui.LICENSE.md`, and shadcn source under
`site/assets/licenses/shadcn-ui.txt`. Shared styles are in
`site/src/landing/controls.css`. Third-party fonts and asset attribution remain
beside the assets and in `THIRD_PARTY_NOTICES.md`.
