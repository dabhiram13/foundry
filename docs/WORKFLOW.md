# Foundry workflow

The owner describes an idea or change normally. Sri remains the product driver;
the parent Codex session coordinates context, paths, delegation, and evidence.
There is no separate agent service. Choose the next useful action from the current
request, accepted decisions, available capabilities, and saved evidence.

Read WORKFLOW-CONTRACTS.md for the guided record schema, CLI, and artifact gates.
Read PROVIDERS.md for supported execution adapters, capability reporting, and
limits. Do not infer a runnable integration from a provider or role name.

## Adapt the depth

| Depth | Typical request | Necessary preparation |
|---|---|---|
| small | Bounded fix or UI adjustment | Reproduction, affected criterion, applicable existing artifacts, focused check |
| feature | A new or materially changed journey | Shared contracts, relevant UX handoffs, failure cases, integration evidence |
| product | A new SaaS or substantial repositioning | Commercial evidence/thesis, product brief, critical journey and design artifacts, delivery/recovery plan |

Depth changes the amount of evidence, not the owner's authority. Review,
research, planning, and installation do not authorize implementation or release.
Reuse current artifacts; do not march every request through every stage. A guided
next-step result is read-only advice. Record new decisions or feedback only through
the documented record interface when those writes are in scope.

## Evidence to product decisions

Research uncertainties that could change the current decision. For a mature-market
SaaS, connect a specific customer segment and recurring job to an existing
alternative, switching trigger/barrier, and measurable advantage. Research roles
may work independently on competitors, customer signal, and counterevidence.

For material claims, retain source URL, source date when known, observation date,
evidence type, segment, limitations, and contradictions. Distinguish vendor claims,
self-reported traction, observed purchasing, estimates, and inference. Unknown
sources or dates stay unknown. Recheck stale pricing and technical capabilities.
A competitor's paid pricing page proves an offer, not validated demand. Synthetic
personas and agent simulations are hypotheses, not customer interviews or tests.

Use the record kinds in WORKFLOW-CONTRACTS.md to keep evidence, assumptions,
decisions, criteria, and experiments distinct. The commercial chain is:

`evidence + explicit assumptions -> opportunity thesis -> product brief -> criteria`

The thesis covers target segment/job, switching reason and cost, UX/customer-service
advantage, pricing and value metric, acquisition-channel hypothesis, and unit
economics. Show expected usage, provider/hosting/payment/support cost assumptions,
refunds, contribution margin, and downside sensitivity. Unknowns do not become
profit forecasts. Choose the smallest experiment that can change the decision.

The product brief records the chosen outcome, exclusions, constraints, business
rules, and observable success. Each material criterion references a decision,
evidence, or an explicit assumption. An agent proposal is never owner approval.
Ask only about consequential unresolved decisions; continue under existing
implementation authority once those decisions are resolved.

## Six UX handoffs

For UI work, use artifact records with these stage names. A gate checks recorded
completeness and freshness; it cannot judge design taste or prove customer success.
Review the artifact and observed behavior as well. Existing artifacts can satisfy
unchanged stages; small work may need only a scoped amendment and fresh QA.

| Stage | Artifact and handoff | Evidence needed to move on |
|---|---|---|
| research | UX framing: customer job, context, pains, desired outcome, assumptions | Dated evidence or declared hypothesis; a bounded task and success criterion |
| flows | Flows, information architecture, entry/action/result, state inventory | Primary and relevant failure/recovery paths; ownership, permissions, loading/empty/error states |
| prototype | Wireframe or prototype with realistic content | Core task can be walked through; long/empty/error content and unresolved decisions are visible |
| design | Adopted visual direction, tokens, components, responsive behavior, copy | Product character and hierarchy; applicable keyboard/focus, contrast, themes, motion and device behavior |
| build | Implemented vertical slice through real UI/API/data boundaries | Working interaction, agreed contracts, relevant negative cases, and repeatable checks |
| verify | Usability, accessibility, and rendered QA evidence | Revision-linked screenshots/interaction checks, results by criterion, failures and unverified areas |

An adopted product brief overrides generic glass, gradients, shadows, card layouts,
theme prescriptions, and other aesthetic recipes. References are options; they
cannot create new mandatory requirements. Keep the chain traceable through
artifact IDs/versions and acceptance criteria. A changed upstream contract makes
affected handoffs stale until reviewed. One actor owns each shared contract.

## Build and verify

1. Inspect the repository, current status, owner documents, and partial work.
   Keep scope in `docs/specs/` with stable criterion IDs, current/desired behavior,
   exclusions, dependencies, relevant negative cases, and acceptance checks.
