# TypeScript runtime foundation preview

This is a parallel runtime preview, not the TypeScript cutover. Build it with `npm run build:runtime`; the compiled project CLI is `dist/runtime/project.cjs` and targets Node 24.

The CLI can install the compiled runtime into a new workspace, inspect project status, manage a local lifecycle, record workflow evidence, and run registered provider adapters. Installation writes `.foundry/runtime.json` to mark TypeScript ownership. TypeScript mutations refuse unmarked or legacy workspaces, and the Python low-level mutators refuse TypeScript-marked workspaces. There is no automatic migration command in this slice.

The default `./foundry` launcher, browser UI, and MCP paths remain on the existing Python runtime. ChatGPT execution is unsupported by this preview. Provider registry entries describe declared metadata, not qualification or proof that a sandbox is enforced. Codex execution uses the local executable and requires explicit subscription confirmation or the existing API billing acknowledgements. API reservations and provider-reported usage do not provide a hard dollar cap or independently verified invoice.

This foundation does not port qualification or evaluation behavior, qualify live providers, or authorize account connections, purchases, deployments, or publication.

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
```

These commands install local files and read status/guidance. They do not connect
an account or start an AI run. The copied runtime needs Node.js 24, not Python or
the framework checkout's `node_modules`.

## Interrupted installation

A pending installation blocks ordinary project writes. Preserve its journal and
owner files. With the same compiled source revision that began the installation,
explicitly request recovery:

```sh
node dist/runtime/project.cjs install --source . --target "$preview" --update --recover
```

Recovery refuses a changed source pin or conflicting owner edits. It is not a
force-overwrite option or a Python-to-TypeScript migration command.
