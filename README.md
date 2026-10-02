# Foundry

**Foundry turns ideas into tested products.**

Build a small, differentiated product through conversation: research the market,
shape the experience, build a working slice, test it, and iterate on feedback.
You steer the product and consequential decisions; Codex coordinates the work.
Use the same workflow for a new SaaS, an existing feature, a bug, or a review.

Foundry combines Codex skills and specialist role instructions with a Python CLI
for local records, run state, checks, and evidence. It is a guided framework, not
an autonomous business or a service that runs continuously on its own.

## Get started

Requires Python 3.11+, Git, and Codex on macOS or Linux (WSL on Windows).
From this framework checkout, connect the conversational entry:

```sh
python3 scripts/connect_codex.py
```

Then start a new Codex chat if needed and say:

> Use Foundry to explore a tutor booking product. Tutors need fewer missed
> appointments; I want a simpler booking experience than their current tools.

Or invoke the entry explicitly with `$foundry`. The connection records this
checkout's location in your entry skills. Reconnect after moving it; conflicting
local skill edits are preserved and reported, not overwritten.

Codex resolves the product folder and setup. New products default to a sibling
folder beside this checkout; an existing product stays in its own workspace.
Open that product folder as a separate Codex workspace for ongoing work.
Application code belongs there, not in this framework repository.

For direct installation, use an absolute path outside another repository:

```sh
python3 scripts/marketcraft.py install /absolute/path/to/product
```

Installation preserves application code and configuration. Add `--update` only
for an intended framework update; conflicting local edits stop the update.

## From idea to feedback

Use only the depth the request needs: **small**, **feature**, or **product**.
A bug does not require fresh market research, and a planning request does not
start implementation.

| Stage | Useful output and handoff |
|---|---|
| Research | Dated customer/competitor evidence, counterevidence, and explicit assumptions |
| Opportunity and scope | A switching/differentiation thesis, pricing/channel/economics assumptions, a bounded brief, and observable criteria |
| Design | Relevant framing, flows/states, realistic prototype, and adopted visual/component direction |
| Build | A working vertical slice with agreed interfaces and clear file ownership |
| Verify | Actual behavior checks, rendered/interaction evidence, findings, and unresolved gaps |
| Release | An authorized target, exact revision, migration/recovery plan, and post-release checks |
| Learn | Actual feedback linked to a criterion or reproduction and the next scoped improvement |

Start with an existing market and a concrete customer job. Build the smallest
useful advantage, then learn from real usage and distribution feedback.
Competitor prices and synthetic personas are not proof of demand. Deployment,
messaging, spending, account connections, and recurring work require their own
authority; a recommended next step grants none.

See [the workflow](docs/WORKFLOW.md) and
[record/handoff contracts](docs/WORKFLOW-CONTRACTS.md).

## What is executable, and what is guidance?

| Layer | What it does |
|---|---|
| Skills and role instructions | Guide Codex's research, planning, design, delegation, review, and handoffs. They do not themselves launch a complete delivery pipeline. |
| Local CLI | Validates records, tracks runs, runs configured checks, detects stale evidence, and records local completion. |
| Artifact gates | Check declared criteria, evidence, references, and freshness. They cannot judge taste, demand, or whether a test is meaningful. |
| Provider adapter | Optionally runs bounded local agent/model processes with capability and budget contracts. Codex is the built-in route; other providers need a qualified adapter. |
| Hooks | Offer optional context recovery and narrow local guardrails. They are not a security boundary or a substitute for verification. |

The coordinator owns integration and final lifecycle transitions. Reviewers return
findings; authorized builders repair them. A failure stays unresolved until its
reproducing check passes. Missing evidence stays **UNVERIFIED**. Model and
reasoning choices remain yours; the framework does not silently choose paid API
billing or connect services. See [provider boundaries](docs/PROVIDERS.md).

## Skills and command shortcuts

`$foundry` is the main conversational entry. Installed project workflows are
explicitly invoked skills, such as `$foundry-design` or `$foundry-verify`.
Codex discovery/picker behavior depends on the client; these names are skills,
not additional shell commands. `/hooks` is the native Codex hook-review command.

The repository ships **37 workflow skills**:

| Purpose | Skill names (each prefixed with `foundry-`) |
|---|---|
| Orient and scope | `help`, `start`, `discover`, `deep-interview`, `spec`, `mvp-spec` |
| Set up and build | `setup`, `skeleton`, `mvp-build`, `enhance`, `fix-issue` |
| Shape the experience | `design`, `landing-design`, `logo` |
| Verify and finish | `verify`, `audit`, `security`, `pentest`, `performance`, `drift`, `finish` |
| Recover and release | `resume`, `heal`, `deploy`, `monitor` |
| Product capabilities | `payments`, `emails`, `analytics`, `sentry`, `seo`, `blog`, `domain`, `fumadocs` |
| Configuration and diagnostics | `settings`, `schema-sync`, `rate-limit`, `trace` |

A skill name is not proof of an installed integration or permission to use it.
The [catalog](docs/CATALOG.md) also covers **67 optional reference skills**;
load only those relevant to the actual project and stack.

## Specialist agents

