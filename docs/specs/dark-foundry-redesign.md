# Dark Foundry redesign

## Approved direction
The owner chose Superset's visual and interaction language and requested a new
Foundry logo. Preserve the local-first product and existing lifecycle; replace
the pale, card-heavy presentation in the real app, not in a standalone prototype.

## Research and composition
Superset's rendered site uses Inter, a near-black background, square white
buttons, orange brackets/selection details, a centered two-line headline, a
large product demonstration, quiet feature sections and a compact footer.
Adapt that hierarchy to Foundry's real capabilities; no fake customer logos,
waitlist, universal-provider claim, remote execution or deployment claim.

Landing: clear outcome → labeled example walkthrough → three practical
benefits → real source installation → concise FAQ → docs/GitHub footer.
Workspace: compact navigation → idea composer or product desk → vertical stage
list on desktop → current work and documents. Narrow screens use a horizontal
stage list and stack the context pane below the work.

## Acceptance criteria
- D1: Dark semantic tokens, locally bundled Inter and original vector identity
  consistently cover landing, workspace, drawers, settings and reviews.
- D2: Landing walkthrough has keyboard-operable tabs and a visible example
  label. Browsing it starts no AI run and writes no product data.
- D3: Installation commands remain exact and copy success/failure is visible.
- D4: Workspace entry, creation, approvals, retry, stop and provider consent
  keep their existing behavior. No provider or lifecycle backend changes.
- D5: Body copy describes what happens next, without internal framework jargon.
- D6: All screens fit 360px and 390px; keyboard focus, reduced motion and 200%
  zoom remain usable. Status is communicated with text, not color alone.
- D7: Original specialist portraits remain; the pale cloud background is removed.
- D8: TypeScript, panel build, focused studio/factory browser checks and the
  configured framework verification pass. Rendered desktop/mobile QA is separate.

## Verification boundaries
Local simulated providers only. No live account, paid AI, hosting or publishing.
An open PR and passing checks do not establish owner acceptance of the design.
