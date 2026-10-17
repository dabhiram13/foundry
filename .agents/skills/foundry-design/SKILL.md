---
name: foundry-design
description: Carry the relevant UX artifacts into an implemented and exercised customer journey.
---

# Design

Read docs/WORKFLOW.md and docs/WORKFLOW-CONTRACTS.md, the adopted product brief,
current UX artifacts, and actual UI. Select small/feature/product depth. Use the
six artifact stages research, flows, prototype, design, build, verify: framing;
flows/IA/states; realistic-content prototype; visual direction/tokens/components/
responsive behavior/copy; implemented slice; usability/accessibility/rendered QA.
Reuse current artifacts for unchanged stages; re-review affected handoffs after
contract changes. Gates check recorded evidence, not design taste.

The adopted product brief overrides generic glass, gradients, shadows, and themes.
Implement only within existing authority and assigned paths. Exercise changed UI
at target widths, supported themes, keyboard/focus, contrast, reduced motion, and
relevant loading/empty/error states. Missing rendered evidence is UNVERIFIED.
The coordinator owns final lifecycle operations; never handcraft state or receipts.

In connected interface work, use the approved Plan's writable UI specialist.
Create the preview slice in the actual product app, not a separate showcase.
Record the design system, real component source paths, screen/state mappings,
routes and criterion links. Use host browser tools for scale-1 PNGs at mobile
and desktop widths and every declared screen state, with file hashes. Show the
running preview and frozen evidence to the owner; stop for exact Design approval
before integration. Final review compares every approved view with current
captures, separately from functional checks. See the preview contract in
docs/COMMANDS.md. Foundry does not start a browser or server, and image presence
does not establish good design or owner acceptance.
