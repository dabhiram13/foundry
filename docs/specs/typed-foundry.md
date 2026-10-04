# Typed Foundry

## Authority and outcome

The owner approved the architecture direction and delegated the language choice.
Use strict TypeScript on Node.js 24 LTS. Preserve the finalized React design and
local-first product behavior. Migrate in working slices; do not publish or merge
without separate authority. Generated products are not restricted to TypeScript.

Current behavior is a Python lifecycle, provider process runner, installer,
workflow ledger, local HTTP/MCP service and React client. Provider role loading
is Codex-specific and reviewer prose does not itself gate Test. Documentation
contains personal assumptions and links to GitHub instead of an integrated site.

Desired behavior is one typed controller shared by CLI/browser/MCP, neutral role
policies, validated provider messages, required structured reviews, and a static
documentation section. Keep state, settings, cancellation, recovery, approvals,
checks, Git checkpoints, billing consent and notices; do not replace them with
superficially similar stubs. The active shipped runtime should not require Python
after cutover. Optional providers and archived test tooling may require it.

## Boundaries and migration

- `src/core`: lifecycle, versioned state, installer, workflow records, reviews.
- `src/runtime`: provider sessions, native translation, cancellation and auth.
- `src/cli`: public commands and compatible lower-level project commands.
- `src/server`: loopback HTTP and MCP over the same core; preserve origin/token
  guards, read-only chat tools and credential isolation.
- Existing React components remain. Static landing/docs must not require the job
  API. Astro Starlight is the chosen docs foundation, styled to the existing theme.
- Canonical roles live in `.foundry/roles.json`; native Codex TOMLs become a
  rendering/compatibility surface. Existing role selections/settings survive.
- No silent schema migration or two independent writers. Keep the old entrypoint
  until parity; import only with no active work, backups and explicit action.
  Old clients must fail safely on a migrated state, not write it unknowingly.
- Do not reinterpret previous approvals for changed document bytes. Plans need
  stable explicit criterion IDs before a new structured-review lifecycle can run.
  Old prose-only plans remain readable and need an explicit updated approval.
- Do not rename or discard the historical ledger, notices, credentials, Git
  history or locally edited managed files. Reject future formats and symlink
  escapes. Crash-safe install/update and atomic replacement remain requirements.
- Compile a self-contained runtime before switching launchers or managed
  installation. Do not replace Python subprocesses with differently named Python
  subprocesses and call that a TypeScript migration.

## Review contract (lead-owned)

Test runs configured checks through the controller, then a read-only provider
reviews the approved criteria and saved results. A successfully completed provider
turn is not a passing review. Its final output is a JSON review result with the
plan and workspace revisions supplied by the controller, exactly one result per
approved criterion, evidence references, and explicit blocking findings. Required
FAIL, UNVERIFIED, missing/malformed results, stale references, changed inputs or
blocking findings prevent progression. The controller stores validated results;
the reviewer cannot write lifecycle records. Structural validation is not proof
that the model's assessment is correct or that deployment/customer acceptance
occurred. Native schema-constrained generation is optional; runtime parsing is not.

## Installation and provider support

Keep existing command names and readable human output; add machine-readable
output and diagnostics. Installed package naming/publication requires a separate
release action. Codex remains available; a second independent runtime must pass
the same contract before it is advertised as supported. Fixtures cannot establish
live qualification. Unsupported permissions, model preferences or billing modes
fail explicitly. No automatic API fallback, paid runs, account changes or deploys.

## UX and documentation

Existing design is accepted. Preserve landing/workspace composition and controls.
Add Docs navigation to a static searchable `/docs` experience: start, prerequisites,
first project, existing projects, providers/support status, commands, approvals,
recovery, troubleshooting, architecture, contributing and licenses. Keyboard,
mobile and reduced-motion behavior must remain usable. Current Markdown is the
content source; don't fork drifting copies. Remove named-owner assumptions and
stale current-product names, not copyright/history. UI regressions require browser
evidence. Public pages must not create projects or initialize credentials.

## Acceptance criteria

- F-01: CLI, browser and MCP share validated commands and lifecycle transitions;
  same fixture journey and invalid transitions prove parity.
- F-02: Required blocking/unknown/malformed reviewer results cannot produce Ship
  even if command checks pass; matching valid results can progress.
- F-03: Explicit plan criterion IDs and document revisions survive approval and
  handoffs; changed criteria require new approval and stale review is rejected.
- F-04: Both runtime adapters consume neutral role policies; unsupported native
  role model/reasoning preferences are not silently ignored.
- F-05: Registered, protocol-tested and live-qualified remain distinguishable.
  Verify protocol with fixtures; disclose any unavailable live qualification.
- F-06: Cancellation reaps owned processes and interruption/recovery preserves
  failures, pending authority and unknown external outcomes.
- F-07: Billing consent, redaction, loopback origin/token checks and credential
  boundaries pass negative tests. No unapproved paid fallback.
- F-08: Copied old-project fixtures migrate with backups, conflict safety and
  preserved settings/history; future schemas and concurrent mutation fail safely.
- F-09: Docs build statically and links, anchors, search, commands and mobile/
  keyboard navigation work without the local job service.
- F-10: README/AGENTS/help/docs use consistent generic operating instructions;
  attribution/history/compatibility names are retained intentionally.
- F-11: Clean installation is exercised on supported platforms. Windows support
  is not claimed without process/locking/path/credential evidence there.
- F-12: Strict typecheck, lint/build and no-Python active runtime checks pass after
  cutover. Transitional legacy tools are identified, not silently removed.
- F-13: Recorded desktop/mobile regression preserves the accepted visual design.
- F-14: Performance comparison uses frozen inputs and repeated measurements;
  report old/new observations rather than unmeasured speed claims.

## Verification and exclusions

Use focused Node contract/unit tests, CLI/process tests, copied-state migrations,
then existing required checks and browser journeys. Retain Python tests while
they protect the compatibility path. Do not weaken CI/security gates to migrate.
No new native agent loop, training stack, automatic self-rewriting, scheduler,
marketplace or production deployment. Research informs boundaries; it does not
qualify an upstream runtime or authorize executing imported code.
