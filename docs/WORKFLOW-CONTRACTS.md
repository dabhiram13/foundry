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

Scope contracts can optionally contain a bounded specialist task plan. The plan
and selected role policies join the same exact approval revision, not a second
controller. Task completion records current passing receipts in the existing run.
Progress is tied to the scope revision; a revised scope makes those tasks pending.
Final review reports cover every criterion and are bound to inputs, approval and
receipts. Missing, invalid, stale or blocking reports prevent local completion.
Reports are host-reported judgments; their presence does not authenticate an
independent specialist. See [connected work](COMMANDS.md#connected-specialist-work).

An optional `preparation: {}` also connects Research and Design to this same
run. Research has separate source-selection, capture and synthesis turns. The
existing bounded reader saves snapshots; reports must quote those captured
excerpts. Artifacts live under the run's private `preparation/` directory and
the scope contract names their exact paths and hashes. Scope review exposes
readable Research and the structured Design handoff, not just opaque references.

Plan approval precedes Design. Design covers each criterion once, with primary
and failure states, responsiveness and accessibility. Interface work needs six
text handoffs: user journey, information architecture, wireframes, visual rules,
component states and validation plan. It also needs a working preview in the
product app, a chosen design system, component source/state mappings, screen
routes and criterion links, plus mobile/desktop PNGs and captured screen states.
The approved task plan explicitly names a writable `ui_builder_role` and assigns
the screen criteria to it. That can be the existing `designer` specialist; the
host still performs the work rather than Foundry starting another agent runtime.

Saving Design freezes bounded component-source and image copies under the run,
changes the scope revision, and requires renewed terminal approval before
building or checking. Preview URLs and original files may change; the baseline
does not. Altered or missing saved copies invalidate Design. Foundry does not
open a browser, start a server or verify that the images came from that URL.
The Designer follows its selected role's write permissions for preview work,
after Plan approval and before production integration.

Final interface review names the exact Design hash and compares each approved
screen/state/viewport with a current captured image and an observation. Final
images are frozen separately. A missing comparison, changed saved image, gap or
unverified view blocks completion, even when functional checks pass. Review
still binds to the workspace, approval and receipts. Screenshots and judgments
are host reported, not automatic proof of taste, usability or owner acceptance.
Service-only work needs no images. Older text-only interface handoffs must be
replaced and reapproved; they are not silently upgraded.

Artifacts bind to the specification and selected role policy. Design also binds
to the research record and task plan, preserving the approved Plan revision and
approval hash at submission. Replacing Research removes the old plan and Design;
changing the plan removes Design. Missing, changed or invalid captures/artifacts
cannot unlock downstream work. Context reports their missing/invalid/stale/current
status separately from approval and checks. Frozen source snapshots record what
was read then; no background refresh or external truth verification is promised.
Cancellation during capture can leave unreferenced partial files, never accepted
findings. Retry capture explicitly in the same run; no second controller starts.

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
