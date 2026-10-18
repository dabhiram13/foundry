# Managed tasks and existing work

## Outcome

Connect the internal managed-session service to one approved Builder assignment
and the existing scoped-work check and task-completion gates. Exercise the full
bridge on a disposable TypeScript project with actual file edits, failing and
passing tests, and saved check evidence. This is not live-model qualification.

## Current and desired behavior

The session store saves a caller-supplied assignment reference. Its candidate
state cannot complete a task. The scoped core already owns task ordering, exact
scope approval, selected role policies, configured checks and completion.

The bridge must derive its assignment binding from that core, not accept hashes
or a task choice supplied by an executor. After an execution is known to have
stopped, a candidate can request fresh core verification. Only current passing
checks and the existing task-completion operation can record a finished task.
Executor text and a successful model response remain insufficient.

```text
approved next Builder assignment
  -> bound managed session and project claim
  -> explicit bounded execution
  -> candidate with known stopped resources
  -> existing verify -> existing finishTask
  -> reference to actual core evidence
```

## Boundaries

- Keep scoped work and Factory as the only workflow and approval authorities.
- Keep existing host-client mode host-owned. Never launch a managed executor
  from an existing MCP tool, a read operation or storage replay.
- Bind the actual project, run, task, approval, selected role and configured
  checks. Refuse a different project or changed binding rather than silently
  rebinding a running session.
- Serialize admission with relevant existing mutation paths. A durable managed
  project claim must fail closed after interruption, including when a local
  process lock can be reclaimed. This only governs Foundry operations, not
  arbitrary same-user editors or commands; it is not an OS sandbox.
- Preserve uncertain execution outcomes. Core verification cannot establish
  that an unknown external process stopped; trusted inspection remains needed.
- Store references and hashes of core evidence, not duplicate workflow state.
- Check subprocesses must not inherit future supervisor credentials by default.
- Use deterministic test execution for this slice. Do not label fixtures as
  OpenCode, live-model work, containment or owner acceptance.

## Acceptance criteria

- MT-01: Session assignment binding comes from the currently approved next
  Builder task. Missing approval, no ready task, a different root/run, changed
  role or changed check configuration is rejected without dispatch.
- MT-02: An executor candidate cannot directly finish a task. Real current
  passing core checks and finishTask are necessary; failed, interrupted or stale
  evidence leaves the task unfinished.
- MT-03: A disposable TypeScript project is actually edited. A behavioral test
  fails for a wrong implementation, a bounded repair changes the source, and
  real behavior and TypeScript checks pass before task completion is recorded.
- MT-04: Changed scope, approval, role, checks or candidate inputs cannot reuse
  prior verification. Retry remains explicit and does not reset session budgets.
- MT-05: Competing Foundry mutations cannot bypass managed project ownership.
  Test admission races, legacy scoped/Factory entry points, process failure and
  unknown outcomes; a reclaimed process lock does not release a durable claim.
- MT-06: A lost acknowledgement around verification or task recording can be
  inspected safely. Retry does not rerun the executor or record a second task
  completion, and mismatched evidence requires reconciliation.
- MT-07: Verification uses an explicit check execution environment. A sentinel
  supervisor secret is absent from project check subprocesses.
- MT-08: Type checks, focused bridge/session tests, installed package checks,
  Node 24/25 checks and the required scoped gates pass. Existing host-client and
  Factory behavior remains covered. Documentation does not advertise managed
  execution as generally available.

## Storage and release considerations

Preserve existing owner records and JSON workflow authority. Any new session
schema migration must be transactional, checked and fail closed; preserve old
records and never launch effects while reopening. A project claim is a separate
ownership record, not a mirrored workflow snapshot. Interrupted multi-store
changes require explicit reconciliation before ownership can be released.

## Exclusions and dependencies

This slice depends on the typed managed-session foundation. It does not qualify
an OpenCode binary/SDK, connect a model account, incur provider charges, add an
HTTP/MCP managed API, implement PTY/browser tools, promise sandboxing, publish a
package or change learning instructions. Executor qualification and workspace
containment remain separate stages. Owner product acceptance remains separate
from fixture and framework verification.
