# Existing repositories and recovery

Foundry's runtime is one Node 24 executable. Install from the source checkout,
then use `init` for a clean repository or the explicit migration flow for a
legacy workspace. There is no Python fallback, browser workspace, HTTP server or
MCP runtime.

## Project directories

New product workspaces default to `~/.foundry/products`. `--products-dir PATH`
selects a different owner-controlled location. The previous package-adjacent
`../products` directory is never moved, copied or deleted automatically; point
`--products-dir` at it if you want to continue using it.

## Initialize a repository

```sh
foundry init --project /path/to/repository
foundry init --project /path/to/repository --update
```

Initialization manages files inside the target `.foundry` directory and
framework documentation. It preserves unmanaged owner files. Normal `init`
refuses any existing `.foundry` directory that lacks the TypeScript runtime
marker; `--update` does not grant permission to import an old runtime.

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
transfer Python Factory approvals or mark work complete. Its old registry
history is nonresumable; create a fresh plan and approve current Plan and Design
revisions. Controllers outside the known framework registry cannot be
discovered reliably. Missing schemas are not guessed, and unsupported projects
remain unchanged.

## Stop, status and recovery

Use `status`, `stop` and `recover` from the same executable. Scoped work is
managed by `foundry work status|pause|resume|recover`; provider tasks by
`foundry provider status|cancel|reconcile`. Stop may leave an interrupted record
when child-process shutdown cannot be confirmed; recovery must inspect that
record rather than assuming the task completed.

Private runtime state lives under `.foundry/state` in a project. Do not edit it
by hand. See [workflow contracts](WORKFLOW-CONTRACTS.md) for saved evidence and
[security](../SECURITY.md) for boundaries.
