# Set up a provider

Foundry sends tasks to an AI tool you have installed and authorized. Each
project uses one connection shared by its specialist roles.

This guide covers provider setup for the **terminal**, including npm 0.5.1.
Using [OpenCode from source](CONNECTED-CLIENT.md)? Keep its existing model,
account and tools instead.

## Choose the connection path

| Path | Where you choose the model | What does the coding |
| --- | --- | --- |
| Foundry inside OpenCode, from source | OpenCode's provider settings and model picker | OpenCode's tools, using Foundry's saved assignments |
| Foundry terminal, including npm 0.5.1 | The selected adapter's settings; `--model` when supported | An installed coding tool that implements Foundry's process interface |
| Foundry-managed coding session | Not available yet | Internal startup/shutdown and trusted edit tests are not a usable coding agent |

There is no `foundry --base-url` connection. An OpenAI-compatible API supplies
model responses, not a coding tool. Use it through OpenCode below, or implement
and test a terminal adapter. Foundry does not promise that every endpoint or
model works.

## OpenAI-compatible endpoints in OpenCode

This is the **connected source path**, not a new terminal adapter or the internal
managed OpenCode check. First follow [the source setup](CONNECTED-CLIENT.md), then
configure your model in OpenCode. See OpenCode's official
[custom-provider guide](https://opencode.ai/docs/providers/#custom-provider) and
[configuration guide](https://opencode.ai/docs/config/).

Merge these fields into your product's `opencode.json` or `opencode.jsonc`.
Keep any existing `mcp` settings, including Foundry's entry:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "my-endpoint": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My model endpoint",
      "options": {
        "baseURL": "https://your-provider.example/v1",
        "apiKey": "{env:MY_MODEL_API_KEY}"
      },
      "models": {
        "your-model-id": { "name": "My coding model" }
      }
    }
  },
  "model": "my-endpoint/your-model-id"
}
```

Replace the example URL and model ID with values from your provider. The provider
ID before `/` must match the key under `provider`. Put the base API URL here,
not a full `/chat/completions` URL. Use HTTPS for remote services; loopback HTTP
is appropriate only for a trusted local server.

Supply `MY_MODEL_API_KEY` through your shell or secret manager before starting
OpenCode. The `{env:...}` text is a reference, not a place to paste the key. Do
not put credentials in URLs, committed configuration, briefs or command arguments.
For a local service without authentication, follow its configuration instructions.
Do not add a dummy cloud key or silently fall back to another model.

Open or restart OpenCode in the product directory. Confirm the selected model
with `/models` and check Foundry with `/mcp`. Before a live task, agree on account
access and costs. OpenCode, not Foundry, manages authentication, model requests,
context limits and billing on this path. Foundry's terminal billing flags do not
control OpenCode's spending.

Connecting, refreshing or removing Foundry changes its own MCP entry and project
skill, not your provider, model or key references. Test the full connection with
the [integration checklist](QUALIFICATION.md); a successful model-list request
alone does not prove coding works.

### Compatibility is more than the URL

| Check | Why it matters |
| --- | --- |
| Chat request format | This example uses OpenAI-style Chat Completions, not a guarantee of Responses, Azure, realtime or every provider extension. |
| Tool calls and results | The selected model must call coding/MCP tools correctly and continue after their results. Text-only chat is not enough. |
| Streaming | The endpoint must return the streamed events expected by the host's provider package. |
| Model and context limits | The configured model ID, limits and supported options must match the server. Reasoning settings differ between providers. |
| Structured results | Foundry validates submitted plans and evidence, but that does not prove a model supports native JSON Schema output. |
| Failures and stopping | Authentication errors, rate limits, malformed responses, timeouts and active-tool cancellation need tests for the actual host/provider combination. |

Local qualification uses **OpenCode 1.19.0** and a fake loopback Chat Completions
endpoint: explicit model and environment-held key, streamed tool calls, a Foundry
MCP context read, a real file write and tool results returned to the endpoint.
It uses no live model or provider account. It does not qualify any named cloud
provider, local model, active-tool cancellation or a complete product build.
See [how to run the check](VALIDATION.md#openai-compatible-host-check).

## Terminal adapter support

The built-in `codex` adapter talks to an installed Codex CLI. Its command and
account still need to work on your machine; a listed adapter is not live-model
qualification. The `chatgpt` entry is explicitly unsupported, not a second
working connection. Other tools need a reviewed custom adapter below. Foundry
does not automatically discover a provider from an API key or URL.

## Choose a provider and model

An adapter is a small connector to an installed coding tool. It lists the
features the tool claims to support.
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
hash, declared features and executable availability. It checks files and PATH
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
documents. Foundry filters child-process environment, can broker declared
API keys (see [Credentials](#credentials)) and redacts reported values, but
this is not an operating-system sandbox.

## Build a custom connector (advanced)

An adapter translates Foundry requests into calls to another AI tool.

An owner may define additional adapters in `.foundry/providers.json`. Each
adapter declares its name, kind, command, billing modes, environment variable
names, credential references and capabilities. The schema validates these
fields before dispatch. Secrets are never committed in the registry; it names
where Foundry reads them and how it delivers them.
Provider output and saved task records are bounded and validated.

Capabilities include structured output, JSONL, resume, cancel, permissions,
tools, browser, model selection, reasoning selection and usage metering. A controller requests
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
expansion. `environment` names additional non-secret variables to pass from the
caller. Passed names that look like keys, tokens, secrets or passwords are
recorded on each attempt as exposed to the adapter process; declare them under
`credentials` with broker delivery to keep the value out of it. A small base environment
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

## Credentials

An adapter can declare up to eight credential references. Each names the
caller's environment variable that holds the value (`source_env`), the billing
modes that need it and a delivery method:

```json
"credentials": [{
  "id": "model-api",
  "source_env": "MY_MODEL_API_KEY",
  "billing_modes": ["api"],
  "delivery": "broker",
  "upstream": "https://api.example.com/v1",
  "header": "authorization",
  "base_url_env": "MODEL_BASE_URL",
  "token_env": "MODEL_API_KEY"
}]
```

- `broker`: for each attempt Foundry starts a loopback HTTP endpoint and gives
  the adapter its address in `base_url_env` and a random per-attempt token in
  `token_env`. The adapter sends that token as a bearer, `x-api-key` or
  `api-key` header. Foundry checks it, replaces it with the real value in the
  declared `header`, and forwards the request only to the declared `upstream`
  origin, appending the request path to its path prefix. The upstream must be HTTPS (loopback HTTP is allowed
  for local tests) without embedded credentials, query or fragment. The real
  value never enters the adapter's environment.
- `environment`: the value is copied into `target_env` for runtimes that cannot
  use a base URL. The task record marks it as exposed to the adapter process.

A selected credential that is not set stops the request before any process or
task starts; Foundry never falls back to another key, account or billing mode.
Broker tokens are revoked when the attempt is canceled, times out or reaches
its reservation, and the endpoint closes when the attempt ends. Task records
keep only metadata: credential ID, delivery, source variable name, exposure,
upstream origin and request counts. Values and tokens are redacted from
provider output, saved tasks and evidence logs.

The broker keeps the key out of the adapter process and model tools only when
the adapter's tools cannot read the caller's files or memory; it is not an
operating-system sandbox. Delivery names cannot collide with the base
environment, `environment` entries or other credentials. `codex-jsonl`
adapters keep their existing API-key handling and cannot declare credentials.

## Spending controls

API billing needs `"mode": "api"`, `allow_api: true`,
`acknowledge_posthoc_cost: true`, a positive `reservation_dollars` that fits
`budget.max_api_dollars`, and one of these bounds:

| Control | Who enforces it | What Foundry records |
| --- | --- | --- |
| `max_api_dollars` | Foundry, after the fact | Checked post-hoc from provider-reported usage. It is not a live cap unless the provider enforces it. |
| `reservation_dollars` | Foundry, before each attempt | The known-dollar total plus the reservation must fit `max_api_dollars`. An attempt with unknown cost blocks further paid attempts. |
| Usage metering (`usage_metering` capability) | Foundry, while running | Streamed cumulative usage. At or above the reservation the provider is stopped and the task is `budget_exceeded`. |
| `provider_limit_dollars` | The provider account, if configured there | An owner attestation of a provider-side limit no higher than `max_api_dollars`. Foundry records it as `owner_attested_not_verified`. |

API requests on adapters without `usage_metering` and without
`provider_limit_dollars` are refused as unbounded paid execution.

Usage metering stops the process when a report reaches the reservation, but
provider reports can lag behind charges and in-flight requests can still bill.
Spend can therefore exceed the reservation and `max_api_dollars`. Only a limit
enforced by the provider bounds the bill. Foundry records `spend_control` on
each task with `hard_dollar_cap: false` and keeps estimates, reservations,
metered usage and post-hoc accounting in separate fields.

Outside API billing, a streamed report of API dollars stops the provider and a
streamed or final one marks the task `billing_violation`.

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
not estimates presented as billed amounts. An adapter that declares
`usage_metering` streams cumulative usage while it runs:

```jsonl
{"type":"usage","reliable":true,"input_tokens":1200,"output_tokens":300,"api_dollars":0.04}
```

Fields are totals for the attempt so far and must not decrease. Unreliable
reports are ignored. Foundry saves the latest report as `metered_usage`, uses
the final result when it is at least as high, and keeps a stopped attempt's
final cost unknown. An error receipt can use
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
API-key environment variables to keep that billing choice separate. It does not
stream dollar usage, so API execution through it also needs
`provider_limit_dollars`; its `OPENAI_API_KEY` or `CODEX_API_KEY` is recorded as
exposed to the adapter process.

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
