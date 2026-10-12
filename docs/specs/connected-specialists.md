# Connected specialist work

## Outcome

Let an existing coding client plan a bounded repository change, delegate small
tasks to relevant specialists, resume saved progress and return a useful review.
Foundry supplies assignments and records; the host supplies all reasoning and
coding tools. No provider is launched by these operations.

## Contract and progression

The existing schema-version-1 scope contract may include a `plan` with 1–12
ordered tasks. Each task has a stable ID, title, instructions, specialist role,
criterion IDs and dependencies on earlier tasks. All criteria must be covered.
The plan and selected role policies participate in the exact scope revision.
Saving or editing either requires renewed terminal approval.

Planner assignment → saved plan → exact owner approval → next ready Builder
assignment → actual required checks → record task → Reviewer assignment →
criterion-level findings → local completion.

The normal scoped run remains the only coordinator. Existing contracts without
a plan and the adapter-driven product journey remain compatible. Task records
retain their historical receipts; later edits still require fresh final checks.
Review is a host-reported judgment, not proof of independent reasoning or owner
acceptance. A gap, unverified criterion or blocking finding prevents completion.
Changes to source, plan, roles, approval or receipts invalidate the final review.

## Acceptance criteria

- CS-01: Validate bounded plans, stable unique task IDs, coverage, known roles,
  writable builders, read-only reviewers and ordered dependencies. Reject
  unknown fields, cycles, missing criteria and excessive payloads.
- CS-02: Prepare provider-neutral Planner, Builder and Reviewer assignments with
  actual role instructions, scope, task context and evidence references. A
  read-only assignment never launches a provider, runs checks or changes files.
- CS-03: Bind task plans and selected policies to terminal scope approval. Every
  client mutation requires a current snapshot; pending/stale approval prevents
  task completion and review. No MCP approval operation exists.
- CS-04: Record task completion only in dependency order with current passing
  checks. Failed, interrupted or stale evidence cannot become success. Saved
  progress survives a second client, pause/resume and interrupted verification.
- CS-05: Require every approved criterion in a final review and preserve failed
  reports as failed. Missing, stale or blocking review prevents completion even
  when checks pass. Final local handoff includes tasks and review findings.
- CS-06: Expose the same functions through explicit CLI commands and local MCP;
  preserve old contract behavior and reversible OpenCode setup. Qualify Node
  24/25, packaged execution and security/tooling/catalog gates.

Observable checks: runtime unit/protocol/CLI/package fixtures for CS-01–CS-06;
full runtime, static-site, tooling, catalog and exact-index security gates for
integration. Live model behavior is not inferred from fixtures.

## Boundaries and release

No migration is required for old runs. This source preview does not change the
npm version, publish a tap, deploy, auto-approve, enforce a host sandbox or
automatically spawn subagents. Research and Design connected stages follow
this first complete planning/build/review slice. No third-party code is copied.
