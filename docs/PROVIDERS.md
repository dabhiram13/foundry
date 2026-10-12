# Set up a provider

Foundry sends tasks to an AI tool you have installed and authorized. Each
project uses one connection shared by its specialist roles.

This guide covers provider setup for the **terminal**, including npm 0.5.1.
Using [OpenCode from source](CONNECTED-CLIENT.md)? Keep its existing model,
account and tools instead.

## Choose a provider and model

An adapter connects Foundry to a provider's tools and lists what it can do.
Foundry is not tied to one model or provider. List connections
with `foundry providers`, then choose one with `--adapter NAME` when creating
a project. Foundry does not silently choose a provider or switch to another one.

Use `--model MODEL` or `--reasoning VALUE` on `foundry new` or `foundry configure`
when the adapter supports those settings. Values are passed to the provider;
Foundry has no fixed model list. Omit them to use the runtime's own defaults.
Existing projects keep their saved provider and model preferences.

## Configure consent and selection

Inspect a connection before running it:

```sh
foundry providers PROJECT
```

This reports each adapter's built-in or project configuration source, configuration
hash, declared capabilities and executable availability. It checks files and PATH
without launching the tool or contacting an account. `authentication: not_checked`
means you still need to sign in separately. An available executable is not a
successful login or a guarantee that its script arguments are valid. A missing
executable blocks a product run before its stage starts; you can still create and
configure the project before installing the tool.

### Inspect a saved handoff

```sh
foundry provider status --project /path/to/project
```

Each new attempt records the exact wire input's SHA-256, byte count and 256 KiB
limit. Product stages also record their stage, role revision and upstream document
paths and hashes. Existing task records provide settings, budgets, results and
event-log references. These fields let you compare what Foundry sent across attempts
without saving another copy of the raw prompt or source documents.

The metadata describes Foundry's handoff, not every file the external AI runtime
later reads. It is not a complete session replay. Earlier records remain readable
without the new optional fields.

### Select a connection

Configure a project without launching a provider:

```sh
foundry configure PROJECT --adapter NAME --billing subscription --confirmed
```

The `--confirmed` flag records explicit subscription consent. API billing is
never selected silently; API execution requires a command/request that
explicitly enables it and acknowledges its billing conditions. Local fixture
providers are intended for tests and do not incur external inference.

Replace `NAME` with a registered adapter. Authenticate its runtime through
the provider's official instructions. Do not paste credentials into product
documents. Foundry filters child-process environment and redacts reported
values, but this is not an operating-system sandbox.

## Build a custom connector (advanced)

An adapter translates Foundry requests into calls to another AI tool.

An owner may define additional adapters in `.foundry/providers.json`. Each
adapter declares its name, kind, command, billing modes, environment variable
names and capabilities. The schema validates these fields before dispatch.
Secrets are supplied through the environment, not committed in the registry.
Provider output and saved task records are bounded and validated.

Capabilities include structured output, JSONL, resume, cancel, permissions,
tools, browser, model selection and reasoning selection. A controller requests
capabilities it needs; an adapter that does not declare them is rejected.
Declaring a permission capability does not prove the runtime enforces a
permission boundary. Never treat a declared capability as a sandbox.

To add an adapter:

1. Implement the documented process protocol and cancellation behavior.
2. Add its owner-managed registry entry with the exact supported capabilities
   and billing modes.
3. Add local protocol fixtures for success, malformed output, limits and
   interruption.
4. Follow the [integration checklist](QUALIFICATION.md) to test the connection.

## Register a reviewed local command

For project work, a reviewed agent runtime can be registered as:

```json
{
  "adapters": [{
    "name": "my-agent",
    "kind": "agent-runtime",
    "protocol": "foundry-jsonl-v1",
    "command": ["/absolute/path/to/node", "/absolute/path/to/adapter.cjs"],
    "capabilities": ["tools", "jsonl", "cancel", "permissions", "structured_output"],
    "billing_modes": ["local"],
    "environment": []
  }]
}
```

Replace the example paths with your implementation and declare only the
capabilities and billing modes it actually supports. Save it as `providers.json`
outside the npm installation. Inspect it without running anything, then create
a project with a copy of that configuration:

```sh
foundry providers --providers ./providers.json
foundry new my-project --idea "Describe the project" --adapter my-agent --providers ./providers.json
```

