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

### Next bounded slice: per-workspace controller preview

Add a TypeScript controller to the installed project CLI under `factory` commands.
It runs the six stages in a fresh TypeScript-owned workspace; it does not replace
the public Python launcher, multi-project registry, browser service or MCP server.
The existing installer creates the workspace first. A strict versioned controller
record and exclusive process lease live under `.foundry/state/factory/`.

- FC-01: `init`, `configure`, `status`, `run`, `review`, `approve`, `cancel` and
  `recover` operate without a Python subprocess. A local fake adapter exercises
  Research through Ship, with no account, API billing or external publication.
- FC-02: Plan and Design require an explicit reviewed SHA-256. Plan approval
  freezes the exact `approvedCriteria` IDs and expectations. Changed approval
  documents invalidate downstream work; omitted or altered required criteria
  cannot be hidden by a builder's workflow ledger.
- FC-03: Build retains the bounded task/check/repair/checkpoint loop (at most 12
  tasks, at most three repairs per failed task attempt). Failed commands cannot
  advance a task. Use the existing TypeScript lifecycle and workflow functions,
  not a second check runner or handcrafted lifecycle state.
- FC-04: Test settles controller-written command evidence before its final
  verification snapshot, then dispatches a read-only reviewer. Parse its final
  output using `validateReview`; require exact approved coverage and revision
  binding, safe bounded evidence reads and unchanged inputs after review.
  Missing, malformed, failed, unverified, stale or blocking reviews prevent Ship.
- FC-05: Ship is a controller-generated local summary, not another provider turn
  that can alter the reviewed product. Revalidate the review, evidence, approvals,
  lifecycle and workflow before completion. Direct low-level completion in a
  controller-managed workspace must enforce the same gate. Publication remains
  `not_authorized`. Recovery does not infer acceptance from a completed AI task.
- FC-06: Cancellation reaches both provider work and controller-run checks, and
  retains an interrupted state; dead-process recovery preserves the run identity.
  Concurrent writers and malformed/future state fail closed. Billing is local or
  explicitly confirmed subscription only; no API inference or provider fallback.

Reuse the neutral role catalog. Model/reasoning selections remain explicit and
provider capability failures are surfaced, not silently removed. Test fixtures
prove protocol behavior only. This slice does not qualify live providers, migrate
legacy workspaces, promise a sandbox from metadata, or establish model honesty.

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

### Shared-runtime delivery and release readiness

The owner authorized the remaining architecture work after the read-only review.
Keep the approved neutral design. Continue this implementation run, preserving
historical Python workspaces and all provenance. New work should use one typed
application service through the terminal, HTTP and MCP; compatibility remains
explicit until migration preserves old settings, approvals and recovery.

- F-15: Browser and MCP requests stop waiting after a bounded deadline. A timed-out
  write reports its uncertain outcome and is never automatically retried. HTTP
  cancellation does not imply cancellation of product work. Snapshot traces contain
  phase timings, not tokens, prompts or product contents.
- F-16: New project creation, listing, settings, review, approval, run, stop and
  recovery use the same TypeScript application service. HTTP keeps loopback,
  origin/token, bounded-body, finite-asset and document-path protections. MCP
  keeps approval/configuration app-only and never lets model-facing tools approve.
- F-17: Adapter subprocesses receive an explicit environment allowlist. User-selected
  credentials are forwarded only by name; values are never written to receipts.
  Provider registration remains distinct from protocol testing and live qualification.
- F-18: Small existing-repository changes have a documented, tested path that uses
  the existing lifecycle without pretending the six-stage product journey ran.
  Test protection and isolation claims must name the enforcement boundary and limits.
- F-19: README/help/docs and contributor/release procedures agree with the delivered
  commands. Clean install/update/recovery tests preserve user edits. Required checks
  remain in force. Platform and live-provider gaps are reported, never relabelled pass.

### Owner-requested visual refinement before the next runtime slice

Keep the current composition but align landing/docs with the restrained parts of
Cult UI and shadcn: neutral accents in dark/light docs, no orange brand selection,
headline brackets, glow, gradients or decorative landing entrance. Keep existing
controls, keyboard/focus behavior, mobile navigation, search, copy feedback and
motion preferences. Add no UI dependencies; keep the compressed public script
within 165 kB (the pre-refinement measurement was 157,344 bytes gzip).
Reuse the existing flows and content; the implementation is the prototype. Amend
the design system/source map and inspect rendered desktop/mobile and light/dark
states before continuing the controller migration. This refines F-09/F-13 and
does not authorize publishing, live AI execution or retiring Python.

Use focused Node contract/unit tests, CLI/process tests, copied-state migrations,
then existing required checks and browser journeys. Retain Python tests while
they protect the compatibility path. Do not weaken CI/security gates to migrate.
No new native agent loop, training stack, automatic self-rewriting, scheduler,
marketplace or production deployment. Research informs boundaries; it does not
qualify an upstream runtime or authorize executing imported code.
