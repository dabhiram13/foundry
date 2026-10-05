# Your first product with Foundry

Install Foundry, describe an idea and work through it from your terminal. Your
files stay in the folder you choose. When you run a step, the selected cloud AI
provider may receive its prompt and selected files. Plan and Design stop for
your approval. Ship summarizes tested work; it does not publish or deploy.

## 1. Check your computer

You need:

- macOS or Linux. The launcher is not qualified on native Windows.
- Python 3.11 or newer with `venv` and pip support. See
  [Python downloads](https://www.python.org/downloads/).
- Git. See [Git installation](https://git-scm.com/downloads).
- Codex CLI. Follow [OpenAI's installation guide](https://developers.openai.com/codex/quickstart).
  Foundry's built-in route expects a ChatGPT subscription login, not metered API
  billing.

```sh
python3 --version
git --version
codex --version
```

Node.js 24 LTS is needed to build the developer panel, docs site or TypeScript
preview; it is not needed just to use the stable Python launcher. Foundry's launcher
bootstraps its private Python environment and existing requirements; it is not
an npm package or hosted service.

The TypeScript runtime is an opt-in preview. Its commands require Node 24 and a
prebuilt `dist/runtime/foundry.cjs` bundle; from the checkout, run
`npm ci && npm run build:runtime` when that bundle is absent. The typed route
does not install dependencies automatically and does not require Python in
`PATH`.

## 2. Install and inspect the terminal commands

From the folder where you keep projects:

```sh
git clone https://github.com/dabhiram13/foundry.git
cd foundry
./foundry --help
```

No browser opens and no provider runs for `./foundry` or `./foundry --help`.
By default products are kept in the sibling `products/` directory. Choose an
isolated location explicitly when needed:

```sh
./foundry --products-dir /absolute/path/to/products list
```

The optional browser view shows the same local projects at
`http://127.0.0.1:8765`; keep the terminal window running while you use it:

```sh
./foundry ui
```

To use another products folder in the browser:

```sh
./foundry ui --products-dir /absolute/path/to/products
```

Choose another port with `./foundry ui --port 8766`. Older `./foundry --port`,
`./foundry --no-browser`, and `./foundry --products-dir PATH` without a
terminal command remain compatible but are deprecated.

## 3. Sign in to Codex

In a second terminal, complete the official subscription login:

```sh
codex login
codex login status
```

Foundry asks for explicit subscription confirmation before a Codex step.
It never silently authorizes metered API billing or changes provider selection.
Do not paste credentials into an idea or product document.

On macOS, Foundry may select the Codex executable bundled with the desktop app
instead of the `codex` found on your shell `PATH`. They can be separate
installations with different login states. See [Codex executable selection](PROVIDERS.md#a-codex-request).
Set `FOUNDRY_CODEX=/absolute/path/to/codex` before a command to choose one
explicitly, and log in with that executable if needed.

## 4. Create and configure a product

```sh
./foundry new reading-list \
  --idea "A local reading list where I can add links and filter unread items."
./foundry configure reading-list --confirm-subscription
./foundry status reading-list
```

`new` creates a product workspace and does not start provider work. Settings are
saved per product. Omitted `configure` flags preserve the saved model and
reasoning; pass `--model ""` or `--reasoning ""` to reset either value. A model
endpoint or key alone is not an agent runtime.

## 5. Run, review and approve

Run exactly one current step at a time. The first two invocations produce
Research and then the Plan:

```sh
./foundry run reading-list
./foundry run reading-list
./foundry review reading-list
```

Research completes before Plan is generated. For a pending Plan or Design,
`review` prints the document, its SHA-256 version ID and a shell-quoted
approval command. Copy the printed ID; do not invent one:

```sh
./foundry approve reading-list --revision SHA256_FROM_REVIEW
./foundry run reading-list
```

The same sequence applies to Design. After its reviewed version is approved,
continue one stage per command:

```sh
./foundry review reading-list
./foundry approve reading-list --revision SHA256_FROM_REVIEW
./foundry run reading-list
./foundry run reading-list
./foundry run reading-list
```

These last invocations advance Build, Test and Ship. Substitute the exact digest
printed by each `review`; the example placeholder is not an approval token. The
terminal refuses a step that awaits approval and never approves on your behalf.
`status`, `new` and
`run` print the product slug, location, current state, history, failures and
the next command. A fresh product is **Research ready**; a finished six-step
workflow is **Ship completed**.

## 6. Stop, retry and update

```sh
./foundry stop reading-list
./foundry status reading-list
./foundry run reading-list
```

`stop` asks the running provider process to cancel. If no step is running, it
leaves the project unchanged. An interrupted or failed step can be retried with
`run`; inspect the saved failure first. Do not edit `.foundry/state/` by hand.

To update this checkout, save local changes and run:

```sh
git pull --ff-only
./foundry --help
```

For a different product location, repeat the same `--products-dir PATH` option
on every command. Product-local `.foundry/providers.json` is copied from the
framework only when that product is created; changing the framework registry
does not rewrite an existing product's provider configuration.

## Provider metadata and boundaries

```sh
./foundry providers
./foundry providers reading-list
```

These commands list saved provider details, not a tested connection. Experimental
ChatGPT sign-in and use are browser-only; terminal steps direct you to
`./foundry ui`. Foundry includes Codex, but does not ship agent adapters for
Claude or Qwen. To connect an existing local agent executable, follow the
[reviewed local-agent setup](PROVIDERS.md#developer-recipe-reviewed-local-agent-executable).
Product steps require an actually tested connection with local billing. The
separate paid API route is not enabled by these commands; see the technical
provider guide for its explicit billing rules.

## Optional TypeScript runtime

The default `./foundry ...` commands above still use the Python runtime. To try
the separate TypeScript service, build its bundle once, then opt in explicitly:

```sh
npm ci
npm run build:runtime
./foundry typed new reading-list --idea "A local reading list with unread filtering."
./foundry typed list --json
./foundry typed status reading-list
./foundry typed configure reading-list --role build=backend
```

Creation installs a TypeScript-owned workspace without starting provider work.
The typed runtime defaults to the same sibling `products/` folder; pass
`--products-dir PATH` to any typed command to select another. `typed run`
advances one stage. Plan and Design still require exact-revision owner approval;
subscription setup can be saved unconfirmed, but execution requires explicit
confirmation. The first Build implementation turn must add product source,
configure real required checks, and write `docs/product/checks.json` with one
explicit mapping for each approved Plan criterion. Mappings must include the
Plan document as a check input and are frozen before checks run.

Before a first `typed run`, initialize and commit the workspace's Git history,
log in through the selected provider's own CLI, and explicitly confirm
subscription billing when required. These are setup instructions, not evidence
that a live provider has been qualified.

`./foundry typed ui --port 4321 --no-browser` starts an authenticated,
loopback-only browser transport. `./foundry typed mcp` starts the official
stdio MCP transport; its model-facing tools intentionally omit configure and
approve. Provider sign-in stays in the provider's own CLI. This typed preview
does not migrate or mutate legacy/unmarked children, expose paid Factory API
billing, or qualify live provider permissions. Environment filtering limits
which variables are inherited by adapter processes, but is not OS isolation:
same-user file and network access remain possible. See
[the provider guide](PROVIDERS.md) and [migration boundaries](specs/typed-foundry.md).

## Troubleshooting

| What you see | What to check |
| --- | --- |
| `python3` is missing or too old | Install Python 3.11+ with `venv`, then check `python3 --version`. |
| `codex` is missing | Follow the official Codex install guide and check `codex --version`. |
| Subscription confirmation is refused | Check `codex login status` for the selected executable; see [Codex executable selection](PROVIDERS.md#a-codex-request). |
| ChatGPT execution is refused in terminal | Use `./foundry ui`; the experimental consent flow is browser-only. |
| Product is not found | Repeat the exact slug or UUID and the same `--products-dir` option. |
| A step fails or is interrupted | Read `status` and the failure history, then retry with `run`; do not hand-edit state. |
| Port 8765 is busy | Use `./foundry ui --port 8766`, or inspect the existing local server. |

## Privacy and inference

Product folders, plans, code and test results are local. Local files do not mean
local inference: a cloud provider receives the prompt and selected project
content for a run. Keep secrets out of prompts and review the provider's data
policy. The no-AI bounded-model example in [examples/README.md](../examples/README.md)
exercises the local request format only. It is not a tested connection to a live
agent or a product-building agent.

[Back to documentation](README.md) · [Foundry overview](../README.md)
