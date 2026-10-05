# Project settings

Project documents and configuration remain with the project owner. Use explicit
commands to change settings; do not edit private runtime state to alter behavior.

## Workspace location

The default for new product workspaces is `~/.foundry/products`. Set
`--products-dir PATH` on supported product commands to use another directory.
Foundry never silently moves the older `../products` directory.

## Product and provider settings

`foundry new NAME --idea TEXT` creates the initial product documents without
starting a provider. `foundry configure PROJECT` selects an adapter, billing
mode, explicit consent and stage roles:

```sh
foundry configure PROJECT \
  --adapter codex \
  --billing subscription \
  --confirmed \
  --role build=implementer
```

Omit an option to retain its saved value. `--revoke-consent` removes stored
billing consent. A provider registry at `.foundry/providers.json` is optional
owner configuration; no credentials are bundled or silently discovered from
untrusted project files.

## Checks and content

The project `.foundry/project.json` describes required local check commands and
their inputs. Configure real commands that exercise the product. A missing or
stale check is not evidence. Product specifications belong in `docs/specs/`;
runtime logs and private records belong in `.foundry/state/` and are never
committed as product evidence.

See [provider configuration](PROVIDERS.md) and
[existing-repository lifecycle](RUNTIME.md).
