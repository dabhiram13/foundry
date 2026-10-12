# Project check setup

## Outcome

Use real project scripts as Foundry checks without hand-writing configuration.
New projects still need real test/build scripts, created by the coding client.
Initialization must not invent an application or a passing test.

## Implementation

Add a read-only setup preview and revision-bound application in the shared core,
CLI and project-local MCP. Detect test, build, typecheck and lint scripts from
package.json, honoring npm, pnpm, Yarn or Bun selection. Use existing top-level
inputs and omit known generated/private runtime directories. Never run scripts
during setup. Existing checks and other project settings remain owner-owned.
The OpenCode skill performs setup before starting contracted work.

## Acceptance

- SETUP-1: Empty projects initialize without src/test folders. Setup explains
  missing real scripts and refuses to save an empty or fabricated check list.
- SETUP-2: A supported package with real test/build scripts gets a read-only
  preview; apply requires its exact revision, writes only project settings and
  preserves unrelated fields. Missing directories are never invented as inputs.
- SETUP-3: Existing checks are preserved byte-for-byte. Stale proposals, ambiguous
  package managers, symlinked inputs and application during active scoped or
  product work fail without changing project settings. Setup executes no scripts.
- SETUP-4: CLI and stdio MCP expose the same behavior. MCP apply requires current
  context and proposal revisions. OpenCode can set up an empty project after
  creating real scripts, then start a contracted run without manual JSON editing.
- SETUP-5: Guides explain setup, review, unsupported projects and source-only
  availability. Runtime/package/site/tooling/catalog/security checks pass on
  supported Node versions, with scoped completion recorded by the runtime.

## Boundaries

No provider/account/model changes, dependency installation, publication,
Homebrew work or live-model qualification. No automatic overwriting of existing
checks, no relaxed approval/evidence gates, and no edits to private state.
Existing source installations need init --update and connect --apply to refresh
their managed runtime and connection skill. This is not in npm 0.5.1.
