# Local run integrity and recovery

Foundry 0.2 keeps `scripts/foundry.py`, `.foundry/project.json`, existing run
IDs and installed-product metadata compatible. `scripts/marketcraft.py` is the
canonical command. Existing projects do not need to rename their folders, Git
remotes, specs or state directory. Earlier verification receipts must be rerun
after updating because the input fingerprint is stronger.

## What a verification receipt establishes

`verify` executes each configured argv directly from its declared project-local
working directory. At least one required check must exist. A zero exit status,
fresh inputs and unchanged logs are necessary for completion. Checks are trusted
project code, not sandboxed by this Python runtime. Native Codex permissions and
the operating system remain the execution boundary.

The fingerprint includes tracked and nonignored source bytes and modes, the Git
index, HEAD/branch identity, the project configuration, accepted run spec, common
`.env`/`.env.*` files, and each resolved check executable's path, content and mode.
Implicit environment-file symlinks are rejected; use regular local configuration
files. Other ignored inputs and environment variables must be declared explicitly:

```json
{
  "name": "application",
  "command": ["python3", "-m", "unittest", "discover", "-s", "tests"],
  "cwd": ".",
  "timeout": 120,
  "required": true,
  "inputs": ["src", "tests", "docs/specs/feature.md", "local-settings.json"],
  "environment": ["APP_MODE"]
}
```

Paths are project-relative files or directories, with no symlink traversal.
Directories expand recursively. Declare the actual dependencies, including
ignored/generated configuration that a check reads. Missing inputs fail closed.
Environment values are hashed; their plaintext is not written into receipts.
Per-check `input_revisions` and `input_revisions_after` bind declared file content
to workflow command gates. Output receipts, the workflow ledger itself and runtime
state should not be declared inputs to their own checks.

This does not discover every transitive tool dependency or observe remote service
state. Version/lock the toolchain and qualify external integrations separately.
Checks must not print secrets: log redaction detects common patterns but is not a
complete secret detector. Git-index secret scanning is similarly narrow.

## Cancellation and recovery

Only one lifecycle coordinator writes a checkout at once. Lock, state, spec and
managed-install paths reject symlink traversal. Evidence is saved before launching
the first check and after each completed check. SIGTERM or Ctrl-C during a check
kills its process group, retains an interrupted receipt and pauses the run.

After a power loss or SIGKILL, run `python3 scripts/marketcraft.py recover`.
An abandoned verification is marked interrupted and cannot authorize completion.
Inspect possible orphan processes before retrying: hard process/host loss cannot
prove child cleanup, external cancellation or rollback. The runtime will not kill
an arbitrary reused PID on the basis of stale state.

Completion first saves an intent containing one destination and exact content.
Retries and `recover` finish that same record, completed state and pointer cleanup.
Repeating a successful `complete` reports the last completed run. If source/evidence
changed while completion was interrupted, recovery pauses the run for fresh checks.
An unchanged generated record is archived with run state; conflicting owner output
is preserved. No stale intent is promoted to a new successful verification.

## Updating installed projects

Installation preflights managed files, modes, product metadata and lock paths.
Local conflicts are reported before writes. A durable journal pins incoming bytes
and modes before replacements begin; interrupted installs block normal lifecycle
work, including commands that had already discovered the project.

Resume by running `install PRODUCT --update` from exactly the same framework
contents and modes. A different source is rejected. The original managed manifest
is retained in the journal, allowing partially replaced files to be reconciled
without treating them as owner edits. The final manifest is saved before the
journal is removed. This is resumable updating, not an atomic directory switch or
automatic rollback. Preserve the pinned source until an update finishes.

Files and containing directories are fsynced after atomic replacement on local
POSIX filesystems. Durability still depends on the filesystem and storage device;
network filesystems and non-POSIX hosts are not qualified by these tests.

## Declared directory inputs

Directory inputs omit incidental `__pycache__` contents and `.pyc`/`.pyo` files
from source snapshots and per-check input receipts. Every discovered path still
undergoes containment and symlink validation. Explicit file inputs remain tracked,
including bytecode files, and other generated artifacts such as `dist` contents
remain included when their directory is declared. Missing declared inputs fail.
Cold verification does not require disabling Python bytecode generation.
