# Inside Foundry

Foundry is one terminal-first TypeScript framework on Node.js 24 or newer. The interactive
terminal and explicit commands use the same core. The landing page and
documentation are a separate static build.

## The boundaries

```text
                         foundry
                terminal UI │ commands / JSON
                            ▼
                    shared project service
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
       product stages   scoped work    install / import
             │              │          safe updates
             └──────┬───────┘
                    ▼
       saved records / approvals / recovery
             │                      │
             ▼                      ▼
      specialist policy      checks / review / Git
             │                      ▲
             ▼                      │
       provider adapter ───► product repository

       Astro / Starlight → static landing + docs
```

For the connected source path, an existing coding client reaches the same scoped
service through a project-bound stdio MCP server. The client owns its model,
conversation, account and coding tools; Foundry returns assignments and validates
saved results. No provider adapter runs behind that server. The workflow is not
a hosted app builder or a separately launched agent team.

Foundry controls progression and approval. The provider or host performs bounded work.
The product repository contains the application, which can use any stack.

## One executable, two sizes of work

- **New product:** Research → Plan → Design → Build → Test → Ship. Plan and Design
  need exact-revision owner approval. Build makes bounded tasks, runs configured
  checks, attempts limited repairs and saves Git checkpoints.
- **Repository change:** a scoped `work` run connects a spec to implementation,
  verification and completion. Its optional task plan connects Planner, relevant
  Builders and Reviewer assignments through that same run and scope approval.
  CLI and MCP share assignment preparation, task progression and review gates;
  the connected host supplies reasoning and tools. No adapter runs behind MCP.
  Optional preparation connects source-backed Research and requirement-linked
  Design in the same run, with exact approval after Plan and after Design.

Both reuse state, check, provider and recovery contracts. Noninteractive commands
return errors when required consent is missing. JSON output supports scripts.

## Managed sessions in development

The source terminal exposes a Linux, local-test-only managed-session preview.
Strict contracts and a dedicated SQLite worker save state, receipts and effect
intents. A shared service derives the local application identity, binds the current
approved Builder task and supervises the explicitly selected OpenCode executor.
Fixture dispatch remains separate. Neither path migrates existing projects or
replaces Factory and scoped-work authority.

```text
approved Builder task → project claim + managed session
                     → explicit executor/profile → actual edits
                     → confirmed candidate → existing verify
                     → saved check evidence → existing finishTask
                     → task-recorded acknowledgement
```

Owner controls use state revisions. Output and lease heartbeats advance a
separate event cursor. Duplicate request IDs return saved receipts, not another
execution. Pause and stop need a supervisor's confirmation of stopped resources.
Expired leases reject writes; an inspector records recovery-required and checks
unknown effects before an owner can explicitly retry. A candidate is not a
verified task. The bridge derives its task from existing assignment preparation;
the original host-client assignment is not relabeled as managed execution.
Fixture work receives neither session actors nor project authority. Verification
runs with a filtered environment and checks exact candidate inputs. Task recording
requires current core evidence, not executor output or a successful tool exit.

A private project claim blocks cooperating scoped, Factory and provider mutations.
Short admission records preserve legacy provider concurrency and cancellation.
Process death does not release an unresolved claim or admission. Trusted inspection
is required before uncertain work continues. The local claim does not prevent an
editor, shell or other same-user process from changing files.

Verification and task recording span two stores. A passing verification enters
`recording-task` with its evidence reference before core task completion. At that
point checks have stopped and Stop cannot undo the recording decision. After a
lost acknowledgement, explicit reconciliation checks the exact core task receipt
before recording the session event, without repeating execution or checks. An
inspector can instead abandon that decision without undoing core history.

The storage directory is private, outside Git working trees, and uses POSIX file
ownership and permissions. Windows needs an ACL-backed storage profile before
this boundary is supported there. These are local data protections, not a
sandbox. Visible events contain bounded, allowlisted activity summaries, not raw
model text or tool output. OpenCode's private local records may contain project
content. Supervisor credentials are not inherited by project checks. The preview
requires an explicit binary digest, local endpoint/model, permission choice,
consent reference, turn/step limits and deadline. It rejects remote inference
endpoints and does not discover accounts. Internal actor contexts never come from
command-line JSON. There is no public HTTP service or managed MCP execution.

For trusted-local stopping, the executor marks its process environment, inspects
same-user Linux processes and terminates marked descendants as well as its server
process group. Descendants must retain the marker. Uninspectable new processes or
uncertain cleanup keep the project claimed for inspection. Existing uninspectable
processes are recorded by PID and start time before launch; they are not treated
as owned descendants. This is not hostile-code containment. Stronger isolation
requires a container or VM boundary in the next stage.

### OpenCode resource qualification

The internal lifecycle probe uses OpenCode's pinned TypeScript SDK and a selected
binary digest. It starts a separate authenticated loopback server with a fresh
home and filtered environment, verifies the effective deny-only configuration,
then creates, inspects, idle-aborts and deletes an empty project-bound session.
Direct local HTTP requests do not inherit proxy settings. Startup output,
response bodies and operation time are bounded; raw logs and credentials are
not saved. A private launch record precedes process creation. An unresolved
record blocks another launch rather than guessing whether it is safe to retry.

