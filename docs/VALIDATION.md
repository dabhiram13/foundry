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
legacy mutations, connection updates, process death, filtered check environments,
Stop and lost creation or task-recording acknowledgements. Fixture actors and callbacks are
trusted local application code. These checks do not qualify OpenCode, a live
provider, a sandbox or the complete product-building experience. See the
[bridge specification](specs/managed-task-bridge.md).

## OpenCode lifecycle checks

The internal probe uses SDK 1.19.0 with an explicitly selected binary and expected
SHA-256 digest. Protocol fixtures exercise authentication, version/configuration
checks, project binding, redacted failures, request/output limits, deadlines and
confirmed process shutdown. Private unresolved launch records block re-admission.

To run the separate real-binary check against a trusted disposable project:

```sh
npm run build:runtime
FOUNDRY_OPENCODE_QUALIFY_BINARY=/absolute/path/to/opencode \
  node --test --test-name-pattern='real pinned OpenCode' dist/runtime-tests/opencode.test.cjs
```

Without that explicit selection the external-binary test is skipped. It creates
and deletes an empty session, with hostile project plugin/MCP settings disabled.
No model prompt is sent. Idle abort and process shutdown do not qualify stopping
active tools, managed task execution or sandbox containment. See the
[lifecycle specification](specs/opencode-lifecycle.md).

## OpenAI-compatible host check

The default connection suite reads the provider guide's custom-endpoint example
and checks that connect, refresh and remove preserve its provider, model and key
reference in both JSON and JSONC, alongside unrelated MCP settings and comments.

Select the pinned OpenCode 1.19.0 binary explicitly for the separate host test:

```sh
npm run build:runtime
FOUNDRY_OPENCODE_QUALIFY_BINARY=/absolute/path/to/opencode \
  node --test dist/runtime-tests/openai-compatible.test.cjs
```

This Linux/macOS test starts a fake loopback Chat Completions endpoint and runs
the real host with a fresh home, its own test key and no inherited account
configuration. It checks model selection, authorization, streamed tool calls,
Foundry MCP context, a real file write and tool results reaching the next turn.
Owned processes and temporary files are cleaned up. The binary may need to fetch
its provider package on first use; no live inference or provider account is used.
Without explicit binary selection, the test skips; CI does not claim this
external-binary result from the default suite.

This is not the internal deny-only managed probe. It permits tools in a trusted
disposable host project. No live model, cloud/local provider, rate-limit behavior,
active cancellation, sandbox, product quality or complete coding workspace is
qualified by this test. Use the [integration checklist](QUALIFICATION.md) before
claiming support for an actual provider/model combination.

## Managed coding qualification

The required Linux gate packs and installs the current build, then runs the
shared service and installed CLI against a real pinned OpenCode binary and a
fake loopback model endpoint. Select the binary explicitly:

```sh
npm run build:runtime
FOUNDRY_OPENCODE_QUALIFY_BINARY=/absolute/path/to/opencode \
  npm run test:managed-executor
```

Missing selection, a missing/non-executable binary or skipped qualification
fails this gate. CI installs `opencode-linux-x64@1.19.0` and runs it on Node 24
and 25. Default runtime tests may skip external binaries; they do not replace
this gate. Scoped framework verification explicitly allows the binary-path
variable for this check only. Do not pass provider credentials through it.

The qualification covers real file writes, failed verification, explicit repair,
task recording through core receipts, cursor replay, denied shell permissions,
Pause of a tool with a detached descendant, fresh resume with owner edits and
crashed-process inspection without prompt replay. The stop test observes an
unchanged periodic-output file for 400 ms after confirmed shutdown and checks
that its processes are absent. It is a bounded trusted-local stop test, not
proof against hostile processes that remove the inherited execution marker.
Sentinel supervisor values must stay out of check environments and visible events.

Existing reducer, fixture and protocol tests additionally cover lease fences,
Stop/Pause races, output limits, stale approvals/evidence and lost task-recording
acknowledgements. The [D1 spec](specs/managed-coding-journey.md) maps the full
acceptance criteria. Live inference, production isolation, browser/terminal
workspaces, PR delivery and product quality require separate qualification.

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
