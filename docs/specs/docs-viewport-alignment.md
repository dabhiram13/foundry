# Documentation and viewport alignment

## Outcome

Make the README, public guides and website describe the same current product.
Keep the approved scarlet, ink and paper identity. Make published installation
and the connected source preview easy to distinguish before a person starts.

## Current and desired behavior

The source supports Research, Plan, Design, Builders and Reviewer assignments,
but the landing setup and visual-system guide still describe an earlier
connection. The README depends on deployed assets. The first-project guide
only describes adapter-driven work, leaving connected users without a clear entry.

Update the active Markdown sources, navigation, landing copy and README banner.
Do not rewrite historical specifications as if later features existed then.
Fix reproducible public-site layout or interaction defects at their shared cause.

## UX handoff

- Journey: identify the installation path, connect the selected tool, describe
  a small product, inspect Plan and Design, continue to a local handoff.
- Information architecture: npm first-project guide and a separate connected
  client guide; commands and technical references explain both.
- Wireframe: retain the existing landing composition and install block; place
  source-preview guidance beside it, with a direct guide link.
- Visual rules: scarlet, ink and paper; local horse mark and outlined wordmark;
  solid reading surfaces; no new artwork style or live 3D.
- Component states: usable mobile menu, disclosures, copy feedback, focus,
  search and theme controls; readable commands and tables at narrow widths.
- Validation: static content/link regressions plus recorded browser inspection
  of landing and docs at 320, 375, 768, 1024 and 1440px, zoom/reflow, keyboard,
  reduced motion and no-JavaScript navigation where applicable.

## Acceptance criteria

- DOC-01: active public docs and landing distinguish npm 0.5.1 adapter work from
  connected source work. Neither claims a connected npm or Homebrew release.
- DOC-02: the connected guide covers source build, separate target repository,
  connection preview/apply/remove, host-owned checks/spec/contract, two owner
  approvals and continuation. No hand-edited private state is needed.
- DOC-03: README uses the current Foundry horse mark and wordmark in a
  self-contained banner, without depending on a website deployment.
- DOC-04: generated documentation links, anchors, assets and search include
  the connected guide. Content regressions reject the obsolete connection claim.
- DOC-05: exercised landing and docs have no page-wide horizontal overflow or
  clipped controls at the target widths; menus, disclosures, links, focus and
  reading surfaces remain usable. Unchecked browsers/devices stay unverified.
- DOC-06: runtime, package, static-site, tooling, catalog and exact-index secret
  gates pass on committed source. Dependency audit reports no known findings.

## Boundaries

No runtime onboarding change, provider/model use, billing, package publication,
Homebrew tap, deployment, reference-art reuse or merge is part of this change.
Fixtures and browser checks do not establish live-model product quality or owner
acceptance. Existing approval and security rules remain unchanged.
