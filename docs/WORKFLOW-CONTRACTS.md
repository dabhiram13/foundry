# Guided work and durable evidence

Marketcraft keeps the owner oriented: what is known, the next useful result, why
it matters, and any decision or connection actually needed. The coordinator
handles command arguments and record files. The owner can describe the work
normally and remains the driver.

These commands add deterministic context and evidence checks to the conversation.
They do not infer the owner's approval, certify semantic quality, start agents,
send feedback, connect services or schedule background work. The existing runtime
still owns build/verification state. Product-owned records never write directly
to `.foundry/state/`.

## Commands and their authority

Use `python3 scripts/foundry.py --project PRODUCT COMMAND`. The independent entry
point `python3 scripts/workflow.py --project PRODUCT COMMAND` has the same workflow
commands. Project selection uses the existing `.foundry/project.json` marker.

| Command | Result | Writes |
| --- | --- | --- |
| `guide --request TEXT --intent plan --complexity small --surface cli` | Current facts, one next action, appropriate path and `user_needed` items | None |
| `record --file docs/project/record.json` | Validate and append one project record | Ledger and mutation lock only |
| `context` or `context --id RECORD_ID` | Records, provenance, active/superseded/stale state and next action | None |
| `gate` or `gate --stage verify` | Check required criteria against recorded observations and current inputs | None; does not execute checks |
| `feedback --file docs/project/feedback.json` | Append a feedback record after the same validation | Ledger and mutation lock only |

Guide options are `--intent plan|implement|review`,
`--complexity small|feature|product`, `--surface cli|api|web`, repeated
`--requires CAPABILITY` and repeated `--available CAPABILITY`.
The latest fresh accepted intake supplies omitted values during continuation.
A new `--request` without explicit `--intent` always defaults to planning, so a
previous implementation brief cannot grant implementation authority to a later
review request. The coordinator interprets the actual owner request and supplies
its intent; `current.intent_source` states how it was selected.
Without an intake, defaults are planning, feature depth and API surface.
The coordinator must supply real request context rather than presenting those
defaults as inferred facts. Capabilities are explicit observations from the current
runtime, not guesses from installed files. An undeclared required capability
appears in `user_needed`; no service is connected automatically.

`guide` and `context` exit 0 after a valid read. `gate` exits 0 for pass and 1 for
fail or unverified. Schema/path errors exit 2. A missing ledger is an empty context,
not a write trigger. Planning and review never start a build run.

The guide recognizes an existing run, interruptions, stale records, accepted
intake, real spec files and recorded design handoffs. It offers a bounded path:

- Small change: scope → build → verify.
- Web feature: scope → flows → design → build → verify.
- New web product: research → opportunity → scope → flows → prototype → design
  → build → verify → release → learn.
- CLI/API products omit visual stages. A small UI change reuses existing design
  artifacts and still needs appropriate rendered/interaction evidence.

These are recommendations, not a claim that every application needs every stage.
Use a narrower complexity where justified by the request. A handoff's presence
helps choose the next step; `gate` separately checks its explicit criteria.
No passing state authorizes a release, purchase, message or background job.

## Product-owned ledger

`docs/project/marketcraft.json` has this envelope:

```json
{"schema_version": 1, "project_id": "generated UUID", "records": []}
```

`record` appends under a nonblocking local lock and atomically replaces the ledger.
It preserves earlier records and generates `created_at`, `input_revisions` and
`reference_revisions`. Never author these generated fields in submitted JSON.
Keep the source documents in their existing product locations. The ledger is an
index of decisions/evidence and their revisions, not a second copy of transcripts.

Stable IDs are unique inside the product (letters, digits, `.`, `_`, `-`, starting
with a letter, up to 80 characters). Reusing an ID fails without overwriting it.
To revise a record, append a new ID and `supersedes: "previous-id"`.
Supersession retains history and makes dependent records stale, even if the new
record has the same wording. Expired replacements do not revive old assumptions.

All records require:

| Field | Meaning |
| --- | --- |
| `id`, `kind`, `title` | Stable identity, typed record and short meaning |
| `source` | `kind`, `ref`, `observed_at`; optional `published_at`, `author` |
| `basis` | `observed` or `inferred`; simulated interviews are inferred |
| `status` | `proposed` or `accepted`; an agent proposal is not owner approval |