The command array executes directly from the project directory, without shell
expansion. `environment` names additional variables to pass from the caller;
values and secrets must not be stored in this file. A small base environment
(including `PATH`, home, temporary-directory and locale settings) is also passed.
Use absolute command paths for portable configuration. Relative command paths
resolve from the execution directory, which becomes the new project when run.
The selected file replaces the source registry for that operation, not the
built-in adapters. It is limited to 256 KiB and cannot override a saved project's
configuration through `--providers`.

A `bounded-model` returns one narrow result; it cannot run the product stages.
Those need an `agent-runtime` with `tools`, `jsonl`, `cancel`, `permissions` and
`structured_output` for research handoffs. Add `resume`,
`model_selection` or `reasoning_selection` only when actually implemented.
An API-only adapter can use the lower-level provider commands with explicit
API authorization; product-stage configuration currently accepts only local or
subscription billing.

Research uses two bounded provider turns: choose sources, then interpret the
content collected by Foundry. Both request read-only provider permissions.
Foundry itself reads the selected public HTTPS pages or local project documents;
these reads are outside the provider's sandbox. Search/discovery still depends
on the provider's tools. No search account, browser or extra model is installed
automatically. See [research limits](WORKFLOW.md#research).

Existing projects use `.foundry/providers.json` in their own directory. New
projects without `--providers FILE` copy the source installation's registry if
present. Installing a package does not discover or execute third-party adapters.

## Input, output and cancellation

The process receives one JSON object on stdin, followed by EOF. It includes
the request's `prompt`, `adapter`, required capabilities, optional model and
reasoning preferences, permissions, output schema, billing and budget, plus:

| Field | Meaning |
| --- | --- |
| `protocol` | `foundry-jsonl-v1` |
| `task_id` | Foundry's task UUID |
| `attempt` | Current attempt number |
| `operation` | `start` or `resume` |
| `session_id` | Saved session ID, or `null` for a new task |

Set `protocol` explicitly for new adapters. Older entries without it retain
`marketcraft-jsonl-v1`, the previous wire identifier with the same JSON fields.

Write one JSON object per stdout line, ending each with a newline. Keep
diagnostics on stderr. An agent runtime emits a session receipt and then one
result; a bounded model emits only the result:

```jsonl
{"type":"session.started","session_id":"session-123","model":"resolved-model"}
{"type":"result","status":"completed","output":{"category":"documentation"},"usage":{"input_tokens":12,"output_tokens":8,"reliable":true}}
```

The session ID must start with a letter or digit and contain only letters,
digits, `.`, `_`, `:` or `-` (at most 200 characters). Model reporting is
optional and should name the resolved model, not an unverified alias.

Success requires a zero process exit, exactly one completed result and a final
output. If requested, the output must satisfy the schema. Supported schema
keywords are `type`, `properties`, `required`, `additionalProperties` (boolean),
`items`, `enum`, `description` and `title`; unsupported features are rejected.
Unknown usage stays unknown: report actual quantities with `reliable: true`,
not estimates presented as billed amounts. An error receipt can use
`{"type":"error","code":"unavailable","message":"Runtime unavailable"}`.
Errors do not authorize fallback or a change in billing.

Foundry stops owned processes on cancellation, timeout or invalid output;
adapters must clean up their children and stop any remote work they started.
Local process termination alone cannot prove a remote action was canceled.
`permissions.sandbox` is `read-only` or `workspace-write`; an adapter claiming
permission support must enforce it rather than merely echoing it.

The checked contract and examples live in
[`src/runtime/providers.ts`](../src/runtime/providers.ts) and
[`tests/runtime/providers.test.ts`](../tests/runtime/providers.test.ts).

## Bundled adapter reference

The optional `codex` adapter uses the `codex-jsonl` protocol. Install its runtime
with `npm install -g @openai/codex`, then run `codex` and follow
[its sign-in instructions](https://developers.openai.com/codex/auth/).
Select it explicitly with `--adapter codex`. Its executable is resolved from
`PATH` or `FOUNDRY_CODEX=/absolute/path/to/codex`. Subscription execution filters
API-key environment variables to keep that billing choice separate.

The adapter names `codex` and `chatgpt` are reserved; `chatgpt` is an unsupported
legacy entry. Other adapters can use `codex-jsonl` only when their command
implements that runtime's CLI and event format. Protocol selection, not the
adapter's name, controls command and event handling.

## Boundaries

Cloud providers receive prompts and project content sent by the owner. Process
environment filtering is not a sandbox, and declared permissions are not proof
of provider enforcement. Use an externally restricted environment for
untrusted work.

See the [integration checklist](QUALIFICATION.md), [runtime operations](RUNTIME.md),
and the repository [security policy](../SECURITY.md).
