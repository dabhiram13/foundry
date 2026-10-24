# Managed coding journey

Status: approved D1 scope. Source implementation targets the Linux trusted-local,
fake-endpoint qualification level. This is not live-model or product acceptance.

## Outcome

From an approved scoped Builder assignment, explicitly select a project,
executor/model profile and limits, start a real supervised OpenCode turn, watch
progress, interrupt it, resume with fresh context, run Foundry checks and record
the task through the existing core. A model response never completes a task.

This is the first executable slice of `managed-product-delivery.md`, not the
complete workspace, browser, PR integration or learning engine.

## Current source behavior

- `src/core/session-contract.ts` and `sessions.ts` define durable commands,
  leases, events, pause/stop intents and recovery states.
- `src/runtime/session-store.ts` and the storage worker persist new sessions.
- `src/core/managed-tasks.ts` binds fixture and managed OpenCode execution
  separately to the approved next task, then uses existing verification and recording.
- `src/runtime/opencode.ts` qualifies startup, an empty session and shutdown.
  Its profile purpose is `lifecycle-only`; no coding turn is sent.
- `tests/runtime/openai-compatible.test.ts` exercises host OpenCode against a
  fake endpoint. It does not connect managed session supervision.
- `src/runtime/managed-opencode.ts` supervises coding turns, bounded observations
  and resource shutdown. `managed-service.ts` exposes shared session operations
  through `src/cli/session.ts`, without accepting actor objects from command JSON.
- `tests/runtime/managed-coding.test.ts` qualifies the installed CLI against real
  OpenCode with a fake model endpoint. Existing reducer/fixture tests retain
  deterministic race, saturation, stale-evidence and lost-acknowledgement coverage.

## Required decisions and scope

First executor: the existing pinned OpenCode SDK/binary, requalified at the
chosen version. Do not upgrade just because another version exists. First public
interaction: terminal start/status/events/pause/stop/resume/recover, all through
the shared core. Current options are documented in `../COMMANDS.md`.

Execution must select either an isolated profile or an explicitly consented
trusted-local preview for a disposable trusted project. No bare-local default,
hostile-repository claim, hidden live account discovery or paid run is allowed.
The owner must choose the preview boundary before the first real model run.
The managed workspace UI follows in D2; the public site stays static.

The public command parser must not accept owner/supervisor/inspector actor
objects from JSON. The trusted local application derives authority. A later
HTTP boundary needs authentication, origin protections and separate threat tests.

## Contract boundaries

Use strict Zod schemas with inferred TypeScript types. Names below illustrate
responsibilities; they are not a second persisted workflow state machine.

```ts
type ManagedLaunch = {
  projectRoot: string;
  approvedAssignmentRef: string;
  executorProfileRef: string;
  providerModelRef: string;
  permissionProfileRef: string;
  limitsRef: string;
  consentRef: string;
};

type ExecutorObservation =
  | { kind: 'activity'; sequence: number; text: string }
  | { kind: 'permission-request'; requestRef: string; operationRef: string }
  | { kind: 'candidate'; workspaceDigest: string; stoppedEvidenceRef: string }
  | { kind: 'failed'; evidenceRef: string; stoppedEvidenceRef: string }
  | { kind: 'unknown'; inspectionRef: string };
```

Resolve assignment/approval/role/check identities from existing core APIs; never
trust executor-supplied hashes as authority. Profiles refer to credentials in a
broker, never plaintext in command arguments, messages, SQLite events or receipts.
Bound each field, stream, record, event page and deadline at runtime.

## Changes at the existing boundaries

1. Generalize only the reusable admission, binding, candidate verification and
   recording pieces in `managed-tasks.ts`. Keep fixture and OpenCode dispatch
   explicitly distinct. Do not rename a fixture outcome as real execution.
2. Add a typed managed executor boundary adjacent to the lifecycle probe. Keep
   the deny-only lifecycle probe valid; do not widen its profile silently.
3. Attach owned upstream launch/session IDs to durable effect intents before
   dispatch. Reopening records never launches or retries an effect.
4. Map qualified upstream events into bounded observations. Stream cancellation
   or an idle/abort response is not proof of stopped tools.
5. Add shared command/service calls for CLI controls and event cursors. Keep
   provider/MCP connected-client operations unchanged in meaning.
6. Use existing `verify` and `finishTask` through the managed claim. Do not add
   a second task-completion endpoint or bypass final scope review.

## Acceptance criteria and planned tests

