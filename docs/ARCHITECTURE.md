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

Foundry controls progression and approval. The provider performs bounded work.
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

## Distribution boundary

Everyday users install `@dabhiram13/foundry` from npm; contributors build from
the source checkout. The package exposes
one Node executable and does not bundle project data or credentials. Registry
publication is a separate owner-controlled release action, not part of product
Ship or an automated workflow. See the [release guide](RELEASING.md) for its
preconditions and limits.

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
| `src/core/workflow.ts` | Criteria, evidence, decisions and handoff records |
| `src/core/install.ts` | Managed files, conflicts and recoverable installation |
| `src/core/migrate.ts` | Explicit legacy import with backups and conflict checks |
| `src/core/roles.ts` | Provider-neutral role validation |
| `src/runtime/jobs.ts`, `src/runtime/worker.ts` | Local worker threads and confirmed shutdown for terminal runs |
| `src/runtime/providers.ts` | Adapter execution, messages, cancellation and recovery |
| `src/runtime/environment.ts` | Restricted provider child environment |
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

The first Build task configures real required checks with declared inputs and
maps each approved Plan criterion to a check. Missing checks stop progression.
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
