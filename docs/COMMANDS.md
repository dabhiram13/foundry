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
| `/new NAME --idea TEXT --adapter NAME` | Create a project with the chosen provider |
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
foundry new NAME --idea TEXT --adapter NAME [--providers FILE] [--products-dir DIR]
  [--model MODEL] [--reasoning VALUE]
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
foundry providers --providers FILE
```

Each explicit `run PROJECT` performs one stage. Approval requires the exact
revision printed for the pending Plan or Design; do not shorten or substitute it.
`--confirmed` is explicit billing consent. No command silently enables API
billing. `--json` produces structured output rather than interactive prompts.

New projects require an explicit adapter. Existing projects retain their saved
provider and model settings. `--providers FILE` reads a reviewed registry for
inspection or new-project creation; it cannot override a saved project's registry.

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
foundry work context [--project PATH] [--json]
foundry work start SLUG --spec PATH [--contract PATH] [--project PATH]
foundry work review [--project PATH] [--json]
foundry work approve --revision HASH [--project PATH] [--json]
foundry work pause|resume|verify|complete|recover [--project PATH]
foundry work workflow guide|context|gate|record|feedback [OPTIONS]
```

`verify` and `complete` return a meaningful result in human or JSON mode and
preserve nested task, check, review and active-run state.

### Read current work

`work context` shows the active scoped change, or the last completed run when
there is no active change. It separates saved progress from current check
evidence and suggests the next action. Reading context does not run checks or
change saved work.

Use `--json` for a versioned snapshot containing the run and specification,
receipt reference, check outcomes, blockers and next action. `snapshot_revision`
identifies the observed context; it is not an approval or authorization token.
Concurrent changes can require another read. A zero exit code means the context
was read successfully; inspect `evidence.status` for verification results.

Evidence is `current`, `stale`, `failed`, `missing` or `invalid`. Current means
the required checks and their retained evidence match the observed inputs.
Optional checks are marked `not_assessed`, not counted as verified requirements.
Context JSON uses schema version 2. Legacy runs keep `scope_approval: not_recorded`,
`requirements_coverage: not_assessed` and `scope: null`. Opted-in runs report
approval and criterion/check coverage separately from executed evidence. Completed
history remains history if later edits make its evidence stale.

This command is for scoped work. Product journeys use `status` and `review`.
`work workflow context` remains the separate workflow-record ledger.

`next_action.kind` is a recommendation: `start`, `review`, `verify`, `complete`, `resume`,
`recover`, `inspect` or `none`. `inspect` means review the referenced evidence;
it is not a separate CLI command. Completion always validates again.

### Approve a scoped change

Add a project-relative JSON contract alongside the specification:

```json
{
  "schema_version": 1,
  "criteria": [
    {
      "id": "COMPAT-001",
      "requirement": "The installed command starts on the supported Node versions.",
      "checks": ["package"]
    }
  ]
}
```

Use stable uppercase IDs. Every criterion in the contract is required. Each
must map to one or more required check names already configured in
`.foundry/project.json`. Empty mappings, unknown checks and optional checks
block approval. The contract declares coverage; Foundry does not infer criteria
from prose or judge whether a mapped check meaningfully tests its requirement.

```sh
foundry work start compatibility --spec docs/specs/compatibility.md --contract docs/specs/compatibility.json --project /path/to/repository
foundry work review --project /path/to/repository
foundry work approve --revision HASH --project /path/to/repository
# Implement the agreed change.
foundry work verify --project /path/to/repository
foundry work complete --project /path/to/repository
```

Review shows the specification, criteria and configured commands without executing
them. Copy its exact revision into approval. Approval binds to the run, document
paths and bytes, mapping and check settings. Edits to those inputs require fresh
review and approval. Code edits require fresh verification but do not by themselves
change scope approval. Verification and completion reject missing, invalid or
stale approval and mismatched scope receipts. Approval never completes the change.

For opted-in runs, `scope_approval` is `pending`, `current`, `stale` or `invalid`.
`requirements_coverage` is `unmapped`, `mapped` or `checks_passed`. The last value
means current mapped required-check evidence passed, not semantic correctness or
owner acceptance. Criterion details and approval metadata are in `scope`.

Terminal approval records a local workflow decision using `manual_cli`. It does
not authenticate a human or restrict another process with equal filesystem access.
Explicit approval of the current reviewed revision can replace an invalid approval
record. Never repair private state by hand. Existing runs cannot be enrolled later;
finish them normally and opt in on the next run. Factory approvals remain separate.

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
