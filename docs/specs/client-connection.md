# First connected coding client

## Outcome

An existing coding tool can use Foundry's scoped-work and evidence engine without
Foundry launching a second model. Start with OpenCode's local MCP and project-skill
interfaces, keeping manual terminal approval separate from agent operations.

## Current and desired behavior

Scoped context, exact-revision approval and checks already exist as CLI operations.
There is no callable client interface or connection setup. Add one project-bound
stdio MCP server using the official SDK and a focused skill. The host continues to
own conversation, models and credentials. No HTTP service or provider dispatch.

## Scope and dependencies

Expose read-only context and scope review, plus contract-enrolled start, verification,
completion, pause/resume and recovery. Mutations require the latest context snapshot,
validated inside the existing coordinator lock. Do not expose approval, arbitrary
commands, project switching or Factory mutation. Legacy work is readable but remains
CLI-controlled. The local filesystem is not an adversarial sandbox.

Connection setup must preview changes, preserve unrelated OpenCode JSON/JSONC and
skills, refuse collisions, be idempotent and support safe removal. Interrupted setup
must be recoverable without adopting owner files. Use the official MCP SDK and a
reviewed JSONC editor; preserve bundled dependency licenses.

## Acceptance

- CON-001: MCP uses the same core, one explicit initialized project and protocol-only
  stdout. A second session sees saved work; no provider/model/account is required.
- CON-002: Tools never approve scope or execute arbitrary client-supplied commands.
  Start requires a contract; existing approval/evidence gates remain enforced.
- CON-003: Every mutation requires a current snapshot checked under the coordinator
  lock. Stale readers, concurrent writers and changed active-work inputs fail closed.
- CON-004: Preview is read-only; apply/remove preserve unrelated JSONC, configuration
  entries and skills. Collisions, symlinks, malformed config and interrupted writes
  have explicit non-destructive outcomes.
- CON-005: A focused discovered skill teaches context-first operation, explicit
  approval handoff, current-evidence checks and continuation without claiming owner
  consent from a conversation.
- CON-006: Cancellation/disconnection retains evidence and leaves an explicit
  recovery path, rather than silently completing failed or interrupted work.
- CON-007: Source and actual installed-tarball behavior match on Node 24/25. A real
  pinned OpenCode client connects and discovers the tools/skill. Client flow fixtures
  are distinguished from live model qualification and semantic correctness.

## Checks, exclusions and release

Use SDK clients to exercise approval-required, passing, failing, stale, cross-project,
two-session continuation, cancellation and recovery cases. Exercise config preservation,
collision refusal and removal. Qualify a real OpenCode connection without paid calls;
keep any untested model-driven path explicit. Run all repository gates and scoped
verification before completion, then open a focused PR.

No automatic merge of this next PR, npm release, live paid provider trial, hosted
service, second client, website redesign or universal compatibility claim is included.
Existing CLI records and Factory flows stay compatible. No owner approval is migrated
or inferred, and no raw prompts, credentials or environment values are recorded.
