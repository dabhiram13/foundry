# TypeScript runtime foundation preview

This is a parallel runtime preview, not the TypeScript cutover. Build it with `npm run build:runtime`; the compiled project CLI is `dist/runtime/project.cjs` and targets Node 24.

The CLI can install the compiled runtime into a new workspace, inspect project status, manage a local lifecycle, record workflow evidence, run registered provider adapters, and opt into a per-workspace `factory` controller preview. Its commands are `factory init`, `configure`, `status`, `run`, `review`, `approve`, `cancel`, and `recover`. Controller state is strict, versioned and stored at `.foundry/state/factory/controller.json`; it is not a second multi-project registry.

The controller uses the existing lifecycle, workflow, provider and role contracts. It runs Research → Plan → Design → Build → Test → Ship, with exact-revision owner approvals for Plan and Design, bounded build/check/repair work, and a final read-only provider review validated against frozen criteria, hashed evidence, the final verification receipt and workspace revision. Ship writes a local controller summary only; publication remains `not_authorized`. A provider's successful turn alone never advances the controller.

The task-planning turn may create `docs/product/tasks.md` while the installed project still has `checks: []`. The first implementation task must create or change product source, configure real required checks, and write `docs/product/checks.json` with exact, unique coverage of the approved Plan IDs:

```json
{"schema_version":1,"criteria":[{"id":"AC-001","check_name":"behavior"}]}
```

Each mapped check must be required, declare inputs, and include `docs/specs/product.md`. The controller freezes all required check settings, including working directory and environment declarations, separately from the workflow criterion contract inputs (pinned to the Plan). The mapping and required-check set cannot silently change after freeze. This records the declared check-to-criterion relationship; a passing command is not proof that it semantically satisfies the requirement.

An owner-approved Plan revision can replace requirements. The TypeScript controller preserves retired criteria in the ledger with nonrequired `rejected` successor records rather than deleting history. This preview-only record state is not a Python workspace migration.

Review evidence is read from bounded regular files, hashed from their bytes after review, and revalidated before Ship. The reviewer receives the strict review JSON contract and is asked to report `pass`, `fail`, `unverified`, and blockers honestly. Lifecycle completion and recovery also enforce the Factory review gate when controller state exists.

The default `./foundry` launcher, Python controller/server, browser UI and MCP paths remain on the existing Python runtime. This is not a cutover, and there is no automatic migration command. ChatGPT execution is unsupported by the TypeScript preview. Provider registry entries describe declared metadata, not qualification or proof that a sandbox is enforced. Factory adapters must support tools, JSONL, cancellation and permissions; Factory allows local billing or explicitly confirmed subscription billing, never API billing. Explicit model and reasoning preferences are preserved.

The slice does not port Python launcher/server/MCP behavior, qualify live providers or accounts, or authorize purchases, deployments or publication. Passing local tests is not full migration completion or production qualification.

The separate multi-project `./foundry typed new` service initializes Git for a
new empty workspace and saves only the safe framework metadata, neutral roles,
ignore rules and idea in its initial local checkpoint. Provider configuration,
credentials, runtime bundles and state are not staged. Its local HTTP preview
serves built documentation from only the `docs`, `_astro` and `pagefind`
namespaces, with static reads capped at 8 MiB.

## Try the preview without AI

From the framework checkout, after `npm ci`, use a new disposable directory
outside the repository. Do not point this at an existing Python-owned project.

```sh
npm run build:runtime
preview=$(mktemp -d "$HOME/foundry-preview.XXXXXX")
node dist/runtime/project.cjs install --source . --target "$preview"
cli="$preview/.foundry/runtime/project.cjs"
node "$cli" status --project "$preview"
node "$cli" workflow guide --project "$preview"
node "$cli" factory --help
```

These commands install local files and read status/guidance. They do not connect
an account or start an AI run. After registering a supported local adapter in
the workspace's `.foundry/providers.json`, `node "$cli" factory init --name
"My product" --idea "A local product idea" --adapter ADAPTER_NAME --project "$preview"` records the
opt-in controller settings; `node "$cli" factory status --project "$preview"` shows the next action.
Before Build, initialize its local Git history with `git -C "$preview" init` if
the workspace is not already a repository. Checkpoints are local commits, not pushes.
The installed test journey covers an empty-check workspace, two product-changing
tasks and local Ship using a fake provider. No live provider run is claimed as
tested. The copied runtime needs Node.js 24, not Python or the framework
checkout's `node_modules`.

## Interrupted installation

A pending installation blocks ordinary project writes. Preserve its journal and
owner files. With the same compiled source revision that began the installation,
explicitly request recovery:

```sh
node dist/runtime/project.cjs install --source . --target "$preview" --update --recover
```

Recovery refuses a changed source pin or conflicting owner edits. It is not a
force-overwrite option or a Python-to-TypeScript migration command.
