# Inside Foundry

Foundry is one terminal-first TypeScript framework on Node.js 24. The interactive
terminal and explicit commands use the same core. There is no browser workspace,
HTTP workspace server, MCP bridge or alternative Python controller in the shipped
runtime. The landing page and documentation are a separate static build.

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
                           existing Vercel connection
```

Foundry controls progression and approval. The provider performs bounded work.
The product repository contains the application, which can use any stack.
A successful provider turn or passing check alone does not prove the whole product.

## One executable, two sizes of work

- **New product:** Research → Plan → Design → Build → Test → Ship. Plan and Design
  need exact-revision owner approval. Build makes bounded tasks, runs configured
  checks, attempts limited repairs and saves Git checkpoints.
- **Repository change:** a scoped `work` run connects a spec to implementation,
  verification and completion. It does not invent Research, Design or product
  Ship evidence for a small fix.

Both reuse state, check, provider and recovery contracts. Noninteractive commands
return errors rather than ask for hidden consent. JSON is output for scripts,
not a separate API service.

## Specialist roles

A role contains a name, purpose, instructions and requested permission mode.
The neutral catalog is validated before dispatch. Stage defaults select roles;
model preferences are checked against the adapter's declared capabilities.

Roles are reusable policies, not continuously running services or an automatic
parallel agent swarm. One controller determines handoffs and required results.
Read-only reviewers report findings; write-capable implementers repair defects.
Metadata does not prove that a provider actually enforces requested permissions.

Optional skills and recipes are source material, not extra engines. They cannot
grant owner approval or change spending rules. There is no automatic third-party
extension installation or executable package marketplace.

## Module map

| Location | Responsibility |
| --- | --- |
| `src/cli/` | Arguments, terminal interaction and output |
| `src/core/projects.ts` | Shared project operations |
| `src/core/factory.ts` | Six-stage coordination, task/check/repair loop, review and Ship |
| `src/core/factory-contract.ts` | Validated state and artifact contracts |
| `src/core/lifecycle.ts` | Scoped runs, checks, receipts and completion |
| `src/core/workflow.ts` | Criteria, evidence, decisions and handoff records |
| `src/core/install.ts` | Managed files, conflicts and recoverable installation |
| `src/core/roles.ts` | Provider-neutral role validation |
| `src/runtime/providers.ts` | Adapter execution, messages, cancellation and recovery |
| `src/runtime/environment.ts` | Restricted child environment and redaction |
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

The boundary is not an OS sandbox. A sufficiently privileged runtime can access
local files or alter checks. Independently protected acceptance checks and stronger
execution isolation remain improvements, not guarantees. Live-provider reliability,
native Windows and performance need separate evidence.

## Design references

| Reference | Useful pattern | Foundry's choice |
| --- | --- | --- |
| [OpenCode](https://opencode.ai/docs/agents/) | Primary/specialist roles and planning/build permissions | The controller owns product progression and approvals |
| [Pi](https://github.com/earendil-works/pi) and [packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md) | Small core with optional skills | Reusable policies, not automatic extension execution |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) | Saved sessions and recoverable long-running work | No Python REPL, schedules or recursive agent network |

These are references, not bundled dependencies or qualified Foundry providers.
Their published benchmarks do not establish Foundry's performance.