Source kinds are `owner`, `local`, `url`, `customer`, `observation`. A `local` ref
must identify a file in this product and is pinned automatically. A `url` is a
credential-free HTTP(S) URL; recording it does not fetch or independently verify
the source. Dates accept `YYYY-MM-DD` or an ISO timestamp with a timezone. Keep
customer identifiers minimal; do not put credentials or full private transcripts
in these records.

Optional common fields:

- `references`: existing project record IDs needed to interpret the record.
- `contracts`: existing artifact/decision/brief IDs whose revisions govern it.
- `counterevidence`: existing record IDs that challenge the claim.
- `inputs`: explicit project-relative files whose contents govern validity.
- `supersedes`, `expires_at`, `confidence` (`low`, `medium`, `high`).
- `segment`, `workflow`: the buyer segment and concrete workflow being discussed.
- `accepted_by`, `acceptance_ref`: required for accepted briefs/decisions, together
  with `source.kind: "owner"`. These preserve the reported owner decision; the
  software cannot independently authenticate a conversational approval.

Unknown fields, unknown references, cross-kind contract mistakes, path traversal,
absolute input paths and symlink escapes are rejected. References are local IDs,
not cross-product memory search. All referenced records must exist and be fresh
when a new record is appended. A record cannot overwrite an earlier entry.

## Record kinds

| Kind | Additional fields |
| --- | --- |
| `brief` | `goal`, `buyer`, `intent`, `complexity`, `surface`, `constraints` list, `capabilities` list |
| `evidence` | `claim`; optional `criteria` list, `artifact`, `method`, `outcome`, `observed`, `check` |
| `assumption` | `validation`: the observation/experiment needed to test it |
| `decision` | `rationale`; reference supporting evidence and contrary evidence |
| `artifact` | `path`, `stage`, `owner`, `next_action`, `criteria` list |
| `criterion` | `stage`, `required` boolean, `expected`, `method`; `command` argv for command methods |
| `experiment` | `hypothesis`, `metric`, `success_condition`, `stop_condition`, `operating_scope`, `outcome_evidence` list |
| `feedback` | `criteria` list, `next_task`, `operating_scope`; optional local `reproduction` path |

Stages are `intake`, `research`, `opportunity`, `scope`, `flows`, `prototype`,
`design`, `build`, `verify`, `release`, `learn`, `maintain`. Methods are `command`,
`browser`, `manual`, `customer`, `document`. A criterion needs explicit inputs or
contract references. An observation with `outcome: "pass"` or `"fail"` needs a
local artifact, method and description of what was actually observed.

Evidence without those fields can still record a market claim, but cannot satisfy
an acceptance criterion. Proposed or inferred evidence never satisfies a gate.
A pricing page establishes a category/pricing signal, not validated demand.

The ledger pins local source, artifact and reproduction files as well as declared
inputs. It binds references to their full recorded revisions. `context` returns
`freshness: active|superseded|stale` with reasons; missing/changed files, expiry,
superseded references and edited referenced content invalidate dependent records.
It never updates hashes during a read. Reconciliation means observing the new
state and appending appropriate records, not refreshing timestamps to make a gate
green.

## What a gate establishes

For the selected stage, every nonsuperseded required criterion must be accepted,
fresh and supported by accepted observed evidence using its declared method.
No required criteria means **unverified**, not pass. Optional criteria remain
visible without blocking unrelated required criteria.

A fresh failure blocks the criterion even when another observation passes.
If the failure artifact changes, expires or disappears, the unresolved failure
continues to block as unverified; a separate passing receipt cannot erase it.
Superseding failure evidence must retain its criterion links and provide sufficient
fresh pass/fail evidence; replacing it with a WARN label or unrelated claim is
rejected. When a contract changes, dependent criteria and evidence become stale
until deliberately reconciled. An unresolved but no longer current observation
is not silently treated as current success.
Failure resolutions must be fresh when recorded and remain fresh afterward. If a
resolution's artifact expires or disappears, the original obligation blocks the
gate again; an older unrelated success cannot stand in for the missing repair.

For command criteria, the evidence must be a single JSON check receipt or a runtime
batch with `checks` plus an exact `check` selector. The gate matches the configured
criterion argv, zero integer exit code, `status: "passed"`, actual log digest and
executed input revisions. It does not execute the recorded command.

