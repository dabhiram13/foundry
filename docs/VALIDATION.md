# Testing Foundry

Framework verification uses Node 24 and 25, local fixtures, and static site checks. It
does not run paid AI or contact provider accounts.

## Required project gates

The standard aggregate is `npm test`. It runs each of these groups once:

- `npm run check:runtime`: runtime typecheck/build/tests and isolated package test.
- `npm run check:site`: site typecheck/build/content and local-link checks.
- `node --test tests/tooling.test.mjs`: exact-index secret-scanner and catalog
  regression fixtures.
- `node scripts/check_catalog.mjs`: active catalog integrity.
- `node scripts/security_scan.mjs --whole-tracked`: high-confidence secret scan
  over tracked files.

CI uses the same Node-only runtime and static checks with pinned actions. The
package test builds and installs a local candidate tarball globally with normal
npm script handling outside the checkout. It checks the public bin, version
command, excluded files and installed assets, then uninstalls it without
removing the fixture project. The `prepack` hook builds the runtime for a normal
`npm pack`.

Research fixtures cover source limits, public-address checks, redirects,
cancellation, snapshot changes and matching quotations. Network responses use
controlled fixtures.

Connected fixtures also exercise source-backed Research, Plan and Design
approvals, dependent tasks, criterion-level review, altered artifacts, stale
approvals and cancellation-safe source capture. CLI and real stdio MCP journeys
include continuation in a second client and installed candidate-package behavior.
These are local protocol tests, **not a live-model product trial** or proof that
the model follows each role correctly.

Interface fixtures use synthetic PNGs to test capture bounds, hashes, dimensions,
source snapshots, component/state mapping, mobile/desktop coverage, exact Design
approval and final visual comparison. They reject missing or changed evidence,
unsafe paths and blocked/unverified reviews. Service fixtures still complete
without images. The PNG fixtures are not screenshots of a product, and must
never be presented as visual-quality evidence. A guided trial exercised the
earlier lifecycle; this rendered-preview extension still needs a live-model
product trial and an owner visual review. A same-brief one-shot comparison has
not been run. No learning or self-improvement engine is included.

## Managed-session foundation checks

Session fixtures use a private SQLite directory and a real storage worker. They
cover strict input validation at both message boundaries, duplicate/stale
commands, competing worker connections, transaction rollback, event cursors,
pause/stop races, checkpoints, byte/turn limits, lease fencing, uncertain effects,
unsafe paths, checked migrations and worker shutdown/restart. The installed
tarball also opens its storage worker and records a pending intent outside the
checkout. No intent is dispatched by these tests.

Supervisor and inspector fixtures are trusted application-code stand-ins. They
do not prove an executor actually stops, a provider respects permissions, or
core checks can be bypassed. A candidate remains awaiting verification. Live
executor conformance, authenticated transport and workspace containment remain
unqualified. The bridge below adds local project edits and checks, not live-model
execution. See the [session specification](specs/managed-session-foundation.md).

## Managed-task bridge checks

The internal bridge fixtures use a disposable TypeScript project, not a model.
They write an incorrect implementation, run real Node behavioral tests and the
TypeScript compiler, explicitly retry with corrected source, and use existing
`verify` and `finishTask` evidence to record the task. Executor output alone,
unconfirmed candidates and stale evidence cannot record completion.

Boundary cases cover changed approval inputs, project ownership, competing
legacy mutations, process death, filtered check environments, Stop and lost
creation or task-recording acknowledgements. Fixture actors and callbacks are
trusted local application code. These checks do not qualify OpenCode, a live
provider, a sandbox or the complete product-building experience. See the
[bridge specification](specs/managed-task-bridge.md).

## Public website checks

Static checks validate every generated page, local link and anchor, search
assets, metadata, identity and asset budgets. UI-driven checks separately inspect
the landing and docs at narrow mobile, tablet and desktop widths, including
long commands/tables, navigation, search, theme controls, keyboard focus and
reduced motion. Reflow at browser zoom should not clip controls or force page-wide
horizontal scrolling; code and tables may scroll inside their own containers.

Browser results are supporting website evidence, not a replacement for framework
verification. Record browser versions and widths, and leave untested engines
and physical devices unverified.

## Test an integration

Use the [provider integration checklist](QUALIFICATION.md) to test an adapter
with an authorized account. Keep fixture and live results separate, with
reproducible commands and the versions tested.
