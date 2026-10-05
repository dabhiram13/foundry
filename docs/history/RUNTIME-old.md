# Historical record: Runtime and recovery

> Superseded by the current Node 24 runtime guide.

## Local Factory commands

The terminal launcher is the primary entry point:

| Goal | Command |
| --- | --- |
| Create a project | `./foundry new NAME --idea "One useful local journey"` |
| Confirm the intended Codex subscription | `./foundry configure NAME --confirm-subscription` |
| Advance one step | `./foundry run NAME` |
| Read the Plan or Design when approval is requested | `./foundry review NAME` |
| Approve the version you reviewed | `./foundry approve NAME --revision SHA256_FROM_REVIEW` |
| Cancel a running step | `./foundry stop NAME` |

Each `run` advances exactly one step. Plan and Design require explicit owner
approval of the version returned by `review`; a changed version is refused.
`stop` asks the active provider process to cancel; when no step is running, it
leaves the project unchanged. `status`
reports saved history and the next command. `./foundry ui` is an optional view
over the same products and state directory. Do not edit `.foundry/state/` by
hand.

## Local run integrity and recovery

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

## Nonempty test execution reports

Checks may opt into `test_report`, a project-relative JSON output path. The
framework's behavior check uses `scripts/test_runner.py --start tests` with
`.foundry/state/test-reports/framework.json`. The runtime supplies
`FOUNDRY_TEST_REPORT` and a fresh `FOUNDRY_CHECK_ID` to that process. The producer
must emit exactly:

```json
{"run_id": "VALUE_OF_FOUNDRY_CHECK_ID", "tests": {"executed": 3, "passed": 3, "failed": 0, "skipped": 0}}
```

Counts must be nonnegative integers, with positive `executed = passed + failed`.
Zero coverage, stale IDs, missing reports, failed tests or skipped tests cannot
pass. The bundled unittest producer counts test methods (multiple failed subtests
are one failed method); skips and expected failures fail the strict check.
Each receipt preserves a separate report copy, its hash, execution ID, counts
and measured duration. Completion revalidates that retained report. Checks
without this opt-in retain their existing exit-status contract.

These are execution-integrity checks, not semantic proof: trusted test code can
write dishonest counts or tautological assertions. Review public-interface
assertions and demonstrate sensitivity with a deliberate defect. Keep producer
outputs outside declared source inputs; use runtime state for transient reports.
