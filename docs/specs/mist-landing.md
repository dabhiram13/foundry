# Mist landing page

## Outcome and authority

The owner approved the Mist concept: a light monochrome page, cool original
landscape framing, tactile controls and one specialist-keycap 3D illustration.
The accepted reference is the standalone concept from this session:
https://app.devin.ai/sessions/969df40425d44986a1b59a4259e93510.
This is a static-site change, not approval to publish, deploy, merge, use a model,
download restricted artwork or change the product runtime.

The owner subsequently selected the pastoral landscape at
https://imageory.in/image/169-wide-surreal-pastoral-landscape-e06a7e and requested
coordinated motion for the logo, buttons and cards. Its public detail page was
inspected: bright blue sky, green hills and lavender flowers fit outer framing
or a lower landscape band. No reuse license was exposed on the inspected page;
the actual image remains blocked pending an authorized original and permission.
Original vectors remain the current fallback, not a substitute claimed as that
artwork. No external creator has been contacted.

## UX handoffs

- Research: compare Three.js, Spline and perspective cards; sample 18 Imageory
  styles. Three.js is MIT; Imageory commercial reuse rights remain unconfirmed.
- Flow: introduction → specialist journey → capabilities → installation choices
  → questions → documentation. The page is not a separate hosted workspace.
- Prototype: approved Mist HTML and original procedural keycaps. Keep the calm
  landscape outside solid reading surfaces, not behind body text.
- Design: off-white surfaces, black pill actions, cool landscape layers, local
  Inter font, responsive cards, visible focus and useful static content.
- Build: React prerendering within the existing Astro/Starlight pipeline; load
  the Three.js enhancement separately and preserve a matching local poster.
- Verify: deterministic site checks and runtime regression gates. Browser,
  accessibility and real-device performance remain separately qualified.

## Acceptance criteria

- M1: prerender a product-building introduction and six specialist stages;
  preserve one main heading, accessible navigation and all documentation links.
- M2: clearly distinguish published npm 0.5.1, OpenCode source preview and planned
  Homebrew/full connected specialists. No invented pricing, traction, universal
  client support, automatic deployment or correctness guarantees.
- M3: retain the standard npm installation example and a copy action that reports
  success or failure. Navigation, installation and FAQ content work without JS.
- M4: ship original local landscape/poster assets. No Imageory downloads,
  hotlinks, externally hosted fonts/models or third-party scene embeds. Keep the
  Three.js license in shipped assets and generated scene code.
- M5: lazy-load 3D only for a visible, capable desktop with fine pointer, no
  reduced-motion preference and no data-saving preference. Compact viewports,
  no JS, failed imports, absent WebGL and context loss retain the static poster.
- M6: render on input/resize, not a permanent animation loop; cap resolution;
  pause when hidden/offscreen; release observers, event handlers, GPU resources
  and pending animation frames on teardown. Keep important content outside canvas.
- M7: preserve the initial JS budget, add a separate scene budget, and retain
  site typecheck/build/tests, tooling/catalog/security, runtime and package checks.

## Boundaries

No state schema, provider launcher, MCP tool, executable, Node requirement or
npm version change. Three.js is a site-only development dependency, not part of
the published CLI bundle. Preserve existing documentation and owner records.
