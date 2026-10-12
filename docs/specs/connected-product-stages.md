# Connected Research and Design

Extend the existing contracted work run, not a second controller. The host
coding client supplies reasoning and tools. Foundry captures sources, validates
typed handoffs and keeps exact terminal approval between stages.

The optional `preparation: {}` contract enables Research -> Planner -> Plan
approval -> Designer -> Design approval -> Builders -> Reviewer -> local handoff.
Contracts without preparation keep their existing shorter workflow.

## Acceptance criteria

- RD-01: Research assignments use the selected neutral role and the existing
  bounded public-HTTPS/local-document source reader. Source selection and
  synthesis are separate host turns, with no provider invocation.
- RD-02: Research reports quote captured excerpts. Empty or unavailable-only
  captures, fabricated quotations, altered snapshots and malformed reports do
  not unlock planning. Local-only research keeps its explicit limitation.
- RD-03: Planning receives the research. Design receives the approved plan and
  research, covers each criterion once, and records implementation, primary and
  failure states, responsiveness and accessibility. UI work includes a user
  journey, information architecture, wireframes, visual rules, component states
  and validation plan as bounded text handoffs, not proof of rendered UI quality.
- RD-04: Plan approval is required before Design submission. Saving Design
  changes the exact scope revision and requires another terminal approval.
  Builders, verification, task completion, review and completion require current
  preparation and approved scope. Spec, plan, selected-policy, artifact or source
  tampering cannot silently preserve valid downstream evidence.
- RD-05: CLI and project-bound MCP use the same core. Mutations require current
  snapshots. Pause, resume, cancellation, interrupted capture and a second client
  preserve the run identity without manufacturing completed stages or approvals.
- RD-06: Older contracts and adapter-driven products remain compatible. Tests
  cover the full connected journey, packaged tools, failure/staleness and CLI.
  Documentation and the generated client skill explain the full and short paths.

## Verification

Runtime and installed-package tests cover RD-01 through RD-06; static-site,
tooling, catalog and exact-index security gates protect the repository. Qualify
Node 24 and 25. Fixtures prove the local protocol, not live model execution.

No live-provider use, package publication, Homebrew release, deployment or owner
acceptance is granted by this change.
