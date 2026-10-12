# Project settings

Project documents and configuration remain with the project owner. Use explicit
commands to change settings; do not edit private runtime state to alter behavior.

## Workspace location

The default for new product workspaces is `~/.foundry/products`. Set
`--products-dir PATH` on supported product commands to use another directory.

## Product and provider settings

`foundry new NAME --idea TEXT --adapter PROVIDER` creates the initial product documents without
starting a provider. `foundry configure PROJECT` selects an adapter, billing
mode, explicit consent and stage roles:

```sh
foundry configure PROJECT \
  --adapter PROVIDER \
  --billing subscription \
  --confirmed \
  --role build=implementer
```

Replace `PROVIDER` with a registered adapter name. Omit an option to retain its saved value. `--revoke-consent` removes stored
billing consent. A provider registry at `.foundry/providers.json` is optional
owner configuration; no credentials are bundled or silently discovered from
untrusted project files.

Use `foundry providers --providers FILE` to inspect an owner-reviewed registry,
then pass the same `--providers FILE` to `foundry new`. The new project saves
its own copy, so package updates do not replace that configuration.
Use `--model MODEL` and `--reasoning VALUE` when supported by the adapter.
Model names and reasoning values belong to the provider, not Foundry.

These settings apply to adapter-driven products. For
[connected work](CONNECTED-CLIENT.md), choose the model and account in the coding
client instead. A scoped contract selects role policies and may enable Research
and Design with `preparation: {}`; it does not change the host's provider.

## Checks and content

The project `.foundry/project.json` describes required local check commands and
their inputs. Configure real commands that exercise the product. A missing or
stale check is not evidence. Product specifications belong in `docs/specs/`;
runtime logs and private records belong in `.foundry/state/` and are never
committed as product evidence.

`init` starts a clean repository with an empty check list. Configure actual
test/build/lint commands before starting a contracted change. Each required
check needs a name, a command array, a working directory, a timeout in seconds
and declared `inputs`. Paths are project-relative and must exist; include all
files that affect the result, not only the test files. Node's `--test` returning
success with zero tests is not meaningful evidence. A unit-test command alone
does not qualify a web app's rendered interface.

In the connected path, ask the coding client to create scripts and input paths,
configure the checks and map each criterion before `foundry_start`. Review the
actual commands at the approval step. Changing their configuration changes the
scope revision and requires another approval.

See [provider configuration](PROVIDERS.md) and
[existing-repository lifecycle](RUNTIME.md).
