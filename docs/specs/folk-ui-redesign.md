# Folk-inspired Foundry UI

## Research and direction

The October 3 request is a complete interface rewrite, design-system first.
The first neutral/Geist treatment was rejected as too close to the old layout.
The owner now asks for a ground-up Foundry-specific system, using Folk's LinkedIn
CRM page, Bencho Finds and Best Designs on X as references. Restore the original
specialist portraits. Prototype the spatial system before replacing all screens.
The owner selected Soft studio from three visual directions and asked for the
top bar, icons and all interactions to align with it. The accepted direction uses
a soft powder-blue canvas, Manrope, Phosphor duotone icons, a paper idea sheet,
horizontal steps and a work/document surface with specialist context. Licensed
Folk typography, artwork and source are not copied.

## Flows and prototype

Preserve introduction → workspace → create product → Research → reviewed Plan
and Design → Build tasks → Test → Ship summary. Preserve existing routes,
browser history, exact-version approvals, settings, cancellation and retries.
The introduction's board is explicitly an example, never real product progress.
Empty workspace content remains real; product name, step, status and next action
drive the working screens. Runtime details remain secondary.

## Design and build

Define semantic tokens and primitive contracts first. Rebuild the introduction,
global top bar, product drawer, composer, product rows, stage navigation, task list, documents, activity,
role identities, settings and document review with those tokens. Browser and
embedded panel share the same React tree and locally embedded font/assets.
The UI PR is separate from the Build-loop implementation it builds upon.

## Acceptance and verification

- UI-1: A visibly new spatial and visual system, not a recoloring of the previous
  dashboard. Original specialist portraits are restored; layout, background,
  typography, utility icons and interactions follow the accepted prototype.
- UI-2: Real creation, six steps, approval, settings, persistence, retry and cancellation
  still work; Build task details remain available.
- UI-3: Keyboard focus, Escape/return focus, 44px mobile targets, reduced motion,
  200% zoom and long text work without horizontal page overflow.
- UI-4: TypeScript, reproducible panel generation and all configured checks pass.
- UI-5: Rendered browser evidence records desktop/mobile and live task states using
  a fake provider; live AI/account/deployment remain outside this verification.

## Current handoff

Soft studio is visually accepted. The live rewrite adds clear labeled top-bar
actions, a product drawer with Escape/focus restoration, real document previews,
an expandable long idea, and context that follows the inspected step. Standalone
examples are not live-app evidence. Fresh scripted and rendered QA passed on the
integrated app, including lifecycle feedback, meaningful error persistence,
desktop/mobile navigation, settings and actual 200% zoom. The acceptance comparison
and verification boundaries are recorded in docs/UI-DESIGN.md.

## Known separate limitation

Chaining three failed repairs, Try again, Stop, and Try again can exhaust the
provider's lifecycle attempt budget. Rendered QA preserved the exhausted fixture;
it did not reset internal state or claim that recovery chain passed. No provider
budget behavior is changed by this UI redesign.