2. For authorized implementation, use `python3 scripts/marketcraft.py start SLUG --spec PATH`
   or resume the existing run. A small plan can live in its spec; use
   `dev/active/SLUG/plan.md` when interfaces or workers need coordination.
3. Configure real behavior/build checks in `.foundry/project.json`, preserving
   existing checks. Missing tools, credentials, and services are blockers; passing
   stubs or check names alone do not establish coverage. Follow the real stack.
4. Build the smallest complete slice. For a bug, reproduce and trace the cause
   first. Exercise changed behavior and relevant permission, persistence, migration,
   async/retry, and integration boundaries. Stay within scope and execution bounds.
5. Seek independent read-only review for substantial work when available. Reviewers
   return criterion results and findings; an authorized builder repairs them.
   A failed or reverted repair leaves the original finding FAIL. Resolve it only
   through a successful rerun of the reproducing check. Missing evidence is
   UNVERIFIED; optional advice is distinct from an accepted requirement.
6. Settle documentation/evidence writes before final verification. The coordinator
   runs `python3 scripts/marketcraft.py verify`, inspects logs, and compares every
   accepted criterion to evidence. After required checks and applicable artifact
   gates pass, only `python3 scripts/marketcraft.py complete` records local runtime
   completion. Passing commands cannot establish owner acceptance or production
   integration by themselves. Report remaining uncertainty explicitly.

UI verification uses the actual available browser and running app: changed pages,
realistic content, target widths, supported themes, console/network failures,
keyboard/focus, contrast, reduced motion, and relevant error/retry paths. Missing
rendered evidence makes visual behavior UNVERIFIED. An agent walkthrough is not a
customer usability study. Measure product outcomes only with the stated scenario
and evidence; do not claim conversions or retention from simulated users.

## Coordinate and recover

The parent owns task selection, integration, lifecycle transitions, and the final
acceptance-to-evidence comparison. Choose applicable roles from CATALOG.md. Handle
a small bounded change directly; do not spawn every specialist. No role name
requires its historical example stack or an unavailable tool.

Give delegates the spec, current artifact/contract versions, owned files,
dependencies, allowed actions, execution bounds, and required evidence. Parallelize
independent work with one writer per file/interface; serialize shared schema and
contract changes. Wait for workers, inspect real artifacts, and verify integrated
files. Reviewer verdicts and successful agent turns cannot complete a run.

Inherit the owner's model and reasoning settings. Do not silently reroute to a
paid API, broaden permissions, install tools, or switch providers to bypass an
unavailable capability. Follow declared bounds; report a durable blocker and next
action when they are exhausted. Record reliable usage only when supplied by the
execution interface. Unknown usage stays unknown. If delegation is unavailable,
work sequentially and disclose that independent review did not run.

Use status, pause, and resume to reconcile partial work. Resume keeps run identity
and invalidates prior verification. Inspect failed logs before retrying; another
attempt without a changed hypothesis is not new evidence. Keep owner decisions in
owning documents, guided records in `docs/project/marketcraft.json`, specs in
`docs/specs/`, and work notes in `dev/active/`. Never handcraft `.foundry/state/`.

A recovery handoff identifies the goal, accepted decisions, current spec/contracts,
changed files, pending workers, last evidence, blockers, and next action. Reference
artifacts rather than duplicating transcripts. Keep private product context in its
own workspace; do not collect unrelated projects into shared memory.

## Release and learn

Release only when requested and authorized. Prepare the target, exact revision,
configuration, secrets, migration order, and rollback/recovery plan before asking
for any authority still missing. Existing authorization remains valid. After an
authorized deployment, verify the deployed revision and a meaningful health/user
journey. Local completion, deployed verification, and owner acceptance are distinct.

Record actual customer feedback and operating evidence against product criteria
and assumptions. Propose the next smallest improvement or experiment. Feedback
records and recommendations do not authorize implementation, monitoring, messaging,
publishing, or spending. Recurring maintenance needs its own request. Honor
interruptions; hooks must never force work to continue.

## Bounded evidence improvements

Prefer one demoable slice and a failing public-interface assertion before the
implementation. Preserve the same tests through green, and turn recurring
failures into executable regressions. Optional quality and market records are
documented in [workflow contracts](WORKFLOW-CONTRACTS.md); ordinary small tasks
do not need extra records. Review [UX recovery](UX-RUBRIC.md) for guided interfaces.
Use [qualification](QUALIFICATION.md) only when a measured artifact comparison
is useful; selection is explicit, local and separate from deployment.
