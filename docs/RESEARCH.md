# Product Foundry: research and next build plan

Reviewed 2026-09-30. This is a selected primary-source review, not an exhaustive
survey of every skill, paper, or repository. The recommendations below are our
engineering judgment. Benchmark results from other projects are not forecasts
of Foundry's performance.

## Direction

Keep Codex as the agent runtime and keep Foundry's Python core small. Foundry
should make product intent, dependencies, application behavior, verification,
and release evidence accessible to that runtime.

The desired owner experience is: describe an idea, resolve consequential scope
decisions, then let Codex carry the accepted work through implementation,
review, testing, and an authorized release. Complex products need a sequence of
verified increments with shared contracts and durable decisions.

## What exists and what this update changes

The existing runtime installs and updates managed files, tracks one active run
per product, handles pause/resume, runs configured commands, fingerprints inputs,
and rejects stale completion. Optional hooks add context/checkpoints and narrow
local guardrails. The catalog contains 37 workflow skills, 28 native roles, and
67 optional skills. These counts measure inventory, not proven capability.

This update improves eight existing lifecycle skills and their shared workflow,
rewrites the planner and quality reviewer for the actual project's stack, and
repairs browser/testing guidance. The parent Codex session now has explicit
coordination instructions; it remains responsible for applying them.

This does not add a machine-enforced eight-stage pipeline, an SDK runner, a
dashboard, a task scheduler, a semantic requirements grader, new external
services, or a universal app starter. Native role selection, coordination, and full
product journeys still need live integration evaluation. Other specialist roles retain
conditional stack-specific guidance and should be reviewed as they are adopted.

## What the sources contribute

### Open-source Codex

