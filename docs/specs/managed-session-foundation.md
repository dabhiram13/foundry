# Typed managed sessions

## Outcome

Add a transactional session foundation for explicitly managed coding work.
This is the first runtime stage, not a working coding executor or workspace UI.
Existing scoped runs, Factory state, provider attempts and connected-client
ownership stay unchanged. No file-store migration or dual-writing is included.

The service records one approved assignment reference, an explicit executor
profile reference, owner commands, event cursors and effect intents. Accepting
an intent never launches an executor. A later supervisor must qualify and
dispatch those effects, enforce workspace ownership and bridge real core
verification before a task can complete.

## Boundaries

- Strict Zod contracts provide inferred TypeScript types. State is a
  discriminated union; owner input cannot claim supervisor authority.
- New session data lives in a private directory outside product repositories.
  Node's SQLite connection runs in a dedicated worker, with short transactions,
  foreign keys, checked migrations and rollback journaling.
- Idempotency, revision checks, state, events and intents commit together.
  Journal replay reads saved observations; it never replays execution.
- Lease expiry fences stale writes and requires inspection. It does not stop
  processes. Pause and stop remain requests until a trusted supervisor confirms
  quiescence. Resume is a fresh bounded turn, not prompt replay.
- The internal actor context must be supplied by trusted application code, not
  deserialized from a client request. No authenticated transport ships here.

## Acceptance criteria

- SESSION-01: Reject unknown fields, malformed IDs, invalid state payloads and
  oversized input at both the client and storage-worker boundaries.
- SESSION-02: Identical commands return the original receipt after restart,
  even with an old revision. Reusing a request ID for different content or a
  different session fails. Other owners cannot read or mutate the session.
- SESSION-03: Stale revisions, invalid transitions and unauthorized actors leave
  no partial state, events or effects. Concurrent commands have one winner.
- SESSION-04: State revision and event sequence are separate. Heartbeats and
  bounded visible output do not continually stale owner controls. Cursor pages
  are ordered, bounded and gap-free; invalid/future cursors fail explicitly.
- SESSION-05: An active project binding has one managed session. Creation does
  not launch anything. Terminal stop releases this claim; uncertainty does not.
- SESSION-06: Executions require an instance, a random lease token and an
  increasing fence. Expired or superseded owners cannot write. A lost lease
  records recovery-required without automatically starting another execution.
- SESSION-07: Pause/stop acceptance is not confirmation. Stop supersedes pause.
  Confirmed pause produces a checkpoint; resume makes a new execution. Unknown
  effects block retry. Owner acknowledgement alone cannot resolve recovery.
- SESSION-08: Database reopening preserves receipts, events, intents and fences.
  Unknown migrations, altered checksums, unsafe paths and storage contention
  fail closed without deleting owner data. Worker failure rejects pending work.
- SESSION-09: Focused Node 24/25 tests cover persistence, races, rollback,
  expiration and recovery, with existing framework/package checks preserved.

## Exclusions and next stage

No model calls, account setup, billing, executor launch, HTTP/MCP session API,
PTY, browser, containment, Git or learning engine is added. Internal supervisor
fixtures test the contracts, not a live provider. The next stage must bind the
store to existing prepareAssignment/verify/finishTask authority and exercise
real edits and checks in a disposable TypeScript project. A managed completion
cannot be inferred from an executor's text or one tool's exit status.
