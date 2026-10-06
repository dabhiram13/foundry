# Terminal and command reference

Start with the [first-project guide](GETTING-STARTED.md). This page is a lookup
reference, not a list of setup steps to run.

There are two ways to use the same tool:

- **Inside Foundry:** open `foundry` in your terminal, then use `/run`, `/review`
  and other slash commands for the selected project.
- **From your computer's terminal:** use commands such as `foundry run reading-list`.
  These are useful for scripts or when you prefer one command at a time.

Do not type npm or shell commands at the `foundry>` prompt; use `/exit` first.
In a non-interactive process, `foundry` prints help instead of opening a terminal.
`--json` requests machine-readable output where supported.

## Version and help

```text
foundry --version
foundry -v
foundry --help
```

Both version flags print the installed version and reject additional arguments.

## Interactive terminal

The terminal accepts slash commands, not shell input:

| Command | Action |
| --- | --- |
| `/help` | Show available terminal commands |
| `/projects` | List saved projects |
| `/new NAME --idea TEXT` | Create a project explicitly |
| `/use ID_OR_SLUG` | Select a project |
| `/run` | Continue until an approval, completion or failure boundary |
| `/review` | Print the pending document and its exact revision |
| `/approve` | Approve the displayed revision |
| `/stop` | Stop the selected project run |
| `/recover` | Inspect and recover an interrupted run |
| `/configure OPTIONS` | Configure the selected project |
| `/roles` | List available neutral roles |
| `/providers` | List available provider adapters |
| `/exit` | Leave terminal mode |

Freeform input is not evaluated as shell or sent to a model. Use explicit `new`
options to provide an idea. Input remains responsive while a run is active.

## Product commands

```text
foundry new NAME --idea TEXT [--adapter NAME] [--products-dir DIR]
foundry list [--products-dir DIR]
foundry status PROJECT
foundry configure PROJECT [--adapter NAME] [--billing local|subscription]
  [--confirmed|--revoke-consent] [--role STAGE=NAME]
foundry run PROJECT
foundry review PROJECT
foundry approve PROJECT --revision HASH
foundry stop PROJECT
foundry recover PROJECT
foundry roles
foundry providers [PROJECT]
```

Each explicit `run PROJECT` performs one stage. Approval requires the exact
revision printed for the pending Plan or Design; do not shorten or substitute it.
`--confirmed` is explicit billing consent. No command silently enables API
billing. `--json` produces structured output rather than interactive prompts.

## Installation and migration

```text
foundry init --project PATH [--update] [--recover]
foundry migrate --project PATH --dry-run
foundry migrate --project PATH --apply [--recover]
```

Normal `init` refuses an existing unmarked `.foundry` workspace. `--recover`
recovers an interrupted TypeScript installation; it does not authorize legacy
import. Use `migrate` explicitly for legacy workspaces. It requires exactly one
of `--dry-run` or `--apply`; `--recover` is only valid with `--apply`.

## Scoped work

`work` provides one-stage lifecycle operations for a bounded repository change:

```text
foundry work status [--project PATH]
foundry work start SLUG --spec PATH [--project PATH]
foundry work pause|resume|verify|complete|recover [--project PATH]
foundry work workflow guide|context|gate|record|feedback [OPTIONS]
```

`verify` and `complete` return a meaningful result in human or JSON mode and
preserve nested task, check, review and active-run state.

## Provider operations

```text
foundry provider [--project PATH]
foundry provider run --adapter NAME --prompt TEXT [--project PATH] [--billing MODE]
foundry provider run --request PATH [--project PATH]
foundry provider status [TASK_ID] [--project PATH]
foundry provider cancel|reconcile TASK_ID [--project PATH]
```

Provider billing, capability and process options are validated for each command.
See [providers](PROVIDERS.md) before configuring an adapter. For project files,
settings, recovery and the default products directory, see [runtime](RUNTIME.md).