The **28 role configurations** provide working instructions and handoff
expectations. The coordinator selects applicable roles, supplies criteria and
write boundaries, and integrates their results; you do not need to manage a roster.

| Focus | Roles |
|---|---|
| Research and opportunity | `market-researcher`, `social-signal`, `trend-validator`, `discovery-critic`, `tool-scout`, `skill-scout` |
| Planning and critique | `planner`, `architect`, `critic`, `spec-critic` |
| Design and UX | `designer`, `ux-critic`, `design-evaluator`, `logo-designer` |
| Data and implementation | `db-architect`, `backend`, `connector`, `ts-expert`, `build-fixer`, `slop-cleaner` |
| Testing and review | `api-tester`, `flow-tester`, `perf-tester`, `backend-evaluator`, `quality-gate`, `security-auditor` |
| Operating evidence and handoff | `sentry-analyst`, `complete` |

Review roles return findings without repairing the product or completing the run.
Some specialist references contain stack-specific examples; the actual project
and adopted brief govern. Role files establish instructions, not evidence that
native delegation or the resulting product has been qualified.

## Local run commands

Run these from an installed product workspace. Codex normally handles them:

```sh
python3 scripts/marketcraft.py status
python3 scripts/marketcraft.py guide --request "Review the current journey" --intent review
python3 scripts/marketcraft.py context
```

For authorized implementation, with an existing accepted spec:

```sh
python3 scripts/marketcraft.py start booking-flow --spec docs/specs/booking-flow.md
python3 scripts/marketcraft.py pause
python3 scripts/marketcraft.py resume
python3 scripts/marketcraft.py verify
python3 scripts/marketcraft.py complete
```

Resume active work before starting another feature. Configure real application
checks in `.foundry/project.json`; passing unrelated fixtures is not product
verification. `complete` requires current passing evidence. Local completion,
deployed verification, and owner acceptance are separate outcomes.
See [runtime/recovery](docs/RUNTIME.md) and [customization](docs/CUSTOMIZATION.md).

## Optional hooks

After trusting the project, inspect `.codex/hooks.json` through `/hooks` and review
its command definitions. A changed hook needs renewed native trust.

- Session start and post-compaction point to the workflow and current context.
- Pre-compaction saves a small recovery checkpoint, not the conversation transcript.
- Stop warns about active work; interruption never forces another turn.
- Pre-tool checks cover recognized patch paths, optional edit boundaries, and a
  narrow set of destructive Git commands.

Disabled hooks, unsupported tool shapes, and hook failures are not reliable blocks.
Codex permissions, explicit scope, review, and verification remain authoritative.

A separate versioned Git pre-commit hook scans exact staged blobs for known secret
patterns. It is not enabled automatically; opt in per clone with:

```sh
git config core.hooksPath .githooks
```

See [hook behavior and limits](docs/HOOKS.md). The scanner is not a complete secret
or security audit.

## Verify the framework

```sh
python3 -m unittest discover -s tests -v
python3 -m unittest discover -s tests/fixtures/web_app -v
python3 -m unittest discover -s tests/fixtures/saas_app -p test_evaluator.py -v
python3 scripts/evaluate_journey.py
python3 scripts/check_catalog.py
python3 scripts/security_scan.py --whole-tracked
```

Browser evaluation needs existing Node/Playwright and Chromium tooling; it never
installs dependencies itself. CI uses pinned Playwright 1.63.0 and its matching
browser image. Containers need an init/subreaper for process cleanup. See
[journey setup and evidence](docs/EVALUATION.md).

The disposable journey fixture exercises real HTTP, sessions, tenant isolation,
SQLite persistence, restart, credit/retry behavior, and desktop/mobile browser
interaction. Its plan and inference are controlled doubles. A green fixture does
not prove native agent-generated delivery, live provider/billing integrations,
production readiness, full accessibility conformance, or customer demand.
See [validation boundaries](docs/VALIDATION.md).

## Optional evidence improvements

For a narrow demoable slice, the [quality contract](docs/WORKFLOW-CONTRACTS.md#optional-narrow-slice-quality-and-market-context)
binds public-interface red/green evidence to unchanged tests and changed product
code. Optional market fields keep the customer job, alternatives, channel,
activation and next decision grounded in dated sources. The [UX rubric](docs/UX-RUBRIC.md)
adds review/back/edit/resume and recovery checks. [Local qualification](docs/QUALIFICATION.md)
persists candidate evaluations and permits explicit selection only after current
checks against a qualified baseline. These features do not authorize live probes
or automatic promotion. [Adaptation sources](docs/ADAPTATIONS.md) record the pinned
upstream ideas and their limits.

## Compatibility and provenance

`marketcraft` and `product-foundry` remain legacy entry aliases. Both
`scripts/marketcraft.py` and `scripts/foundry.py`, existing `foundry-*` workflows,
`.foundry` state, `MARKETCRAFT_*` variables, `docs/project/marketcraft.json`, install
markers, and provider protocols retain their existing contracts. Branding does
not require a state migration.

[Provenance](docs/PROVENANCE.md) records history and its limits;
[third-party notices](THIRD_PARTY_NOTICES.md) preserve attribution and licenses.
