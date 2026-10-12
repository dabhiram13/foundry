# Existing repositories and recovery

Foundry's runtime is one Node 24+ executable. [Install it with npm](GETTING-STARTED.md#install-foundry),
then use `init` for a clean repository or the explicit migration flow for a
legacy workspace.

`init` adds Foundry's local files; it does not start building. The `work` commands
track a change you or a coding tool implement, then run configured checks.
For a guided product build, use [your first project](GETTING-STARTED.md).

To work inside OpenCode, use [the connected source preview](CONNECTED-CLIENT.md).
Use it for research, planning, design, building and review. Your coding tool does
the work; Foundry saves progress and waits for your approvals.
Published npm 0.5.1 does not include scoped context, exact scope approval or the
connection; use the source launcher for those commands.

## Project directories

New product workspaces default to `~/.foundry/products`. `--products-dir PATH`
selects another location, including a directory used by an earlier installation.

## Initialize a repository

```sh
foundry init --project /path/to/repository
foundry init --project /path/to/repository --update
```

Initialization installs the runtime, role catalog and project settings inside
the target `.foundry` directory. It preserves unmanaged owner files. Normal `init`
refuses any existing `.foundry` directory that lacks the TypeScript runtime
marker; `--update` does not grant permission to import an old runtime.

An empty repository starts with no required check commands. Configure real
[checks and input paths](CUSTOMIZATION.md#checks-and-content) before verification
or a contracted run. Initialization does not create an app, discover tests or
turn an empty test run into evidence.

From source, preview existing package scripts with `foundry setup --project PATH
--dry-run`, then save the reviewed revision with `--apply --revision HASH`.
In OpenCode, the coding client handles this step. Empty projects need real
scripts first. Setup preserves existing checks and runs no commands.

An interrupted TypeScript install can be recovered explicitly:

```sh
foundry init --project /path/to/repository --recover
```

Recovery validates the pending installer journal and source; it does not guess
at an unknown partial result. A recovery conflict must be resolved by its owner
without overwriting changed files.

## Explicit legacy import

Review the read-only plan first, then explicitly apply it:

```sh
foundry migrate --project /path/to/repository --dry-run
foundry migrate --project /path/to/repository --apply
```

`--dry-run` reports managed-file conflicts and unsupported inputs before
creating backups or journals. Apply rechecks the plan while holding the shared
installation guard. Symlinks, special files, malformed or future registry
formats, active tasks and ambiguous records are refused. If a migration has an
installer journal, `--apply --recover` is the explicit recovery route.

Migration backs up and archives supported legacy project state but does not
transfer old product approvals or mark work complete. Its old registry
history is nonresumable. After import, use `foundry work` for scoped changes in
the existing repository. Import does not create a new six-stage controller there;
`foundry new` starts a separate product journey with fresh Plan and Design
approvals. Controllers outside the known framework registry cannot be
discovered reliably. Missing schemas are not guessed, and unsupported projects
remain unchanged.

When an import matches a legacy Factory registry record, it also needs the
`flock` utility plus `sh` and `cat` to coordinate with that old controller's
locks. Migration refuses to proceed if it cannot check the shared locks.

## Stop, status and recovery

Use `status`, `stop` and `recover` from the same executable. Scoped work is
managed by `foundry work status|pause|resume|recover`; provider tasks by
`foundry provider status|cancel|reconcile`. Stop may leave an interrupted record
when child-process shutdown cannot be confirmed; recovery must inspect that
record rather than assuming the task completed.

Private runtime state lives under `.foundry/state` in a project. Do not edit it
by hand. See [workflow contracts](WORKFLOW-CONTRACTS.md) for saved evidence and
[security](../SECURITY.md) for boundaries.