| ID | Observable behavior | Positive and negative proof |
| --- | --- | --- |
| MC-01 | Start derives the current next writable assignment and validates its exact project, scope, Plan/Design approval, role and checks | Approved assignment launches once; stale approval, wrong root, missing Design, changed checks or no ready task cause no prompt or process |
| MC-02 | Executor, provider/model, permission profile, consent and limits are explicit | Selected profile is used; omitted model, missing consent, unqualified capabilities and unsafe profile fail before dispatch; no automatic account/model fallback |
| MC-03 | A real pinned executor performs a coding turn and an actual tool write under supervision | Fake-loopback model response drives real OpenCode tools in a disposable project, passes through durable session state and reaches candidate; fixture-only callbacks cannot satisfy this test |
| MC-04 | Visible observations are ordered, bounded, redacted and reconnectable | Cursor replay has no gaps/duplicates; huge/malformed/out-of-order upstream data, output saturation and sentinel secrets fail safely without exhausting Stop capacity |
| MC-05 | Pause/Stop only finish after owned active resources stop | A deliberately long-running tool produces a periodic file write; after confirmed stop, its process tree is absent and the file remains unchanged for a defined observation interval; abort ack alone never passes |
| MC-06 | Pause, Stop and lease loss cannot race into false success | Stop supersedes Pause, expired supervisors cannot write, CLI shutdown drains, escaped/unconfirmed resources enter recovery-required and keep the project claim |
| MC-07 | Resume is a new bounded execution using fresh validated context | Owner edits are preserved, changed scope/role/checks block resume, repeated resume IDs are idempotent, consumed turns and usage are not reset |
| MC-08 | Crash recovery never replays unknown effects | Kill after launch and around response/recording acknowledgement; reopening inspects without starting, re-prompting or re-recording; unresolved resources need trusted reconciliation |
| MC-09 | Candidate output cannot complete a task | Deliberately wrong code fails real checks; explicit bounded repair changes it; current passing core receipts and existing task recording are required; changed candidate inputs invalidate evidence |
| MC-10 | Managed checks cannot read supervisor credentials by inherited environment | Sentinel endpoint/supervisor credentials stay out of check child environments, visible events and artifacts; project secrets require explicit check configuration and authority |
| MC-11 | The owner can run the journey from the terminal without calling internal APIs | Start -> activity -> Pause -> confirmed pause -> Resume -> candidate -> verify -> recorded task; Stop and denied-permission branches also exercised through the packaged CLI |
| MC-12 | Compatibility and required repository gates hold | Focused tests, Node 24/25 runtime and installed package, applicable site/tooling/catalog/security checks, pre-commit and saved scoped verification; original fixture/client/lifecycle paths remain covered |

MC-05's interval, process supervision mechanism and stop deadline must be fixed
in the implementation profile and test before the run, not inferred from a
quiet output stream. A local process group is insufficient for arbitrary
detached processes. If the profile cannot prove quiescence, return unknown; D2
must use a container/cgroup/VM resource boundary for stronger containment.

## Demonstration, in increasing evidence levels

1. Deterministic protocol fixtures: state, races, limits and hostile responses.
2. Real pinned binary + fake endpoint: actual upstream tools, supervised edits,
   active-stop behavior and current Foundry check/task receipts. No live inference.
3. Separately consented model configuration: a bounded repository feature with
   actual reasoning/tool use. Record provider/model/version, total usage,
   interventions and untested failures. No generic provider claim.

Run level 2 before asking for level 3 consent. Do not weaken the checks to
make a model-generated implementation pass. No task may be recorded after an
uncertain stop, and no task receipt substitutes for final product review.

The scope contract includes the required `managed-executor` check, configured
in `.foundry/project.json`. `npm run test:managed-executor` builds, packs and
installs the source, then runs the real-binary test against the installed runtime.
It fails when the selected binary is absent or qualification is skipped. The
binary-path environment variable is explicitly allowed for this check only.
CI selects `opencode-linux-x64@1.19.0` on Node 24 and 25. Default runtime tests
that skip external binaries cannot satisfy MC-03, MC-05 or MC-11.

The active-stop test requires absence of the tool and its detached descendant
and an unchanged periodic-output file for 400 ms. Process inspection is bounded
to 16,384 `/proc` entries and 128 KiB per environment; cleanup has a four-second
server deadline. Descendants must retain the execution marker. Existing unreadable
same-user processes are recorded by PID/start time before launch; new unreadable
processes keep the outcome unknown. This trusted-local mechanism is not a sandbox.

## Storage and migration

Add fields or tables to the new managed-session subsystem only when needed.
Migrations are transactional, versioned and checked against old records. Keep
existing JSON workflow and owner/provider settings intact. Store references
to current evidence, not copied approval/task state. Multi-store acknowledgement
recovery must remain idempotent. Redacted logs and private runtime state remain
outside Git; no secrets are captured as model messages.

## Exclusions

No production sandbox claim for trusted-local, public HTTP daemon, visual
workspace, PTY/browser UI, autonomous PR/CI operations, managed payments,
publication, automatic memory adoption, optimizer, parallel workers or learning.
Do not advertise complete Devin/OpenHands parity after D1 passes.

## First implementation order

1. Define launch/profile validation and fail-before-dispatch tests.
2. Connect real upstream turns to existing durable effects and candidate gates.
3. Qualify active-tool cancellation and crash/lost-ack recovery.
4. Expose the terminal journey through shared services; run the real-binary
   end-to-end test and installed-package regression.
5. Record scoped verification and present the actual working journey. Start D2
   only after D1's declared evidence passes; ask separately for live-model use.
