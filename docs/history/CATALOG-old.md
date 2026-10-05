# Historical record: Foundry catalog

> Retained as an older inventory; current role and reference guidance is in `docs/CATALOG.md`.

Choose the smallest applicable workflow and references. The coordinator selects
roles based on the request, accepted criteria, capability availability, and write
boundaries; the catalog is not an automatic execution pipeline.

## Entry and workflows

`foundry` is the canonical conversational entry in `skills/foundry/`.
`marketcraft` remains a compatible entry in `skills/marketcraft/`.
`product-foundry` remains a compatibility entry. The 37 `foundry-*` workflow names
under `.agents/skills/` are preserved for installed products. Explicit invocation
uses those names; normal conversation can use the shared workflow directly.

Use `foundry-start`, `foundry-discover`, `foundry-spec`, or `foundry-mvp-spec` to
frame the request; `foundry-mvp-build`, `foundry-enhance`, or `foundry-fix-issue`
for authorized implementation; `foundry-design` for the relevant UX handoffs;
`foundry-verify`, `foundry-finish`, or `foundry-deploy` for scoped verification and
release. Resume ongoing work before starting another feature. Other workflows
cover specific product needs; their presence is not authority to activate them.

See WORKFLOW.md for adaptive depth, WORKFLOW-CONTRACTS.md for records/gates, and
PROVIDERS.md for execution capabilities. The coordinator handles commands and
configuration; the owner should not need to choose a role roster or edit JSON.

## Roles

The 28 `.codex/agents/` roles inherit the owner's model and reasoning settings.
Use `planner` for shared interfaces/dependencies; applicable builders for assigned
files; `quality-gate`, `backend-evaluator`, or `design-evaluator` for independent
read-only review. Critics and security-auditor are also read-only. Reviewers return
findings to the coordinator; repairs and final lifecycle operations have separate
owners. Missing test access remains UNVERIFIED.

`market-researcher`, `social-signal`, and `trend-validator` supply dated evidence,
counterevidence, and explicit assumptions. `discovery-critic` challenges the path
from evidence to commercial thesis and scope. `ux-critic` reviews the experience;
`designer` implements the adopted direction; `design-evaluator` inspects actual
rendered evidence. None can claim customer validation from synthetic personas.

## Reference library

The 67 optional library skills are preserved reference material. Read only what
the current task needs. `python3 scripts/marketcraft.py enable-skill NAME` copies a
selected local library skill into `.agents/skills/NAME` without overwriting a
custom copy. Inspect source, license, instructions, dependencies, and relevance
first; installing or replacing external skills is a separate authorized action.
No popularity or model-generated score establishes safety or usefulness.

The 101 supporting documents in `.foundry/references/source-docs/` and recipes in
`.foundry/workflows/` contain historical stack examples. They do not guarantee a
command, tool, linter, or integration exists. Current WORKFLOW.md, actual project
configuration, and owner decisions govern. Some legacy library flows still refer
to old team APIs, fixed stacks, or extra approval steps; read them as reference,
not as a replacement lifecycle. Optional SQL setup is stack-specific.

The adopted product brief overrides generic visual prescriptions. Inventory
counts measure packaging, not proven delivery capability. See VALIDATION.md for
exercised evidence and PROVENANCE.md plus library/provenance.json for origins.
