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

The stable protocol identifier `marketcraft-jsonl-v1` is retained where needed
for existing records; it is a legacy wire identifier, not a second runtime.

## Boundaries

Cloud providers receive prompts and project content sent by the owner. Process
environment filtering is not a sandbox, and declared permissions are not proof
of provider enforcement. Use an externally restricted environment for
untrusted work.

See [qualification status](QUALIFICATION.md), [runtime operations](RUNTIME.md),
and the repository [security policy](../SECURITY.md).
