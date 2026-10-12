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
foundry work specialists [--project PATH] [--json]
foundry work assignment planner|builder|reviewer [--project PATH] [--json]
foundry work save-plan --file PATH --snapshot HASH [--project PATH] [--json]
foundry work task-done TASK_ID --snapshot HASH [--project PATH] [--json]
foundry work record-review --file PATH --snapshot HASH [--project PATH] [--json]
foundry work pause|resume|verify|complete|recover [--project PATH]
foundry work workflow guide|context|gate|record|feedback [OPTIONS]
```

`verify` and `complete` return a meaningful result in human or JSON mode and
preserve nested task, check, review and active-run state.

### Connected specialist work

The host creates the spec and criterion/check mapping, then asks for a Planner
assignment. Foundry returns the actual neutral role instructions, exact scope,
output schema and host execution boundary. The host can use native subagents or
follow roles sequentially. Foundry never launches a model through these tools.

Save the Planner's result with `work save-plan` (or MCP `foundry_save_plan`). It
adds a `plan` to the existing contract, preserving criteria and check names:

```json
{
  "planner_role": "planner",
  "reviewer_role": "quality-gate",
  "tasks": [
    {
      "id": "TASK-01",
      "title": "Implement the agreed behavior",
      "instructions": "Build only the behavior described by FEATURE-001.",
      "role": "backend",
      "criteria": ["FEATURE-001"],
      "depends_on": []
    }
  ]
}
```

Use real criterion IDs from your contract. Plans contain 1-12 tasks, cover every
criterion and reference only earlier task IDs as dependencies. Builders must
have writable policies; reviewers must be read-only. Discover relevant roles
with `work specialists` or `foundry_specialists`. The owner reviews the task
plan, policies and check commands through `work review`, then explicitly approves
the exact revision through the terminal. Changed scope, plan, selected policies
or checks require renewed approval; affected task progress resets to pending.

After approval, `work assignment builder` / `foundry_assignment` prepares the
next ready task. The host implements it, runs `work verify` / `foundry_verify`,
inspects the actual receipt and records it with `work task-done` /
`foundry_task_done`. Later source edits require fresh checks, but do not erase
historical task receipts. Pause/resume and another client retain the same tasks.
Assignments advise stopping after three unsuccessful repairs; the host enforces
that limit. Foundry does not automatically execute or count host repair attempts.

With every task done and current passing checks, prepare the Reviewer assignment.
The host inspects the actual diff and supplies a report to `work record-review`
or `foundry_record_review`:

```json
{
  "summary": "Compared the implementation and saved results with the scope.",
  "criteria": [
    { "id": "FEATURE-001", "assessment": "met", "observation": "Name the behavior and evidence actually inspected." }
  ],
  "findings": []
}
```

Every criterion must appear exactly once, with `met`, `gap` or `unverified` and
an observation. Findings name a criterion, a `message` and a `blocking` boolean.
Gaps, unverified criteria and blocking findings prevent completion. Reports are
saved even when blocked; earlier reports remain available. Changes to inputs,
approval or verification receipts require a fresh final review. A changed or
missing review record is invalid, not a pass. Successful completion includes
tasks, evidence and the host-reported review in the local handoff.

New CLI mutations require `--snapshot HASH` from the latest `work context --json`.
Write result files before refreshing context, since writing project files can
invalidate an earlier snapshot. MCP mutations require `snapshot_revision`.
The generated OpenCode skill explains the full sequence. Contracts without a
plan retain the existing scoped flow. Research/Design connected stages, live
model qualification, npm publication and Homebrew distribution are separate.

Requested permissions and reported reviewer identity are workflow instructions,
not an enforced sandbox or proof that an independent agent performed the review.
Passing checks and a nonblocking report do not equal owner acceptance.

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
`recover`, `inspect`, `build`, `review_work` or `none`. `build` and `review_work`
recommend preparing the next specialist assignment. `inspect` means review the referenced evidence;
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

## Connect OpenCode to scoped work (source preview)

The first connected client uses a local MCP server and one project skill. This
feature is in this source checkout; published version 0.5.1 does not include it.
Build from source with Node 24 or newer (`npm ci --ignore-scripts` and
`npm run build:runtime`), then initialize an existing repository and preview:

```sh
./foundry init --project /path/to/repository
./foundry connect opencode --project /path/to/repository --dry-run
./foundry connect opencode --project /path/to/repository --apply
```

Open or restart OpenCode **from that project directory**. The setup changes only its
`opencode.json` or `opencode.jsonc` `mcp.foundry` entry and adds
`.opencode/skills/foundry-work/SKILL.md`. Preview prints the exact command,
files and proposed actions. JSON/JSONC comments and unrelated settings remain
in place. Existing files with those names are not overwritten unless an unchanged
Foundry ownership record matches them. An interrupted apply/remove can be
retried with the same flag. The command records the current Node and Foundry
executable paths. If either installation moves, preview and apply again to
update the managed connection. To remove managed entries and skill safely:

```sh
./foundry connect opencode --project /path/to/repository --remove
```

The MCP command itself is `foundry mcp --project PATH` over stdio. Use it from a
compatible client, not as an interactive terminal. The server stays bound to
one initialized project and exposes `foundry_context`, `foundry_review`,
`foundry_start`, `foundry_verify`, `foundry_complete`, `foundry_pause`,
`foundry_resume` and `foundry_recover`. Specialist work adds `foundry_specialists`,
`foundry_assignment`, `foundry_save_plan`, `foundry_task_done` and
`foundry_record_review`, sharing the same run, scope approval and evidence.
It does **not** run a model, select a
provider, authorize billing, approve work or accept a client-selected command.
An agent may start only contracted scoped work; legacy work remains readable
but needs the CLI for mutation. Every MCP mutation needs a fresh
`snapshot_revision` from `foundry_context`. A stale snapshot fails without
changing the run. Work checked before later source edits needs fresh evidence.

**You review and approve scope separately.** Ask the agent to call
`foundry_review`, inspect the spec, criteria, proposed tasks, role policies and configured check commands,
then run `foundry work approve --revision HASH --project PATH` yourself with
that exact revision. This is a local workflow decision, not human authentication:
a process with equal filesystem access could still call the terminal command.
Configured checks execute locally with your privileges; Foundry is not a
sandbox. A passing check does not establish semantic correctness or acceptance.
If the client cancels or disconnects during verification, read context from a
new session and use its `resume` or `recover` action; no interrupted check counts
as a pass. Connection and tool/skill discovery were checked with OpenCode 1.19.0,
using Node 24 and 25 for the Foundry server. SDK and installed-package fixtures
check the work flow, but a live model-driven run remains unqualified. This does
not claim compatibility with every client version or semantic correctness.

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
