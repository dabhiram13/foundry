# Visible design in connected product work

## Outcome

An interface cannot reach Design approval with prose alone. The host builds a
preview in the product's real application, shows it to the owner, and saves a
frozen visual baseline. Builders receive that baseline. Review compares the
running result with the approved screens as well as checking behavior.

This first slice changes the connected source workflow, not the separate npm
0.5.1 adapter journey. It does not introduce a desktop application, a model
launcher, model training, or self-improvement. A later product trial must compare
a worthwhile app with a same-brief, same-model one-shot baseline. Local fixtures
do not establish design quality or an advantage over that baseline.

## Behavior and boundaries

- The approved Plan names a writable UI specialist. Interface criteria must
  have tasks assigned to that specialist. The Designer may write the preview
  after Plan approval, but must stop before production integration.
- Interface Design includes the existing six UX handoffs, the chosen design
  system, component source paths and states, preview instructions, screen routes,
  criterion links, and PNG evidence for desktop, mobile and declared states.
- Foundry reads bounded project-local files, checks hashes and PNG dimensions,
  and retains copies. It does not start a server, fetch the preview URL, operate
  a browser, or authenticate that an image was captured from the app.
- Approval covers frozen evidence, not mutable original screenshot files or a
  promise that a URL will stay available. Changing accepted evidence invalidates
  it. Normal implementation changes do not rewrite the approved baseline.
- Final review names that exact Design and compares every baseline view with
  current rendered evidence. Missing, stale, invalid, gap or unverified evidence
  cannot complete interface work. Functional checks remain required.
- Existing service work and small scoped work remain available. Old text-only
  interface handoffs need replacement and renewed approval, not silent acceptance.

## Acceptance criteria

- VD-01: Reject text-only interface Design and incomplete screen/state/viewport,
  component or criterion coverage; service Design remains usable without images.
- VD-02: Reject missing, changed, oversized, non-PNG, wrong-size, escaping and
  symlinked evidence. Freeze bounded source and image copies under this run.
  Original-file edits do not alter the accepted baseline; saved-copy edits block it.
- VD-03: Require approved Plan before preview work and renewed exact approval
  after saving Design. UI criteria have an explicit writable UI specialist.
- VD-04: Carry preview instructions, frozen artifacts and visual comparison
  requirements through host assignments, CLI/MCP context, review and handoff.
  No second model runtime, automatic approval, browser or server starts.
- VD-05: Require final evidence against the exact Design and every baseline view.
  Failed/gap/unverified reviews block completion; changed files, receipts, Design
  or approval invalidate old review. Retain review evidence with local handoff.
- VD-06: Exercise positive/negative paths through the shared core, CLI and real
  stdio MCP with second-client continuation. Pass Node 24/25, package, static-site,
  tooling, catalog and security gates. Update source-preview guides honestly.

The owner still judges visual quality. These gates establish inspectable,
revision-bound evidence, not proof of taste, usability, deployment or acceptance.