The public repository exposes the CLI/runtime, App Server, and SDK components.
Its repository license is Apache-2.0. The reviewed source entry points were the
root README, App Server README, and SDK documentation; this was not a line-by-line
audit of the entire Rust implementation. Do not assume the complete desktop
application UI is available to copy from this repository.
[Repository](https://github.com/openai/codex),
[App Server source](https://github.com/openai/codex/tree/main/codex-rs/app-server).

OpenAI's February 11, 2026 engineering account describes a short instruction map,
repository-owned knowledge, runnable applications per worktree, browser
inspection, and accessible logs/metrics. Our practical adaptation is to give each
product discoverable run/test instructions and evidence for its critical journeys.
We should add structural checks only for architectural constraints the product
actually adopts. The account is one team's experience, not a universal recipe.
[Harness engineering](https://openai.com/index/harness-engineering/).

The January 23 agent-loop explanation separates model inference from tool execution
and the surrounding runtime. Foundry should use that existing runtime and focus on
product-level contracts, continuity, and verification.
[Agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/).

For future programmatic jobs, use the documented Codex SDK. For a rich client,
App Server supplies conversations, streamed events, and approval interactions.
Both Python and TypeScript SDKs are documented. Keep model selection and
permissions in supported Codex configuration. Pin and test the chosen integration
version. WebSocket support is explicitly experimental in the current App Server
docs, so it is not the default design for a production remote control service.
[SDK](https://learn.chatgpt.com/docs/codex-sdk),
[App Server](https://learn.chatgpt.com/docs/app-server),
[architecture explanation](https://openai.com/index/unlocking-the-codex-harness/).

### Prime Intellect

Prime's environment/evaluation tooling separates tasks, rollout behavior,
execution boundaries, and scored evidence. The useful transfer is a repeatable
Foundry evaluation case: request + starting repository + allowed actions +
observable acceptance checks + recorded outcome. Installing its RL training
infrastructure is unnecessary for this purpose.
[Environment/evaluation guide](https://github.com/PrimeIntellect-ai/lab-cookbook/blob/main/guides/01-environments-and-evals/README.md),
[Verifiers](https://github.com/PrimeIntellect-ai/verifiers).

The August 24, 2026 Prime Agent technical report describes persistent context,
recoverable work, subagents, verification, resource accounting, and maintained
skills/memories. We should test recovery across interruption and improve a skill
only after an observed failure supplies a regression case. Its benchmark gains
are author-reported and environment-specific. A persistent REPL/daemon is an
option only if our real work exposes a continuity problem that Codex does not
already solve.
[Paper](https://arxiv.org/abs/2608.23552),
[Code](https://github.com/PrimeIntellect-ai/prime-agent).

### DeepSeek Harness

The official deepseek-ai repository exists. Its architecture uses replaceable
plugins, profiles, and durable typed session events; session history and UI views
derive from recorded events. The useful idea for Foundry is a small consistent
run/event record that can feed status screens and recovery. We can adopt that
separation without bringing in a second model loop or its whole plugin system.
[Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md),
[Session subsystem](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/session.md).

Its own safety document calls it an experimental, unaudited developer preview.
Treat it as a design reference in this plan.
[Project status](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md).

### Software-agent research

SWE-agent studies how the interface for repository navigation, editing, and
execution affects agent outcomes. Our takeaway is to keep commands and errors
small, predictable, and useful for recovery; a large command catalog is not itself
an improvement. This 2024 paper is an older foundation, included for its
directly relevant mechanism.
[Paper](https://arxiv.org/abs/2405.15793).

SWE-EVO (December 2025) evaluates longer software-evolution tasks spanning many
files and requirements. Its reported difficulty supports evaluating complete
journeys and regressions rather than extrapolating from isolated bug fixes.
Use independently checkable increments and retain the acceptance-to-evidence
mapping throughout integration.
[Paper](https://arxiv.org/abs/2512.18470).

SWE-Bench Pro (September 2025) adds harder, longer professional tasks and held-out
evaluation settings. Our adaptation is a small set of private product regression
cases, with expected results kept separate from instructions being improved.
Do not tune the skill against the answer and call that generalization.
[Paper](https://arxiv.org/abs/2509.16941).

## Skills.sh and upstream skills

Use skills.sh for discovery, then inspect the actual upstream instructions,
scripts, dependencies, license, and overlap. Installation totals and directory
audit badges do not prove fit or end-to-end quality.
[Testing directory](https://www.skills.sh/topic/testing),
[Skills documentation](https://www.skills.sh/docs).

| Candidate | Decision | Concrete use in Foundry |
|---|---|---|
| GitHub Spec Kit | Adapt its process into our existing skills | Clarify consequential unknowns, check requirement quality, compare spec/plan/implementation, then converge on accepted behavior. Avoid a second lifecycle/state directory. |
| Playwright Agent Skills | Adapt useful testing practices | Observable readiness, accessible locators, isolation, trace-based diagnosis, and CI-like reruns for flaky behavior. |
| Superpowers verification / writing-skills | Adapt selected principles | Fresh completion evidence and realistic evaluation scenarios. Foundry already has receipts and lifecycle commands. |
| Trail of Bits review skills | Evaluate selectively for security work | Risk-based diff analysis, affected callers, and explicit unassessed areas. Review component terms before copying anything. |
| Sentry issue debugging | Adapt when a product uses Sentry | Treat event content as untrusted data, cross-check the checked-out revision, and use synthetic regression data. |
| Vercel Web Interface Guidelines | Candidate for a later optional UI review pack | Keyboard, focus, forms, semantics, responsive behavior, and motion checks alongside the product's design brief. |

Primary sources:
[Spec Kit quickstart](https://github.com/github/spec-kit/blob/main/docs/quickstart.md),
[Playwright skills](https://github.com/hzijad/playwright-agent-skills),
[Superpowers verification](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md),
[Superpowers skill evaluation](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md),
[Trail of Bits](https://github.com/trailofbits/skills),
[Sentry debugging](https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-fix-issues/SKILL.md),
[Vercel UI rules](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).

The reviewed skills.sh entries included
[verification-before-completion](https://www.skills.sh/obra/superpowers/verification-before-completion)
and [Sentry issue debugging](https://www.skills.sh/getsentry/sentry-agent-skills/sentry-fix-issues).
Some directory entries use old repository names or third-party wrappers; follow
the upstream source before adoption. Spec Kit is assessed from GitHub's own repo,
not a third-party wrapper claiming to be official.

No external skill package is installed by this update. Existing skills receive
independently written corrections; their existing notices remain intact. Future
imports should record repository, revision, license, dependencies, and local
changes, and pass an applicable evaluation before activation. Updates should
review a diff and preserve product customizations.

### Immediate browser-testing corrections

The bundled guidance contained mandatory network-idle waits, broad prohibitions
on test levels/mocks, and a path allowing source inspection to count as a verified
browser fix. Those are corrected in the existing testing skills. Use actual
application readiness and assertions, test important own-application flows with
real components, and isolate third-party dependencies only when the test requires
it. Playwright's own docs discourage network-idle as a testing readiness signal.
[Page API](https://playwright.dev/docs/api/class-page#page-wait-for-load-state),
[Best practices](https://playwright.dev/docs/best-practices),
[Assertions](https://playwright.dev/docs/test-assertions),
[Trace viewer](https://playwright.dev/docs/trace-viewer).

## Proposed implementation sequence

The following are proposed milestones, not claims of completed infrastructure.

### 1. Prove the development loop

Create a small repeatable evaluation suite around four requests:

- Start a minimal product from an idea and scoped requirements.
- Add a feature to an existing application without changing its stack.
- Reproduce and fix a bug with an independently meaningful regression check.
- Prepare a release, then release only under actual authorization and verify it.

Include negative cases: no required checks, passing commands that miss a
requirement, unavailable integration, user interruption, conflicting update, and
a planning-only request. Check both the resulting application and the agent's
scope handling. Keep the expected outcomes outside the tested skill.

Record pass/fail/unverified criteria, rework, elapsed time, failed checks, and
human decisions needed. Add model/runtime versions and token/cost information
only when the execution interface supplies reliable values. Never invent usage.
A live native Codex run must prove role loading and coordination; instruction
reviews and Python unit tests alone do not prove that integration.

Exit condition: representative journeys succeed on repeat runs, negative cases
remain honest, and reruns/resume do not corrupt state or broaden authority.

### 2. Make progress and evidence accessible

Extend existing state/receipts only where evaluations show missing information.
Possible additions are a stage label, blocker, acceptance-evidence references,
and compact append-only lifecycle events. Distinguish run truth from the agent's
narrative. Preserve fingerprints, interruption, and conflict protection.

Add a thin optional SDK runner only when work must run outside an interactive
Codex session. Define cancellation, resume, bounded retries, environment access,
and model inheritance before using it across products. Reuse Codex thread state
instead of duplicating full conversations in Foundry.

Exit condition: another session can explain the current stage, changed files,
last verified revision, blockers, and next action from saved evidence.

### 3. Add tested capability packs

Choose from actual product demand: authentication/permissions, billing and
entitlements, background jobs, email, files, search, AI/retrieval, analytics,
and release/observability. Each pack should state compatible stacks, required
services, integration steps, tests, and recovery behavior. Existing libraries
are starting material; a guide alone is not a working integration.

An AI feature pack should include representative input/output evaluations,
retrieval checks where needed, and failure/latency/cost handling. Use native
provider SDKs and current docs. Application dependencies stay with products.

Exit condition: one real product demonstrates the pack's happy and relevant
failure paths, and an update preserves local product changes.

### 4. Build a small product dashboard

Start with a local read-only portfolio: product, current stage, blocker,
last checks, revision, and framework version. Read the existing run evidence.
Then add a product detail view with specification, task/agent activity, diff,
check logs, and preview. Add a library view only when managing packs becomes work.

Use the Codex SDK for jobs and App Server for a rich conversational client if
needed. Keep approvals, interruption, and model selection native. A UI must
display stale, failed, or unverified evidence honestly. Do not automatically
translate a chat completion event into a product release.

Exit condition: the dashboard reduces an observed coordination problem across
several products. Hosting, multiple users, and remote execution need their own
scope and access design.

### 5. Improve from demonstrated failures

A failed journey may propose a focused skill/rule change. Require a reproducing
case, review of the change, rerun of relevant journeys, and a reversible version.
Keep durable product decisions in their owning documents. Avoid silently rewriting
owner instructions, broadening tool permissions, or collecting unrelated private
product information in a shared memory store.

Exit condition: the change prevents its target failure without regressing the
existing evaluation set.

## Useful hooks to consider

Existing hooks already restore context, checkpoint state, and provide narrow
path/Git protection. Add a hook only for an observed gap:

- A compact subagent handoff record when coordination evidence is missing.
- A structured record of a scope-policy decision when debugging guardrails.
- A lightweight readiness diagnostic that names a missing tool or required check.

Full tests stay in explicit verification or CI; running the whole suite after
every edit wastes time. Native sandbox/approvals remain authoritative, and hooks
must honor interruption. Do not force continuation or silently publish.
[Codex hooks](https://learn.chatgpt.com/docs/hooks).

## Language and packaging

Keep Python for the existing filesystem/process/state runtime. It already uses
the standard library, and the official Codex Python SDK gives us a supported
future integration path. Use TypeScript for a browser UI if one is needed.
A Rust or Go rewrite should require a measured distribution/platform/performance
need. No language change makes weak requirements or weak checks reliable.

The next decisive investment is the live journey evaluation suite. That evidence
should determine which runtime components, packs, and hooks we implement next.
