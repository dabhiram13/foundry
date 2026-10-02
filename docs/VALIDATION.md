# Validation

Run the framework checks documented in README.md. Treat each result as evidence
for its exercised boundary; a green catalog or runtime test does not prove a SaaS
customer journey, market demand, native delegation, or a live provider integration.

## Local factory release evidence — 2026-10-01

The local factory, browser UI, original ChatGPT OAuth bridge and private MCP
package were developed from `32d5a87d9b42e41d57cbc55cbe3d951d16d41a2f`.
The settled suite passed 169 framework tests. Current runnable checks cover
these boundaries:

- Framework tests cover stage dispatch, two exact-document approval gates,
  real lifecycle/workflow verification, custom adapter registration, model
  settings, recovery and cancellation. Independent review found and repaired
  late-cancel corruption of committed completion and false background-job status.
- Authentication tests verify real signed JWTs against controlled OAuth/JWKS
  endpoints and a controlled secure-store boundary. Account A → sign-out →
  account B now requests a fresh client while retaining the stable host ID.
  A separate temporary dummy Keychain entry was written, read and deleted on
  this macOS host; no owner credential was copied.
- The Factory browser journey exercises real loopback HTTP, workspace creation,
  research/scope/design artifacts, two owner reviews, actual product checks,
  release handoff, saved specialist settings, desktop and mobile interaction.
  Its agent executable is a declared double; this does not prove agent delivery.
- The packaged stdio server exposes 11 tools and delivers its bundled panel.
  A fresh plugin-data directory independently bootstrapped pinned dependencies
  and completed an actual MCP initialization. Both manifests validate against
  their declared schemas. Host marketplace installation/rendering is separate.
- Existing web tests passed 12 checks; evaluator contracts passed five checks;
  the representative SaaS HTTP/browser evaluation passed all required stages
  and 13 browser criteria. Its inference and plan remain controlled doubles.
- The panel rebuild is reproducible; catalog checks pass for 37 workflows,
  67 optional references and 28 roles. The staged Git index passed the configured
  high-confidence secret scan.

Live owner OAuth consent, a successful turn through Foundry's new ChatGPT token
route, native host plugin installation, a second commercial provider and public
or deployed release remain separately qualified outcomes. The owner-authorized
native notes trial used the existing Codex login. Its inherited-default research
run hit the trial-only 300-second limit and correctly failed. A fresh qualification
with requested project settings `gpt-6.1-sol` / `low` completed real research and
scope turns in about 52 and 49 seconds, respectively, then stopped at the owner
scope-review gate. The runtime did not report a resolved model. Design, build and
product verification have not run; these are not end-to-end delivery evidence.
GitHub Actions status belongs to the pushed revision, not this local evidence.

## Coverage

- Runtime and hook tests exercise installation/update preservation, project
  boundaries, lifecycle/recovery, verification freshness, and hook behavior.
- The internal HTTP/SQLite fixture exercises real requests, invalid input,
  persistence, and restart behavior. It is test support, not a universal app starter.
- The catalog validator checks packaging, role configuration, invocation policies,
  and referenced files. It is not a semantic grader for all imported instructions.
- `test_instruction_contracts.py` checks native model/reasoning inheritance,
  read-only reviewer configuration, forbidden reviewer lifecycle commands, and the
  known failed-repair-to-WARN regression. Mutation examples establish that its
  narrow policy checks reject the old defects; these are not prose snapshots.
- Product behavior, service integration, UX, and release checks belong in the
  product's configuration and accepted criteria. The UX artifact gate establishes
  recorded readiness; rendered/interaction evidence establishes what was observed.
- [Journey evaluation](EVALUATION.md) adds real session/tenant/SQLite/credit/retry
  behavior and actual desktop/mobile Chrome interaction to the fixed fixture.
  Provider calls and the plan remain explicit doubles; this does not qualify live
  SaaS services or agent-generated implementation.
- Workflow records/gates test provenance, source-bound receipts, intent and stale
  failure handling. Provider tests use real local processes with fake executables
  to test capability negotiation, cancellation, immutable budgets and recovery.

Optional native hooks require trust review through `/hooks`. They are local
advice and narrow guardrails, not a security boundary or a completion engine.
A test needing unavailable sandbox access or service authority remains unverified.
Do not install tools, weaken tests, or substitute a different check silently.

## Marketcraft implementation evidence — 2026-10-01

The implementation was developed in an isolated clone of revision
`119edd9c93e28243e86ed809bd5b19afce938698`. All four approved phases have executable
contracts or tests; business/design/release judgment remains attributed evidence.
The implementation spec is `docs/specs/marketcraft-approved-upgrade.md`.

