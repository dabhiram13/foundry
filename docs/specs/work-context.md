# Current evidence for scoped work

## Outcome

A coding client can read a concise, versioned snapshot of one scoped run without
invoking a provider, running checks, approving work or modifying saved records.
The saved lifecycle status and current verification evidence are separate facts.

## Current behavior and reproduction

Start a scoped run, verify it, then edit its specification. `work status` still
shows the saved status `verified`. Active completion correctly refuses stale
evidence. A new client needs that distinction before deciding its next action.

## Scope

Add `work context`, with a short human view and `--json` contract. Reuse the
completion evidence validator. Preserve existing state and command contracts.
Read active work first, otherwise the last completed scoped run. Do not apply
scoped semantics to Factory. Reject unstable concurrent reads. This is a local
point-in-time observation, not an approval, security boundary or mutation token.

No MCP, task manager import, provider run, owner-authentication mechanism, website
redesign, release or migration of existing owner records is part of this change.

## Acceptance

- CTX-001: Fresh successful evidence is current and references the run, spec and
  receipt. Two independent readers return the same snapshot revision.
- CTX-002: Changed source, spec, configuration or verification environment makes
  evidence stale. Saved lifecycle status remains intact.
- CTX-003: Missing, failed, interrupted, mismatched or tampered evidence never
  reports current success. Log/report validation uses the completion rules.
- CTX-004: Completed history remains historical after later edits; no read records
  a new completion. Paused and interrupted states give safe next actions.
- CTX-005: Reads do not alter project files, run configured commands, invoke
  providers, expose command arguments/environment values or infer scope approval.
- CTX-006: Conflicting writers, malformed state, unsafe pointers, legacy workspaces
  and Factory ownership fail closed. Concurrent sample changes retry boundedly.
- CTX-007: CLI JSON is one versioned value; default output omits hashes, raw state
  and command arguments. Unknown options are rejected. Installed package exposes
  the same command. Docs distinguish observation from completion authority.

## Checks

Map CTX-001 through CTX-006 to isolated runtime fixtures and CTX-007 to CLI/package
fixtures and static docs checks. Run configured runtime/site/tooling/catalog/
security gates through scoped verification. No live AI account is needed.

This agent-authored specification records the bounded implementation plan, not
independent owner acceptance or approval of future integration stages.
