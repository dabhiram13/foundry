# Public site component sources

The landing page uses React components in `site/src/landing`. Documentation
uses Astro/Starlight, with shared styles in `site/src/styles/docs.css`.

The retained controls adapt Animate UI patterns in
`site/src/landing/components/ui/animate-ui.tsx` under the license in
`site/assets/animate-ui.LICENSE.md`, and shadcn source under
`site/assets/licenses/shadcn-ui.txt`. Shared styles are in
`site/src/landing/controls.css`. Third-party fonts and asset attribution remain
beside the assets and in `THIRD_PARTY_NOTICES.md`.

The approved Mist landing uses native links and disclosures, original local
landscape vectors and a procedural Three.js 0.180.0 scene. Its geometry and
canvas labels are authored here; no Spline or Imageory asset is embedded.
Three.js is MIT-licensed, with the full notice in
`site/assets/licenses/Three-MIT.txt` and generated scene chunks. The initial page
does not include Three.js: it loads a separate module only near a visible desktop
scene with fine pointer, no reduced-motion preference and no data-saving flag.
It renders on input/resize, not an idle loop. Mobile, reduced-motion, no-JS and
WebGL failure keep the static keycap illustration.

CSS coordinates tactile press/hover/focus feedback, logo key tilt, miniature
card diagrams and progressive scroll reveals where supported. Unsupported
scroll timelines leave all content visible. Reduced motion disables animation.

The owner-selected Imageory reference is
https://imageory.in/image/169-wide-surreal-pastoral-landscape-e06a7e.
Its green hills, lavender flowers and blue sky can frame solid reading surfaces;
the inspected page did not provide a commercial reuse license. Actual embedding
remains blocked until the owner supplies an authorized asset and permission.
