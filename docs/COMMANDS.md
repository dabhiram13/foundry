# Terminal command reference

These are the current stable launcher commands. Run `./foundry --help` or add
`--help` after a command for the authoritative option list. The browser is optional.
The TypeScript migration is staged; it does not silently replace existing projects.

## Select your projects folder

`--products-dir PATH` is a global option, placed before the command. It defaults
to a sibling `products/` folder rather than putting product code in this checkout.
Use the same directory for subsequent commands:

```sh
./foundry --products-dir "$HOME/foundry-projects" list
```

`PROJECT` below means the exact project slug or UUID printed by `new` and `list`,
not an arbitrary filesystem path. Use quotation marks around names and paths
containing spaces.

## Create and configure

```sh
./foundry new "Booking tool" --idea "Let customers book one appointment slot"
./foundry list
./foundry status booking-tool
./foundry configure booking-tool --provider codex
./foundry configure booking-tool --confirm-subscription
```

`new` creates the project without starting AI work. Optional `--provider`, `--model`
and `--reasoning` preferences can be provided at creation or with `configure`.
Omitting a configuration option preserves its current value; `--model ""` or
`--reasoning ""` clears that override. Changing providers clears subscription
confirmation. Confirm again only after checking the selected provider and account.
`--revoke-subscription` removes that confirmation.

The subscription flag is your explicit confirmation, not a billing lookup or an
instruction to purchase anything. `codex login` is a separate provider command.
See [provider support](PROVIDERS.md) before selecting a custom adapter.

## Run one step

```sh
./foundry run booking-tool
./foundry status booking-tool
```

Each `run` executes one current step: Research, Plan, Design, Build, Test or Ship.
The terminal prints what happened and the next command. Do not loop unattended
through approvals. Build may include several small tasks with checks, bounded
repairs and Git checkpoints. A failed or interrupted step is not complete.

## Read and approve

When Plan or Design is awaiting approval:

```sh
./foundry review booking-tool
```

Read the document and run the exact approval command printed below it, using the
SHA-256 revision you reviewed. `approve PROJECT --revision REVISION` approves
only that saved revision. Editing the document invalidates the old revision.
The next stage requires a separate `run` command.

To read another saved document without approving it:

```sh
./foundry review booking-tool --path docs/product/research.md
```

## Stop or retry

From another terminal while a step is running:

```sh
./foundry stop booking-tool
./foundry status booking-tool
```

Stopping an idle or approval-pending project does not create an interrupted run.
Read any failure before retrying with `run`. A retry does not authorize a different
provider, a paid fallback, deployment or a new account connection.

## Inspect providers

```sh
./foundry providers
./foundry providers booking-tool
```

The first command shows framework registration; the second reads the project's
copied registry. Both show metadata, not a live qualification certificate.

## Optional browser

```sh
./foundry ui
./foundry --products-dir "$HOME/foundry-projects" ui --no-browser --port 8765
```

The local browser uses the same stable controller and projects. It is not the
public documentation website and should not be exposed to the internet.
Experimental ChatGPT authentication/execution remains on this legacy browser path.

## Existing repositories and advanced records

Use [runtime and recovery](RUNTIME.md) for installation into an existing repository,
run records, checks, completion and repair. Use [customization](CUSTOMIZATION.md)
for adding project-specific checks. These lower-level tools are not a second
automatically running product builder.