- The original seven reliability regressions failed on the baseline and passed
  after repair. Independent runtime review found and reproduced six additional
  executable, symlink, locking and recovery defects; those have regression tests.
- Independent contract review reproduced and retested stale failure suppression,
  inherited intent on new requests, recovery elapsed accounting and JSON enum
  type confusion. No finding remains open within those reviewed boundaries.
- A settled framework suite passed 98 tests. SaaS slice checks passed 17 tests
  (12 HTTP and five evaluator contracts). The existing web fixture has 12 tests.
- The SaaS worker ran the complete HTTP/browser evaluation three times against
  identical source. Each passed nine browser criteria with eight screenshots and
  a trace; all 39 artifact receipts matched. Desktop and mobile PNGs were reviewed.
- Installed-project compatibility was independently exercised through canonical
  install/start, legacy verify, canonical complete and repeated legacy complete.
  Seven interrupted-update replacement boundaries recovered without owner-file loss.
- Independent browser review then reproduced a post-commit UI refresh failure
  that could charge another demo credit on retry. The repaired UI retains the
  operation key through display recovery. New real-browser session/list refresh
  regressions independently confirmed unchanged balances and exact key reuse;
  the complete suite now requires 11 browser criteria. CI explicitly runs the five
  evaluator contract tests as well as the journey itself.

These are local observations, not claims that CI or production was exercised.
The final coordinator must run the configured six required checks on the applied
checkout and preserve `.foundry/state/` receipts before recording completion.
Live inference, actual subscription/API billing, native role-generated delivery,
real payment/mail/cloud services and complete accessibility conformance remain
unverified. The new CI package/image pin is configured; this local task did not run
GitHub Actions or install dependencies. No commit, push or deployment is implied.

## Instruction regression evidence — 2026-10-01

The new focused instruction suite was first run against the previous role files.
It failed on planner's reasoning override, three writable review roles, and both
evaluators' lifecycle mutations/failed-repair severity changes. After the updates:

```sh
python3 -m unittest discover -s tests -p test_instruction_contracts.py -v
python3 -m unittest discover -s tests -p test_catalog.py -v
```

The six instruction tests and one catalog-validator test passed. They do not prove
that a model will follow the instructions, that native role discovery works, or
that a product was exercised in a browser. Final integrated checks must run after
all workers' changes settle.

## Earlier evidence — 2026-09-30

Two isolated instruction exercises reviewed the earlier planner and quality-gate:
a planning-only Python CSV-export request produced a scoped plan without starting
implementation; a review-only persistence case reproduced record loss despite a
passing no-op check and reported it without repairing or completing a run.

That update reported 22 framework tests and 12 HTTP/SQLite fixture tests passing.
The HTTP tests required loopback access outside the restrictive sandbox. Browser
example changes had syntax checks, not a live product browser run. These dated
results are historical evidence, not validation of the current checkout.

## Delivery evaluation

Use private, reproducible cases with an initial repository, allowed actions,
request, independently held expected outcomes, and recorded results. Cover an
idea intake, existing-product feature, regression fix, interrupted/resumed run,
missing integration, read-only request, and authorized release preparation.
Include more than one application stack and relevant UX failure/recovery states.

Run native roles when evaluating their discovery and coordination. Record
revision, model/runtime versions, worker boundaries, criteria, commands, rendered
artifacts, blockers, human interventions, and elapsed time. Include usage only
when the execution interface supplies reliable values. Repeat representative
journeys; disclose which were not run. A successful agent turn is not acceptance.

For commercial claims, distinguish observed customers from synthetic fixtures or
personas. A local test cannot prove profitable acquisition, willingness to pay,
retention, or live billing. Keep local, deployed, and owner-accepted outcomes
separate. Use failures to improve the smallest relevant contract and rerun the
regression before activating a new skill or widening automation.

## Optional evidence and qualification additions

The current local framework additionally rejects missing/empty/stale execution
reports and changed retained report evidence, binds optional red/green quality
observations, validates optional commercial provenance and review dates, and
persists bounded candidate/evaluation/explicit-selection records. The fixture
adds guided review/back/edit/resume, save-refresh recovery and a transactional
first-outline activation event. These are local mechanisms, not independent
semantic judges, customer evidence or a live provider qualification.

Regression sensitivity deliberately disables quality checks, threshold/freshness
checks, draft persistence and activation insertion in isolated copies. The
corresponding assertions must fail. Exact counts, elapsed times and current
aggregate status belong to saved run receipts, not earlier historical totals.
