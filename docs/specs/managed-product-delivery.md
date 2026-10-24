# Foundry: from a task to a working product

Status: staged delivery plan approved by the owner. D1 is the local managed coding
preview; later stages remain future work and need their own evidence.

This plan builds on the source at `99b6b75`. It describes future behavior, not
features in npm 0.5.1. No model account, paid run, publication or deployment is
authorized by this document. A spec is not an approval or passing evidence.

## 1. The product decision

Build an open-source software-building workspace with two connected loops:

1. **Deliver work:** understand the request, agree on success, implement it,
   run the app, test it, repair it and deliver a reviewed change.
2. **Improve the working method:** use recorded failures to propose a small
   instruction or skill change, compare it with the current method, and retain
   it only after independent checks and owner approval.

The second loop must improve the first. It is not a replacement for a working
coding agent, a reason to generate more documents, or permission to modify
Foundry's own authority. Model weights remain fixed.

Working positioning: **Build the product, show why it works, and keep working
methods that prove useful.** This is a proposed value proposition, not a claim
that other products lack these ideas or that Foundry is already better.

The first users are developers and small product teams working in their own
repositories. The switching hypothesis is less repeated supervision and rework,
with control over the executor and model. Open-source distribution and existing
coding-tool integrations are starting channels, not validated demand. Pricing
and hosting are not decided here. More rollouts cost more; account economics
must be measured rather than hidden inside a quality score.

## 2. What stays and what changes

| Area | Reuse now | Work still required |
| --- | --- | --- |
| Product workflow | Research, Plan/Design approvals, assigned tasks, checks, review and local handoff | Execute these assignments in a managed workspace and connect the complete owner journey |
| Type safety | Strict TypeScript, Zod, typed session states and SQLite records | Shared public session API, validated executor events, workspace and improvement contracts |
| Execution | Managed fixture bridge and pinned OpenCode server lifecycle | Real supervised coding turns, explicit model selection, active-tool stopping and recovery |
| Providers | Existing terminal adapters and OpenCode's host-owned settings, including a tested local OpenAI-shaped endpoint | Managed connection profiles, per-model qualification, useful setup errors and usage accounting |
| Workspace | Project claims and exact project binding | Actual isolation, terminal, browser, preview, diff and owner takeover |
| Delivery | Local checks and task receipts | Authorized PR creation, CI/review follow-up, repeated-failure limits and release permissions |
| Learning | Failure records and bounded repairs | Versioned candidates, matched experiments, independent evaluation, approval and rollback |

Do not rewrite working code just to call this a rebuild. Keep one TypeScript
core. Existing workflow records remain authoritative for scope, approval,
checks and completion. New session storage owns execution records, not a
second planner or copied workflow status. Preserve the connected-client mode;
it must never secretly start a managed executor.

## 3. The experience we are building

The owner can start from a repository issue or a product idea. Small bug fixes
use a short spec; a new product gets source-backed research and visible design.
Do not force every task through a long interview or research stage.

The future workspace has:

- A task conversation and one plain-language next action.
- Plan and acceptance criteria, with proposed changes shown for approval.
- Live activity, selected model, elapsed usage and remaining run limits.
- A real application preview, browser, terminal and source diff.
- Pause, Stop, Resume and Take over controls with confirmed outcomes.
- Design revisions and actual desktop/mobile states, not decorative mockups.
- Checks and review linked to the exact code revision being inspected.
- A delivery view with the PR, CI outcome, unresolved risks and release action.
- A separate optional Improvements view showing a method diff, evidence,
  applicability, cost, approval and rollback. No internal hashes in normal copy.

These are product requirements, not a screenshot of an implemented interface.
The static public website remains separate from this authenticated local app.
Use the existing quiet shadcn-style system, with complete control, focus, error,
empty, loading and disabled states. No new landing-page redesign is needed.

## 4. Worked example: a studio booking product

### Brief

"Build a booking product for a small photography studio. Customers choose a
room and time, staff manage availability, and bookings can be moved or cancelled.
Make it work well on mobile."

