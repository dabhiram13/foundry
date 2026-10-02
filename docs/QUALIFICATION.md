# Local measured qualification

Use qualification when comparing a small changed artifact against an established
version. It is optional for ordinary tasks. Foundry registers immutable file
identities, executes a local evaluator, saves per-case evidence, and lets the owner
explicitly select a qualified version. It never generates candidates, automatically
promotes, calls a model, or deploys anything.

## Commands

Within an existing active run (`start … --spec …`), using project-relative paths:

```sh
python3 scripts/marketcraft.py qualification register baseline examples/baseline.txt
python3 scripts/marketcraft.py qualification evaluate baseline examples/cases.json examples/evaluator.py
python3 scripts/marketcraft.py qualification select baseline
python3 scripts/marketcraft.py qualification register candidate examples/candidate.txt
python3 scripts/marketcraft.py qualification evaluate candidate examples/cases.json examples/evaluator.py
python3 scripts/marketcraft.py qualification select candidate
python3 scripts/marketcraft.py qualification status
```

Paths above are illustrative project files, not bundled artifacts. `status` works
without an active run. Registration with the same ID and file hash is idempotent;
changed content needs a new ID. Registration/evaluation do not change the active
version. `select` is an explicit human-directed operation, not deployment. No
incumbent can be bootstrapped without a successful evaluation.

A test set contains exact expected cases, each with a finite minimum score:

```json
{"cases": [{"id": "output-contract", "probe": "local", "minimum_score": 1}]}
```

The evaluator is **trusted, owner-authorized Python code**. Foundry runs it with the
current Python interpreter, project working directory, no shell, and a 30-second
timeout (configurable through `--timeout`, maximum 120 seconds). It receives one
JSON object on stdin with absolute `artifact` and `test_set` paths, `cases`, and the
active `run_id`. It must exercise the actual artifact and emit one JSON object on
stdout, with exactly one result for every expected case:

```json
{"cases": [{"id": "output-contract", "executed": true, "passed": true,
            "score": 1, "cost": null}]}
```

Scores are higher-is-better. A result passes only when `passed` is a JSON boolean
true and its finite score meets the declared minimum. Unknown cost stays `null`;
it is not treated as free. Known costs must be finite and nonnegative. Aggregate
cost remains unknown if any case cost is unknown. Result output is limited to 1 MiB.
The process group is terminated on completion or timeout.

An exit-zero script with no cases is **blocked**, not qualified. Missing, duplicate,
extra, unexecuted, incorrectly typed or nonfinite results also block qualification.
The result schema is strict: the top-level object contains only `cases`, and each
case contains only `id`, `executed`, `passed`, `score` and optional `cost`. Unsupported
fields and malformed probe types produce persisted blocked receipts.
A valid executed case that fails its threshold is **rejected**. Live cases are
**blocked/unverified** by this local-only interface even if a script claims they
executed: a separate authorized integration and evidence are needed for live probes.

## Durable identity and selection

State is maintained by the runtime under `.foundry/state/qualification/`. Candidates,
evaluations and selection receipts persist across process restart. Each evaluation
has its own UUID and binds the active run ID plus SHA-256 hashes and paths of the
artifact, test set and evaluator. Hashes are checked before/after execution and again
at selection. Changes require requalification. Latest failed/blocked evidence cannot
be bypassed by selecting an older successful receipt.

To replace an incumbent, both versions need current successful evaluations in the
active run using the same test-set and evaluator identities. No case score may
regress relative to the incumbent. Changed test-set/evaluator content requires
requalifying both. Starting a new run likewise requires fresh evaluations. A rejected
or blocked attempt never changes the active version. All selected versions and
previous versions remain recorded.

This is a local evidence protocol, not a security sandbox or an independent judge of
evaluator quality. Evaluator code can access the same environment as the owner and
must be reviewed before execution. Hashes cover the declared artifact/test-set/
evaluator files, not arbitrary imported dependencies or external data: include those
identities in the test set when they matter. A script can lie about its assertions;
review plus negative-case sensitivity tests are required for trustworthy measurement.
An actual subprocess run is verified, but its reported semantic claims are trusted.
Do not put credentials or PII in evaluator results. No paid/live probe is implied.

## Provenance

The candidate → evaluation → explicit selection separation is inspired by
[Reef's contracts](https://github.com/Human-Agent-Society/reef/blob/0fb94b40b7539a588d09ef7a238253951df96784/reef/core/evaluation.py)
and [evaluation policies](https://github.com/Human-Agent-Society/reef/blob/0fb94b40b7539a588d09ef7a238253951df96784/reef/train/evaluation/evaluators.py),
reviewed at `0fb94b40b7539a588d09ef7a238253951df96784` (Apache-2.0).
No Reef source or dependency is incorporated. Foundry uses a persistent, explicit
qualification baseline; it does not adopt Reef's default always-select policy or
the sample regression mixin's in-memory baseline.
