# Providers and adapter capabilities

Foundry uses one provider contract for terminal runs and explicit provider
commands. Codex is the built-in agent-runtime adapter. A registered adapter is
not necessarily protocol-tested or qualified with a live provider.

## Configure consent and selection

Configure a project without launching a provider:

```sh
foundry configure PROJECT --adapter codex --billing subscription --confirmed
```

The `--confirmed` flag records explicit subscription consent. API billing is
never selected silently; API execution requires a command/request that
explicitly enables it and acknowledges its billing conditions. Local fixture
providers are intended for tests and do not incur external inference.

Codex is resolved from `PATH`, or from the explicitly selected
`FOUNDRY_CODEX=/absolute/path/to/codex`. Authenticate that executable through
its official provider instructions. Do not paste credentials into product
documents. Foundry filters child-process environment and redacts reported
values, but this is not an operating-system sandbox.

## Adapter contract

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
4. Report registration, fixture protocol tests and live qualification
   separately. Do not infer live support from a passing fixture.

## Register a reviewed local command

For example, a narrow local model command can be registered as:

```json
{
  "adapters": [{
    "name": "local-classifier",
    "kind": "bounded-model",
    "command": ["/absolute/path/to/node", "/absolute/path/to/adapter.cjs"],
    "capabilities": ["jsonl", "cancel", "structured_output"],
    "billing_modes": ["local"],
    "environment": []
  }]
}
```

Save this as `.foundry/providers.json` in an initialized project, replacing the
example paths with your reviewed implementation. Inspect without running it:

```sh
foundry provider --project /path/to/project --json
```

The command array executes directly from the project directory, without shell
expansion. `environment` names additional variables to pass from the caller;
values and secrets must not be stored in this file. A small base environment
(including `PATH`, home, temporary-directory and locale settings) is also passed.
`codex` and `chatgpt` are reserved names.

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

For a new product, owner-reviewed adapters in the framework's
`.foundry/providers.json` are copied during `foundry new --adapter NAME`.
Existing projects keep their own registry. Installing a package does not
discover or execute third-party adapters automatically.

## Input, output and cancellation

The process receives one JSON object on stdin, followed by EOF. It includes
the request's `prompt`, `adapter`, required capabilities, optional model and
reasoning preferences, permissions, output schema, billing and budget, plus:

| Field | Meaning |
| --- | --- |
| `protocol` | `marketcraft-jsonl-v1` |
| `task_id` | Foundry's task UUID |
| `attempt` | Current attempt number |
| `operation` | `start` or `resume` |
| `session_id` | Saved session ID, or `null` for a new task |

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

## Boundaries

Cloud providers receive prompts and project content sent by the owner. Process
environment filtering is not a sandbox, and declared permissions are not proof
of provider enforcement. Use an externally restricted environment for
untrusted work.

See [qualification status](QUALIFICATION.md), [runtime operations](RUNTIME.md),
and the repository [security policy](../SECURITY.md).
