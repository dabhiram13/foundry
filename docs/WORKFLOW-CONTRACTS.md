# Saved records, approvals and evidence

The runtime validates saved workspace, provider and lifecycle records before
using them. Project-specific state belongs under `.foundry/state`; it is private
runtime data, not an editable substitute for the project documents. Never
hand-edit state or receipts.

The structured workflow ledger remains at `docs/project/marketcraft.json` for
persisted-record compatibility and is managed through `foundry work workflow`.
The `marketcraft-jsonl-v1` provider protocol is also a legacy compatibility ID;
neither name selects or launches a Python runtime.

## Exact approvals

Plan and Design approval binds to the exact document revision shown by
`foundry review PROJECT`. `foundry approve PROJECT --revision HASH` accepts
that revision only. An edit or replacement makes an earlier revision stale.
Legacy approval markers are not imported as fresh approvals.

## Checks and review

The scoped work lifecycle records the active run, tasks, checks, review
findings, pause/stop state and completion decision. `foundry work verify`
reports both the command result and saved nested state in human or JSON mode.
`foundry work complete` records a completion only when the active evidence
supports it. Missing, stale, unknown or failed checks do not count as success.

`foundry status`, `foundry work status`, and `foundry provider status` are
read-only views. Provider tasks distinguish a confirmed stop from an uncertain
outcome; an interrupted task requires explicit inspection and recovery.

## Migration and recovery

Initialization and migration use journals and ownership checks. Dry-run
migration is read-only. Apply rechecks planned changes under the shared guard,
backs up supported files, and writes its runtime marker last. Recovery validates
the source, trusted backup and unchanged preserved owner data before finishing.
Unknown state is not treated as successful completion.

The legacy Python Factory registry is archived where supported but is not
resumable, and legacy approvals/completion are not transferred. See
[migration](RUNTIME.md) for supported inputs and discovery limits.