Success requires confirmed owned process-group shutdown. This probe does not
dispatch approved tasks, send prompts or qualify cancellation of active tools.
It is a compatibility check on a trusted disposable project, not a sandbox.
Connecting it to managed execution and recovery is separate work. See the
[lifecycle specification](specs/opencode-lifecycle.md).

## Distribution boundary

Everyday users install `@dabhiram13/foundry` from npm; contributors build from
the source checkout. The package exposes
one Node executable and does not bundle project data or credentials. Registry
publication is a separate owner-controlled release action, not part of product
Ship or an automated workflow. See the [release guide](RELEASING.md) for its
preconditions and limits.

Published npm remains 0.5.1. The connected Research/Design workflow and MCP tools
are merged source-preview features, not included in that registry release.
Homebrew distribution is not available. See [connected setup](CONNECTED-CLIENT.md).

## Specialist roles

A role contains a name, purpose, instructions and requested permission mode.
The neutral catalog is validated before dispatch. Stage defaults select roles;
model preferences are checked against the adapter's declared capabilities.

One controller selects role policies, determines handoffs and validates results.
Read-only reviewers report findings; write-capable implementers repair defects.
Metadata does not prove that a provider actually enforces requested permissions.

Contributors can select optional skills and recipes from the reference library.
The controller retains control of approvals and spending rules.

## Module map

| Location | Responsibility |
| --- | --- |
| `src/cli/` | Arguments, terminal interaction and output |
| `src/core/projects.ts` | Shared project operations |
| `src/core/factory.ts` | Six-stage coordination, task/check/repair loop, review and Ship |
| `src/core/factory-contract.ts` | Validated state and artifact contracts |
| `src/core/work-plan.ts` | Connected task/review contracts and historical progress validation |
| `src/core/work-preparation.ts` | Connected Research/Design artifacts, source integrity and stage gates |
| `src/core/research.ts` | Bounded source reading, snapshots and quotation validation |
| `src/core/lifecycle.ts` | Scoped runs, checks, receipts and completion |
| `src/core/session-contract.ts`, `src/core/sessions.ts` | Internal managed-session contracts and state transitions |
| `src/core/managed-tasks.ts`, `src/core/workspace-ownership.ts` | Approved task binding, candidate gates, project claims and mutation admission |
| `src/core/managed-profile.ts`, `src/runtime/managed-service.ts`, `src/cli/session.ts` | Strict local executor profiles and shared managed terminal commands |
| `src/core/workflow.ts` | Criteria, evidence, decisions and handoff records |
| `src/core/install.ts` | Managed files, conflicts and recoverable installation |
| `src/core/connect.ts` | Preview, apply and remove the managed coding-client connection |
| `src/core/migrate.ts` | Explicit legacy import with backups and conflict checks |
| `src/core/roles.ts` | Provider-neutral role validation |
| `src/runtime/jobs.ts`, `src/runtime/worker.ts` | Local worker threads and confirmed shutdown for terminal runs |
| `src/runtime/session-store.ts`, `src/runtime/session-storage-worker.ts`, `src/runtime/session-database.ts` | Typed client, private SQLite worker and atomic managed-session records |
| `src/runtime/providers.ts` | Adapter execution, messages, cancellation and recovery |
| `src/runtime/environment.ts` | Restricted provider child environment |
| `src/runtime/opencode.ts` | Internal typed, owned OpenCode lifecycle qualification, without model execution |
| `src/runtime/managed-opencode.ts` | Managed coding turns, bounded tool observations and confirmed owned-resource shutdown |
| `src/runtime/mcp.ts` | Project-bound stdio tools for the connected host |
| `site/` | Static landing page and searchable documentation |
| `scripts/` | Node build, catalog and exact-index secret checks |

## What counts as complete

```text
approved criteria → explicit check mapping → command receipts
        │                                         │
        └─────────────────┬───────────────────────┘
                          ▼
             structured review + current evidence
                          │
                          ▼
                     local summary
                publication: not_authorized
```

In adapter mode, the first Build task configures real required checks with declared
inputs and maps each approved Plan criterion to a check. Connected scoped work
needs those checks and mappings before enrollment and owner approval. Missing checks stop progression.
Stale evidence is not a pass. Failed checks and interrupted attempts remain
recorded. A checkpoint failure is not misreported as a product-check failure.

Ship requires current review and verification records. Its summary is exposed
only after its hash and bindings are validated. Private state is not an arbitrary
document API. Publication, deployment and accounts remain separate decisions.

## Durability and limits

Locks and journals prevent competing writers and expose uncertain outcomes.
Cancellation is not successful until cleanup is confirmed. Migration is explicit,
backed up and refuses unsupported or active work. Changing a runtime marker cannot
turn old approvals into new review evidence. See [migration and recovery](RUNTIME.md).

Provider processes run with the permissions granted by the host. Use external
isolation for untrusted work. See [security and trust](../SECURITY.md).