```json
{
  "command": ["python3", "tests/check_notes.py"],
  "exit_code": 0,
  "status": "passed",
  "log": "evidence/notes.log",
  "log_sha256": "SHA256_OF_ACTUAL_LOG",
  "input_revisions": {"app.py": "SHA256", "docs/specs/notes.md": "SHA256"},
  "input_revisions_after": {"app.py": "SAME_SHA256", "docs/specs/notes.md": "SAME_SHA256"}
}
```

The check producer captures both maps around execution. They must match, cover
the criterion and its entire referenced input/contract chain, and still match the
current files. An old passing receipt cannot be rebound to changed application
code. Configure the runtime check's `inputs` to include the application/spec files
needed for this proof. An ordinary check without declared input maps is
**unverified for a source-bound command criterion**, with a request to configure
`check.inputs` and rerun.

Use specific source/spec paths or suitable application directories. The ledger,
its lock and Git internals cannot be recorded as evidence inputs. Avoid putting
receipt outputs inside declared input directories. This prevents a record append
or generated log from invalidating itself. The runtime's whole-source snapshot
continues to serve its separate completion guarantee.

Artifact gates become enforced lifecycle checks when the coordinator adds the
applicable command, for example `python3 scripts/marketcraft.py gate --stage verify`,
as a required check in `.foundry/project.json`. Declare and observe the criteria
first; a gate without criteria cannot pass. Settle ledger/evidence records before
the final `verify`. A preliminary execution receipt can support the recorded
observation; the final run rechecks settled source before `complete`. Do not add
stages that are outside the accepted work just to satisfy a generic pipeline.

For browser/manual/customer/document methods the local artifact and input chain
must be current, but the outcome remains an attributed observation. A screenshot
alone is not an automated usability judgment; an accessibility scan is not full
conformance. A green gate means the declared records meet these coverage and
freshness rules, not that the command is a good test, the product is secure, a
human approved it, or production has been qualified. Use independent review and
real journey tests for those claims. The ledger is mutable local project data,
not cryptographic attestation against a malicious editor.

## Evidence-led handoffs

Use `artifact` records for these handoffs, with real paths, governing contracts,
input hashes, responsible owner, exit criteria and next action. In the artifact
document, preserve decisions, risks, unresolved assumptions and scope exclusions.

| Chain | Stage and required content |
| --- | --- |
| Idea → research | `research`: specific buyer/job, dated evidence, source sampling and counterevidence |
| Research → opportunity thesis | `opportunity`: incumbent, sourced pain, switching costs, differentiation, channel and economics assumptions |
| Thesis → brief | `brief` plus `scope` artifact: chosen narrow outcome, non-goals, owner decisions and criteria |
| Research/framing → flows/IA | `flows`: navigation, tasks, realistic content, state and recovery maps |
| Flows → wireframe/prototype | `prototype`: hierarchy and critical journey, including non-happy paths |
| Prototype → visual/component system | `design`: tokens, typography, component states, responsiveness and copy |
| System → working vertical slice | `build`: concrete implementation and interface/file ownership |
| Slice → usability/accessibility/rendered QA | `verify`: routes/viewports/fixtures, keyboard/focus behavior, error cases, screenshots/traces and findings |

A coordinator connects artifacts, not just role titles. Small work can reuse
an existing flow and component system. Research is triggered by a decision-changing
uncertainty, not by the availability of another skill. Do not invent customer
evidence or guarantee profitable SaaS from competitor pricing.

## Feedback and maintenance

`feedback` records source → reproduction or criterion → next scoped task. Its
`operating_scope` is `local_only` or `proposal_only`. The same values apply to
experiments. Neither value schedules jobs or grants authority to send, spend,
deploy or alter production.

Capture a support report, reproduce it locally, link the regression criterion,
implement within the selected scope, attach fresh evidence, then record the
release and measured customer outcome separately. Use `outcome_evidence` on an
experiment to link measured results. Proposed acquisition, price and contribution
margin assumptions remain distinct from observed delivery value and revenue.
Include support/review time, retries, API costs, refunds and provider bills where
material; unknown usage is unknown.

[Templates](templates/README.md) contain placeholders that must be grounded in the
actual request and source files before recording. They do not install services or
represent preapproved decisions.
