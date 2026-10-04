# TypeScript runtime foundation preview

This is a parallel runtime preview, not the TypeScript cutover. Build it with `npm run build:runtime`; the compiled project CLI is `dist/runtime/project.cjs` and targets Node 24.

The CLI can install the compiled runtime into a new workspace, inspect project status, manage a local lifecycle, record workflow evidence, run registered provider adapters, and opt into a per-workspace `factory` controller preview. Its commands are `factory init`, `configure`, `status`, `run`, `review`, `approve`, `cancel`, and `recover`. Controller state is strict, versioned and stored at `.foundry/state/factory/controller.json`; it is not a second multi-project registry.

The controller uses the existing lifecycle, workflow, provider and role contracts. It runs Research → Plan → Design → Build → Test → Ship, with exact-revision owner approvals for Plan and Design, bounded build/check/repair work, and a final read-only provider review validated against frozen criteria, hashed evidence, the final verification receipt and workspace revision. Ship writes a local controller summary only; publication remains `not_authorized`. A provider's successful turn alone never advances the controller.

Before Build, the controller freezes each active accepted required Verify criterion, including its exact ID, expected text and configured check name, command and inputs. Builder changes to the ledger or check mapping fail closed. Review evidence is hashed from file bytes after review and revalidated again before Ship.

The default `./foundry` launcher, Python controller/server, browser UI and MCP paths remain on the existing Python runtime. This is not a cutover, and there is no automatic migration command. ChatGPT execution is unsupported by the TypeScript preview. Provider registry entries describe declared metadata, not qualification or proof that a sandbox is enforced. Factory adapters must support tools, JSONL, cancellation and permissions; Factory allows local billing or explicitly confirmed subscription billing, never API billing. Explicit model and reasoning preferences are preserved.

The slice does not port Python launcher/server/MCP behavior, qualify live providers or accounts, or authorize purchases, deployments or publication. Passing local tests is not full migration completion or production qualification.

## Try the preview without AI

From the framework checkout, after `npm ci`, use a new disposable directory
outside the repository. Do not point this at an existing Python-owned project.

```sh
npm run build:runtime
node dist/runtime/project.cjs --help
preview=$(mktemp -d "$HOME/foundry-preview.XXXXXX")
node dist/runtime/project.cjs install --source . --target "$preview"
node "$preview/.foundry/runtime/project.cjs" status --project "$preview"
node "$preview/.foundry/runtime/project.cjs" workflow guide --project "$preview"
node "$preview/.foundry/runtime/project.cjs" factory --help
```

These commands install local files and read status/guidance. They do not connect
an account or start an AI run. `factory init` is a separate opt-in; it records
workspace settings but does not execute a provider. The copied runtime needs
Node.js 24, not Python or the framework checkout's `node_modules`.

## Interrupted installation

A pending installation blocks ordinary project writes. Preserve its journal and
owner files. With the same compiled source revision that began the installation,
explicitly request recovery:

```sh
node dist/runtime/project.cjs install --source . --target "$preview" --update --recover
```

Recovery refuses a changed source pin or conflicting owner edits. It is not a
force-overwrite option or a Python-to-TypeScript migration command.
