# Saved records, approvals and evidence

The runtime validates saved workspace, provider and lifecycle records before
using them. Project-specific state belongs under `.foundry/state`; it is private
runtime data, not an editable substitute for the project documents. Never
hand-edit state or receipts.

Use `foundry work workflow` to manage the evidence ledger. Its existing filename,
`docs/project/marketcraft.json`, is retained so saved projects remain readable.

## Exact approvals

Plan and Design approval binds to the exact document revision shown by
`foundry review PROJECT`. `foundry approve PROJECT --revision HASH` accepts
that revision only. An edit or replacement makes an earlier revision stale.
Legacy approval markers are not imported as fresh approvals.

Scoped changes can opt in at `work start --contract PATH`. Their separate
`work review` and `work approve --revision HASH` commands bind the specification,
criteria, configured checks and run identity. Enrollment and approval are runtime
records under that run's private directory. The specification and JSON contract
remain project documents. A scoped receipt carries the approved scope revision.
Missing or altered enrollment fails closed; missing, stale or malformed approval
cannot authorize verification or completion. Legacy runs need no migration and
retain no recorded approval. The current-work JSON snapshot uses schema version 2.

Manual terminal approval is a local workflow gate, not human authentication or
a hostile-agent security boundary. A mapped passing check is evidence of that
configured check, not proof that its requirement is semantically correct.

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

Imported product history is not resumed as a new approval or completion. See
[migration](RUNTIME.md) for supported inputs and discovery limits.
