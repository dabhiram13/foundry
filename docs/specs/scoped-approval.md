# Approved scope and mapped verification

## Outcome

An existing-repository change can opt into an exact-revision scope contract.
The owner reviews and approves it through explicit terminal commands. Required
criteria must map to configured required checks before verification or completion.
The current-work view separates approval, executed evidence and mapped coverage.

## Scope and authority

Currently scoped work requires fresh executed checks but has no approved-scope
record or criterion mapping. The change adds that optional boundary without
changing provider execution, Factory approvals or check command configuration.
It depends on the existing scoped receipts, safe paths and coordinator lock.

Add an optional `--contract PATH` to scoped start and separate `work review` and
`work approve --revision HASH` commands. Bind approval to the run, specification
bytes, criterion/check mapping bytes and configured check settings. Check execution
uses the existing engine. Preserve legacy runs without inventing an approval.

Manual terminal approval was selected by the owner. This records an explicit
local decision, not authenticated human identity or a sandbox against a process
with the same filesystem/terminal permissions. No client approval tool, MCP,
provider call, automatic approval, npm release or website redesign is included.
Actual client confirmation remains a subsequent integration decision.

## Acceptance

- SCP-001: Opt-in contracts carry unique stable acceptance IDs, requirements and
  check names. Malformed, oversized or unsafe documents fail before enrollment.
- SCP-002: Review is read-only, shows the exact specification, criteria, configured
  commands and one revision. Approval requires that exact current revision under
  the shared coordinator guard and is scoped to one run and document pair.
- SCP-003: Missing approval, changed spec/mapping/check settings and cross-run or
  malformed approval records cannot permit verification or completion.
- SCP-004: Empty mappings, unknown checks and optional-only mappings block approval.
  Required criteria cannot be silently omitted. Check results do not claim semantic
  correctness; the view says mapped checks passed, not that every requirement is true.
- SCP-005: Verification receipts bind to the approved scope. Changes during checks,
  missing enrollment, cross-run receipts and altered scope bindings fail closed.
- SCP-006: Context remains read-only and stable across readers. It reports pending,
  stale or invalid approval separately from current required-check evidence and
  preserves historical completion. Ignored contract files remain fingerprinted.
- SCP-007: Legacy runs retain their lifecycle behavior, Factory-owned work cannot
  enroll in this contract, and existing records need no migration. The expanded
  context JSON has an explicit new schema version.
- SCP-008: Source and installed-package commands have equivalent behavior; human
  output is concise outside explicit review. Node 24/25 and repository gates pass.

## Checks

Map SCP-001 through SCP-007 to isolated scope/context and lifecycle fixtures.
Map SCP-008 to source CLI and exact npm-tarball tests. Run configured runtime,
static-site, tooling, catalog and secret gates on the committed implementation.
An agent-authored spec and fixture approvals are not owner acceptance.