This example is a proposed acceptance trial. It is not customer research or an
app Foundry has already built. Product code belongs in a separate repository.

### What the owner would see

1. **Clarify decisions.** Foundry asks about rooms, staff/customer roles,
   time zones, cancellation rules and integrations. It proposes a bounded first
   version rather than silently adding payments or production email.
2. **Agree on success.** The plan names observable requirements: prevent double
   booking, enforce role access, preserve data, handle time zones, allow an
   eligible cancellation and work on a narrow mobile screen.
3. **Approve an actual design.** The running app shows the room calendar,
   booking form, confirmation, booking details and staff view. Empty days,
   loading, unavailable slots, expired sessions and booking conflicts are
   visible. The owner requests changes and approves a captured revision.
4. **Build the complete path.** Foundry creates the application and database
   changes, enforces authorization on the server, builds the approved UI, and
   runs the app. Staff and customer accounts use test data in the isolated
   workspace. Any real account or service connection needs separate approval.
5. **Exercise behavior.** Two customers attempt the same slot concurrently;
   exactly one succeeds. A customer cannot read another customer's booking.
   A booking across a daylight-saving boundary follows the declared policy.
   Cancelled inventory becomes available again without duplicate notifications.
6. **Let the owner steer.** Pause confirms active work stopped. The owner edits
   cancellation copy, then resumes. Fresh code and approval revisions are
   checked instead of replaying the old prompt or overwriting owner edits.
7. **Deliver.** Foundry presents the tested change, current screenshots, a PR
   and CI status. It can address an authorized CI failure within the repair
   budget. Merge, real payments, live email and deployment remain explicit.

### Where learning would make a visible difference

Suppose the first attempt checks availability in the UI but not atomically in
the database. A concurrent-booking test fails. A normal repair fixes that app.

Foundry could also propose two changes to its working method:

- General: identify and test important invariants at their enforcement layer.
- Booking-specific: test simultaneous reservations and inventory release.

Each is tried from the same clean starting project and compared with the
baseline. Only supported changes are combined, and that combined method is
executed and checked again. It can be rejected even if its own explanation
sounds convincing.

A passing booking repair is not a general lesson yet. A reusable invariant
checklist must also help on fresh inventory or appointment tasks without
regressing unrelated work. Studio colors and layout preferences stay with the
studio project. A retained lesson includes when it applies and when it does not.

The owner sees something like:

> Proposed method update: test shared-resource conflicts before marking work
> ready. Here is the instruction diff, the failed baseline, the candidate runs,
> the fresh-task results and the extra usage. Keep it, restrict it to booking
> projects, or reject it.

All numbers in that view must come from actual runs. This plan invents no wins.

## 5. Research translated into engineering

### Primary reference: Harness²

Google Cloud AI Research and collaborators describe **Harness²: Recursive Agent
Harnessing for an Open World**:

- [Paper](https://arxiv.org/abs/2610.14224), especially sections 2.2, 2.3 and Appendix F.
- [Reference implementation](https://github.com/google-research/harness2).
- [Experiment protocol](https://github.com/google-research/harness2/blob/main/docs/EXPERIMENTS.md).

Its task-level step obtains a reference run, proposes general and domain-specific
harness edits, probes them under matched conditions, selectively composes a
successor and executes the successor. A separate library stores adopted
harnesses and evidence-supported lessons to guide future improvement. Each new
task starts from a common base, not the last task's blindly inherited edits.
The improvement-stage instructions and decision rule remain fixed while the
library evolves. Parallel and sequential recursion trade additional computation
for broader or deeper exploration.

| Research idea | Foundry adaptation | Observable check |
| --- | --- | --- |
| Propose | Two bounded, allowlisted instruction/skill candidates tied to a specific observed failure | Unsupported paths or changes to authority are rejected before execution |
| Probe | Baseline and candidates run from separate copies of the same project snapshot with the same model and service fixtures | Compare manifest digests, code results, trajectories and total usage |
| Compose | Select supported edits, resolve conflicts, allow no change, and execute the composed method | Composition alone cannot claim success; fresh checks must run |
| Improvement library | Retain versioned methods and contextual lessons, then retrieve selectively | New tasks start from the pinned base; rejected or unrelated lessons stay inactive |
| More recursion | Add sequential or parallel exploration only after a one-step method is useful | No budget expansion or parallel worker starts without explicit allowance |

This is a restricted adaptation, not an exact reproduction or a promise of
paper-level results. The paper studies professional benchmarks, not our whole
product-building workflow. Its own limitations include extra cost, stochastic
execution, shared model biases and no guarantee of correctness or transfer.
Its repository warns about unrestricted network access, disabled Codex sandboxing
and possible rubric access. We will not copy those evaluation/execution defaults.
Behavioral contrasts guide proposals; they never replace actual product checks.

The [GEPA paper](https://arxiv.org/abs/2507.19457) is a later comparison for
offline instruction optimization, not a second optimizer to add immediately.
The [RSI survey](https://arxiv.org/abs/2609.11873) provides useful terminology,
not one algorithm or an implementation checklist. Fixing an app is a repair;
keeping a proven skill is learning; improving the improvement procedure itself
needs a separate later experiment. Do not label all three "RSI".

### Product references

- [Devin session tools](https://docs.devin.ai/work-with-devin/devin-session-tools):
  watch work, inspect code, operate the browser, steer and take over.
- [OpenHands SDK architecture](https://docs.openhands.dev/sdk/arch/sdk) and
  [confirmation controls](https://docs.openhands.dev/sdk/guides/security):
  session persistence, tools, execution boundaries and approval behavior.
- [OpenCode SDK](https://opencode.ai/docs/sdk/): first selected coding executor,
  behind Foundry's session boundary rather than a new model/tool loop.

These sources establish public designs and research claims. They do not prove
comparative Foundry performance or feature parity. Recheck pinned upstream
versions before each implementation stage; do not chase a moving "latest" target.

## 6. Architecture and authority

```text
Owner: task, model choice, permissions, limits, approvals
                       |
Local workspace UI / CLI / project-bound API
                       |
Shared typed commands and validated events
                       |
Existing scope, task, approval, check and review core
                       |
Managed supervisor + durable session/event store
                       |
Selected executor -> isolated project + terminal + browser
                       |
Candidate -> independent checks -> review -> authorized delivery

Optional improvement runner, in separate disposable workspaces:
reference -> two proposals -> probes -> compose -> fresh execution
                       |
fresh-task evaluation -> owner-approved library version -> rollback
```

First-party core, contracts and workspace UI remain TypeScript. Zod validates
external requests, executor events, saved records and tool outcomes. SQLite
stores new session and improvement records transactionally with references to
existing scope/evidence. Images, logs and source snapshots remain bounded files.
Do not migrate all existing project files just to make the architecture uniform.

Each execution manifest pins the project/starting commit, approved scope and
Design, executor binary/image, provider/model configuration, selected skills,
tool/network permissions, check definitions and run limits. No secrets appear
in the manifest. Missing or changed bindings require a new decision, not an
automatic rebind. Resume revalidates current inputs.

### Editable methods are not editable authority

Harness² exposes eight editable components. Foundry deliberately starts smaller:

| Component | Learning policy |
| --- | --- |
| Task instructions, skill text, tool-use guidance | Bounded candidates allowed; versioned, evaluated, explicitly adopted |
| Project memory | Relevant facts need current evidence; taste remains project-scoped |
| Subagent guidance | Text may be proposed later; worker count and permissions cannot expand |
| Scripts, plugins and executable tool definitions | No automatic adoption; ordinary reviewed source change and sandbox tests |
| Guardrails and system authority | Not editable by learning; owner approval, permission enforcement and protected instructions are outside candidate control |
| Tests, evaluation data, judges and budgets | Immutable to candidates; a normal product change cannot rewrite the experiment used to justify itself |

Changing a model or provider creates a separately qualified configuration.
An OpenAI-compatible endpoint is a transport choice, not proof of tool, context,
reasoning, structured-output, cancellation or billing behavior.

## 7. Delivery stages and exit gates

Implement in this order. Each stage has a spec, observable demo and evidence.
Do not count an internal module or test count as a completed product milestone.

| Stage | Owner-visible result | Exit gate | Depends on |
| --- | --- | --- | --- |
| D1. Real managed coding journey | Start an approved task, watch actual OpenCode edits, pause/stop/resume and inspect fresh check results from the terminal | Real pinned executor, actual active-tool stop proof, crash recovery, current verification and no unauthorized task completion | Existing session/bridge/lifecycle code; detailed D1 spec below |
| D2. Isolated workspace and local app | Use one authenticated workspace with live activity, real preview, terminal, browser, diff, model selection and takeover | Container/VM containment tests, owner browser journey, mobile/keyboard/control states, no secret or host-directory inheritance | D1; terminal/browser resources and all execution inside the isolation boundary |
| D3. Delivery and follow-up | Get an authorized PR; watch CI; see bounded fixes and final handoff | Disposable-repository PR/CI trial, duplicate-safe effects, stop/cost limits, no unsolicited merge or deployment | D2 and owner-granted Git access |
| D4. Complete product trial | Build and review the booking product from brief to delivery; owner judges its real design | Full customer/staff journey, persistence/auth/race/time-zone tests, actual browser evidence and owner acceptance; same-brief baseline comparison | D3 plus separately approved model/service usage |
| D5. One-step method improvement | Inspect a tested method change beside the ordinary build | Controlled reference/propose/probe/compose run; negative cases; equal-budget comparison; no new authority | D4 and an evaluation suite fixed before optimization |
| D6. Cross-project learning | Approve, restrict or roll back a method based on fresh-project results | Held-out transfer, replayable provenance, model/version applicability, private-data controls and working rollback | D5 |
| D7. Improve the improver, optional | Compare different proposal/selection strategies | A separate experiment shows better later improvements at comparable total budgets without altering validators or authority | Evidence from D6; new owner-approved experiment |

D1 may expose an explicitly selected trusted-local preview only for a trusted,
disposable checkout. It is not a sandbox or general release. No silent local
fallback is allowed. D2 is mandatory before accepting arbitrary repositories,
parallel candidate execution or an advertised managed workspace. If the owner
does not want a trusted-local preview, gate the first real run on D2 containment.

D2 includes per-resource access controls, credential brokering, bounded output,
process-tree/resource shutdown, preview origin checks, local-API authentication,
CSRF/origin protections, and safe artifact retention. A worktree is not isolation.
No host home directory or Docker socket is mounted into an agent workspace.

Provider rollout is staged too: deterministic fake endpoint, explicitly selected
live configuration, failure/cancellation qualification, then an additional provider
family. Record tested capabilities per model/version; fail clearly rather than
silently substitute a model. A live endpoint test needs spending/data consent.

## 8. Spec-driven implementation rules

For each delivery stage:

1. Link the request, current source behavior, constraints and explicit assumptions.
2. Write stable acceptance IDs and examples, including failure and permission cases.
3. Map criteria to existing check IDs and named new behavioral tests. A green
   general runtime suite alone does not establish a new capability.
4. Review the scope, then record its exact approved revision through Foundry.
5. Implement through the shared core; expose the complete bounded journey.
6. Run narrow tests, Node 24/25 and applicable package/site/tooling/catalog/security
   gates. Preserve pre-commit hooks. Record exact inputs and evidence.
7. Review behavior and owner-facing wording; capture real UI evidence for UI work.
8. Complete scoped work only with current passing evidence, then open a focused PR.

Product-level criteria below remain NOT IMPLEMENTED until their own evidence exists:

| ID | Requirement | Required evidence |
| --- | --- | --- |
| FP-01 | A managed session actually implements an approved task | D1 real-executor journey plus current core verification/task receipt |
| FP-02 | Owner steering, stopping and recovery work during active execution | Active-tool process/cgroup checks, restart and lost-ack tests; not just an abort response |
| FP-03 | Workspace tools are visible, usable and contained | D2 negative containment tests and recorded owner UI journey |
| FP-04 | Delivery handles PR/CI work under explicit authority | D3 disposable-repository end-to-end run, duplicate/retry and permission tests |
| FP-05 | Product creation produces useful, accepted results | D4 booking trial, owner visual/behavioral acceptance and baseline comparison |
| FP-06 | Supported providers are explicitly selected and individually qualified | Pinned capability/failure matrix, fake and consented live results separately |
| FP-07 | Method edits can be compared without changing the evaluator | D5 isolation/provenance/selection tests and actual paired runs |
| FP-08 | A retained lesson helps fresh work and can be revoked | D6 held-out runs, scoped retrieval, version rollback and deletion tests |
| FP-09 | Existing client mode, owner records and package behavior remain valid | Migration/compatibility and installed-package regressions |

The companion `managed-coding-journey.md` is the first implementation spec.
`evaluated-workflow-learning.md` defines D5/D6 so earlier stages capture the right
evidence without shipping a premature learning engine.

## 9. Evaluation and honest comparison

Use three comparisons rather than crediting extra inference to the framework:

1. Same executor/model with its normal one-shot workflow versus ordinary Foundry.
2. Ordinary Foundry versus one-step task-level improvement, without library reuse.
3. Task-level improvement versus improvement with an approved experience library.

Pin the model, starting repository, task, dependency/service fixtures, tool access,
environment, limits and evaluation version. Count editor, baseline, candidate,
composition, verification and failed-run usage, not only the winning output.
Report actual elapsed time, tokens/cost where available, owner interventions,
completed criteria, critical regressions and blinded visual judgments.

Pre-register a small pilot of four tasks with three paired repeats per condition:
booking, inventory, an existing-repository bug and a non-UI service change.
It checks feasibility and cost; it does not prove general superiority.
Next freeze a fresh task set, kept out of candidate/reflection context, before
optimizing. A proposed next set is twelve tasks with repeated paired runs.
The live experiment and its total budget require separate approval.

Never let candidates read hidden checks, judge credentials or answer/rubric files.
Public acceptance requirements remain visible. The evaluation runner uses a
separate identity/workspace and network allowlist; project tests are not the
hidden evaluation. Freeze or disable external side effects in repeated trials.
Report data/version provenance, failures, inconclusive outcomes and uncertainty.
If judge models disagree with functional evidence, do not overrule the evidence.

Proposed adoption rule: zero critical safety/data regressions, all required
checks current, no unacceptable visual regression, and a repeatable measured
benefit in completed requirements or owner intervention at comparable total
budget. Lock the precise threshold before running the experiment, not after
seeing which candidate wins. No result means no adoption.

## 10. Limits, permissions and release

- Account connection, spending, outbound PR operations and deployment each need
  explicit authority. A Plan approval is not spending or release approval.
- Run limits include turns, tool calls, elapsed time and output. Usage estimates
  are not guaranteed dollar caps; use pre-dispatch reservations where the provider
  supports reliable pricing and show uncertainty/in-flight usage explicitly.
- Stop cannot undo a completed external action. Unknown effects require inspection;
  never replay sends, pushes, bookings or model prompts just because an ack was lost.
- Retained experience is private by default. Redact credentials and sensitive data,
  separate tenant/repository scope, support deletion and never export lessons to
  other projects or a shared catalog without permission.
- Additive schema migrations must be transactional and tested with old records.
  Unknown schemas fail without deleting data or starting work. No broad file-store
  migration is assumed by this plan.
- Keep upstream provenance if code is reused. An all-TypeScript implementation of
  selected ideas is not the upstream Python implementation or a faithful replication.
- No npm release, automatic merge, live service connection or RSI claim is bundled
  with the plan. General availability waits for the corresponding exit gates.

## 11. Immediate next action

Review the product direction and booking example with the owner. Then implement
D1 from its companion spec, with an explicit trusted-preview decision or D2-first
containment. The first proof must show actual supervised coding and stopping,
not another foundation-only PR. Learning implementation waits for D4 evidence.
