# Evaluated workflow learning

Status: proposed D5/D6 spec, not implemented. Depends on the managed coding,
isolated workspace, delivery and meaningful product-trial gates in
`managed-product-delivery.md`. Capture useful provenance earlier, but do not
launch an optimizer before the delivery path works.

## Outcome

Let the owner inspect a small proposed change to how Foundry approaches work,
see a fair comparison, and keep or reject it. Retained changes are versioned,
scoped, reversible and supported by fresh-task evidence.

This adapts [Harness²](https://arxiv.org/abs/2610.14224), especially sections
2.2/2.3, rather than porting its Python runtime or claiming its benchmark scores.
The product's validators and authority remain outside the editable harness.

## Task-level loop

```text
Pin task, clean repository, model, tools, budgets and base method
  -> execute reference
  -> propose general and domain-specific method edits
  -> probe each on isolated copies of the same starting task
  -> compare behavior, diffs, checks, human feedback and total usage
  -> compose supported changes, select one, or keep the base
  -> execute the composed method from a fresh copy
  -> independent product checks and review
```

Do not combine modified application worktrees as if that tested a combined
method. The method, not only the generated output, is being evaluated. A new
composition requires its own execution. A timeout, rejected permission or
missing evidence remains a failed/unknown observation, not a zero-cost omission.

Begin with one bounded step. Use an explicit budget sufficient for the reference,
two probes, composition execution and editor work. Count failed attempts too.
No unapproved sequential depth, background optimization or parallel exploration.

## Cross-task loop

After delivery, review the improvement record for evidence-supported lessons.
No useful contrast means no new lesson. Store a candidate method plus its
applicable situation, counterexamples, provenance and rollback parent.

Every new task starts from the pinned approved base. Retrieve a small relevant
set of approved lessons for proposal, not an unconditional concatenation of all
previous project prompts. Revalidate task facts and model/tool compatibility.
Failed experiments are retained as non-applicable evidence, never active advice.

General promotion needs a development set, a separate validation set and a
held-out evaluation set. Pin dataset membership and evaluation policy before
optimization. Do not feed held-out answers, rubrics or detailed test failures
back into the candidate generator. Any manual iteration after seeing those
results needs a newly held-out set and a recorded experiment boundary.

## Proposed typed records

Use strict runtime schemas and inferred TypeScript types. These are new
improvement-domain records, not replacements for existing workflow approvals.

- `MethodVersion`: immutable content digest, parent, allowed component diffs,
  executor/model/tool applicability, project/domain scope and private artifact refs.
- `ExperimentManifest`: task and starting-repository digest, base/candidate refs,
  environment/image, model configuration, evaluation version, partitions, seed
  where supported, budgets, consent and effect policy.
- `TrialRecord`: execution/session refs, actual cost/usage with unknown values
  explicit, elapsed time, failed attempts, check/review evidence and interventions.
- `CompositionRecord`: included/rejected edits, conflicts, supporting observation
  refs and the successor's new execution ref. No explanation-only promotion.
- `ExperienceEntry`: situation, lesson, counterevidence, provenance, scope,
  privacy/retention settings and approval status.
- `AdoptionReceipt`: owner approval of the exact method/content/evaluation refs,
  target scope and previous active version. Revoke without rewriting history.

Candidate lifecycle: proposed -> validated-for-probe -> probed -> composed ->
evaluated -> awaiting-approval -> adopted, or rejected/withdrawn. Candidate
authors cannot write adoption receipts or evaluator records. Store records in
private transactional storage, bounded artifacts outside Git and references to
existing scope and execution evidence. Project instruction exports are explicit.

## Safe edit surface

Initially allow only task instruction fragments, skill text and tool-use
guidance with bounded diffs. Exact protected blocks are assembled outside these
fragments; path validation alone is insufficient. Candidate content is untrusted
input even if it originated from a successful run.

The improver cannot change:

- Scope/Design approval rules, owner identity or session actor authority.
- Credential access, network/tool allowlists, isolation or spending limits.
- Required tests, check definitions, evaluator code, hidden data or scoring rules.
- Git/release permissions or normal source-review gates.
- Executable scripts, plugins or tool implementations through text adoption.

An instruction attempting to bypass these controls must not gain capabilities.
Run defense-in-depth tests for malicious retrieved lessons and tool outputs.
Do not rely solely on a judge model to identify unsafe proposals.

## Acceptance criteria

| ID | Requirement | Observable check |
| --- | --- | --- |
| WL-01 | The same pinned task/model/environment is used for reference and probes | Manifest comparison rejects changed inputs, model, service fixtures or incompatible resume; unsupported nondeterminism is recorded |
| WL-02 | Candidate edits stay inside the declared surface without gaining authority | Reject protected paths, oversized diffs, script/plugin edits and injected permission instructions; sandbox negative tests verify effective capabilities do not widen |
| WL-03 | Probes cannot contaminate each other or perform live external actions | Independent clean copies, separate resource IDs and accounts; attempted cross-read/write, hidden-data access, credential reads and unauthorized network are blocked |
| WL-04 | A composition has supporting evidence and its own execution | Conflicting/unsupported changes are excluded or rejected; no-change is valid; missing successor execution/checks cannot enter adoption |
| WL-05 | Independent checks determine correctness, not the improver's preference | Deliberately persuasive but incorrect candidates fail; critical regressions veto selection; unavailable evidence is unverified |
| WL-06 | All work consumes the declared budget and supports confirmed stop/recovery | Include reference, editors, probes, compositions and failures; prevent new dispatch after limit/stop; ambiguous effects remain unresolved; retry cannot reset usage |
| WL-07 | Transfer is tested on fresh tasks before general adoption | Separate partitions and fixed evaluation policy, repeated paired runs, no held-out feedback to proposer; one-project repair cannot qualify a global lesson |
| WL-08 | The owner adopts an exact version and can roll it back | Changed content/evidence stales approval, candidate cannot self-adopt, duplicate adoption is idempotent, rollback restores the prior method for new runs |
| WL-09 | Retrieval respects applicability and privacy | Unapproved, revoked, wrong-model, unrelated-project or private lessons are excluded; taste remains project-specific; deletion removes retrievable content and invalidates affected derived entries |
| WL-10 | The owner can understand the experiment without internal metadata | Improvements view shows plain-language purpose, instruction diff, evidence, failures, actual usage, applicability and Keep/Reject/Roll back states; UI tested through real routes |
| WL-11 | Learning can be disabled without breaking ordinary product delivery | Baseline path needs no optimizer account, library access or extra runs; disabled learning never starts hidden experiments |
| WL-12 | The claimed benefit is measured, not inferred from saving a lesson | Report ordinary Foundry, task-only refinement and library-assisted refinement with matched budgets, repeated runs, functional/visual outcomes, intervention counts and uncertainty |

## Release and evaluation gates

Start with a deterministic local experiment proving these contracts and negative
cases. Label it as protocol evidence, not improved model behavior. Then request
explicit consent for the matched live pilot specified in the parent plan.

Before live work, freeze the experiment's total budget, provider pricing
assumptions, evaluation threshold, task partitions and review rubric. Separate
functional completion, owner visual acceptance and measured method improvement.
Do not cherry-pick the best seed or omit expensive failures. If evidence is
inconclusive, retain the baseline and report the uncertainty.

D6 may retain approved methods and improvement experiences while keeping the
proposal/selection rules fixed. D7 is a separate experiment to improve those
rules, with the same immutable safety/evaluation boundary. Neither model-weight
training nor unbounded self-modifying source code is part of this spec.
