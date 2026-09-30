# Documentation coverage

Read in the authenticated Chrome session through computer use. These are all 19 distinct content pages linked by the observed Code Kit navigation. The `/protected/codekit-docs` overview route redirected to Install and is not counted as an extra page. No hidden/private server implementation is inferred from the visible documentation.

The table records the entire section scope, the corresponding local implementation and the conclusions that matter for adaptation. It is a summary, not a reproduction of the vendor documentation.

## [Install](https://www.buildthisnow.com/protected/codekit-docs/getting-started/install)

**Reviewed:** full rendered section text (5,806 characters in the browser extraction).

**Covers:** Installation choices, license login, copy/plugin layouts, seeded state and next steps.

**Local comparison:** Install state confirms copy mode 0.3.0. Every payload file matches the supplied manifest. Screenshot shows installation, not app creation. The CLI source exists separately in npm cache.

**Where it lives:** `.claude/state/install.json`; cached `lib/init.js`, `lib/payload.js`, `lib/plugin.js`, `lib/settings.js`.

## [Codex and other harnesses](https://www.buildthisnow.com/protected/codekit-docs/getting-started/codex)

**Reviewed:** full rendered section text (3,468 characters in the browser extraction).

**Covers:** Native AGENTS, generated Codex command skills/agents, copy-mode hook prerequisite, and smaller-harness limitations.

**Local comparison:** All 34 commands, 60 shared skills and 28 agent configurations exist. Hook registration does not establish semantic parity. Actual edit payloads, resumption and tool vocabulary still need adaptation.

**Where it lives:** `AGENTS.md`; `.agents/PORTING.md`; `.agents/skills/codekit-*`; `.codex/*`.

## [Updates](https://www.buildthisnow.com/protected/codekit-docs/getting-started/updates)

**Reviewed:** full rendered section text (3,371 characters in the browser extraction).

**Covers:** Updating installed framework material while preserving user changes and runtime state.

**Local comparison:** CLI classifies baseline/new/local hashes, protects selected state paths, and flags removed upstream files. The local project is a fresh unchanged baseline. Do not run vendor updates over our derivative; carry forward reviewed changes.

**Where it lives:** cached `lib/update.js`, `lib/diff.js`, `lib/manifest.js`, `lib/constants.js`.

## [Your first project](https://www.buildthisnow.com/protected/codekit-docs/getting-started/first-project)

**Reviewed:** full rendered section text (2,702 characters in the browser extraction).

**Covers:** Intent-first intake and routing new/existing, simple/complex work into the appropriate planning path.

**Local comparison:** The recipe is present; no intake marker/project state exists here. The installer promises later CLAUDE.md composition, but its template inputs are not copied into the customer project.

**Where it lives:** `.claude/commands/start.md`; generated `codekit-start`; cached `lib/templates/claude/*`.

## [How orchestration works](https://www.buildthisnow.com/protected/codekit-docs/getting-started/orchestration)

**Reviewed:** full rendered section text (4,200 characters in the browser extraction).

**Covers:** Sizing, planning, bounded agents, independent evaluation, evidence and completion.

**Local comparison:** The primary playbook is emitted by orchestrator-init.sh. It uses Claude-oriented vocabulary and hook-driven state. Codex roles exist, but a native coordinator contract and working evidence gates are still required.

**Where it lives:** `.claude/hooks/orchestrator-init.sh`; `.claude/agents/*`; `.claude/philosophy/*`; `.claude/hooks/verdict-gate.py`.

## [Full MVP flow](https://www.buildthisnow.com/protected/codekit-docs/getting-started/mvp-flow)

**Reviewed:** full rendered section text (5,770 characters in the browser extraction).

**Covers:** Discovery, project documentation, setup, roadmap/spec planning, foundation workflows, sequential feature builds and review.

**Local comparison:** All main recipes and six foundation workflows exist. MVP resume selection needs explicit treatment of in-progress items. Shipped built-feature docs are references, not evidence that this project completed its foundation.

**Where it lives:** commands `discover`, `setup`, `mvp-spec`, `mvp-build`; `.claude/workflows/*`; `docs/built/*`.

## [How skeletons work](https://www.buildthisnow.com/protected/codekit-docs/getting-started/skeletons)

**Reviewed:** full rendered section text (2,622 characters in the browser extraction).

**Covers:** Optional starter app delivery, repository/commit pin, collision checks and post-copy setup.

**Local comparison:** No app skeleton is installed. The recipe reads a constants file absent from the project; the matching cached CLI supplies the pin. The remote pin resolves, but its separate license restricts the proposed reuse.

**Where it lives:** command `skeleton`; cached `lib/constants.js`; pinned remote skeleton.

## [Web](https://www.buildthisnow.com/protected/codekit-docs/web)

**Reviewed:** full rendered section text (1,560 characters in the browser extraction).

**Covers:** Scope of the web track and navigation through the SaaS foundation, build, checks and delivery.

**Local comparison:** The framework focuses on an opinionated Next.js/React/Supabase/oRPC/Tailwind stack. Those choices can form a profile; they should not become mandatory for every future product.

**Where it lives:** `AGENTS.md`; `docs/INDEX.md`; workflow and stack reference directories.

## [The Web Skeleton](https://www.buildthisnow.com/protected/codekit-docs/web/skeleton)

**Reviewed:** full rendered section text (2,917 characters in the browser extraction).

**Covers:** Application structure, included authentication, onboarding, billing, UI and supporting infrastructure.

**Local comparison:** The remote repository contains the application code described, with 440 files at the exact pin. Only its tree and four key files were reviewed remotely; no installation, feature test or complete code audit was performed.

**Where it lives:** remote `webapp/`, `supabase/`, `webapp/package.json`, README and skeleton manifest.

## [Build workflow](https://www.buildthisnow.com/protected/codekit-docs/web/build-workflow)

**Reviewed:** full rendered section text (11,014 characters in the browser extraction).

**Covers:** Feature intake/specification, reference manifests, planning, backend/frontend work, evaluations, testing and completion.

**Local comparison:** The individual role definitions, prompts, workflows and hooks are present. Structured receipts are useful, but parser success is not proof that commands ran or that an interaction is correct.

**Where it lives:** commands `spec`, `enhance`; agent definitions; `PROMPT.md`; `.claude/hooks/*`.

## [Quality gates](https://www.buildthisnow.com/protected/codekit-docs/web/quality)

**Reviewed:** full rendered section text (3,314 characters in the browser extraction).

**Covers:** Types, lint, pattern checks, tests/build, independent review and evidence requirements.

**Local comparison:** Actual verify.sh can PASS with no app and SKIP unavailable checks. Pre-commit, changed-file verification and CI have different scopes; CI build is opt-in. Native completion must distinguish these outcomes.

**Where it lives:** `scripts/verify.sh`; `scripts/lint-patterns.sh`; `.githooks/pre-commit`; `.github/workflows/verify.yml`; evaluator hooks.

## [Shipping](https://www.buildthisnow.com/protected/codekit-docs/web/shipping)

**Reviewed:** full rendered section text (4,037 characters in the browser extraction).

**Covers:** Deployment prerequisites, secrets/service handoff, Vercel deployment and post-deploy checks.

**Local comparison:** Deployment recipe and verification references exist. No hosting project/account was connected. Vercel is the supported recipe path; a Docker/VPS reference does not prove a finished deployment product.

**Where it lives:** command `deploy`; skills `develop-and-deploy`, `deploy-verify`; stack setup references.

## [Specialist commands](https://www.buildthisnow.com/protected/codekit-docs/web/specialists)

**Reviewed:** full rendered section text (7,632 characters in the browser extraction).

**Covers:** Optional design, payments, analytics, monitoring/healing, content, SEO, email, security and maintenance workflows.

**Local comparison:** Entries map to local command recipes and skills. Several require third-party tools, service credentials or consequential actions. Their presence does not authorize scheduling, mailing, publishing, attacking systems or spending.

**Where it lives:** all corresponding command and skill entry points; `.agents/scripts/codex-monitor-run.sh`; `scripts/send-report-email.sh`.

## [Mobile · Coming soon](https://www.buildthisnow.com/protected/codekit-docs/mobile)

**Reviewed:** full rendered section text (1,249 characters in the browser extraction).

**Covers:** Future mobile direction and current availability boundary.

**Local comparison:** Not a delivered end-to-end mobile framework. A cached mobile instruction template does not establish a mobile skeleton, toolchain or verified build workflow.

**Where it lives:** cached `lib/templates/claude/mobile.md`; no installed mobile app.

## [Command browser](https://www.buildthisnow.com/protected/codekit-docs/command-browser)

**Reviewed:** full rendered section text (6,480 characters in the browser extraction).

**Covers:** Catalog of the 34 command entry points and intended use.

**Local comparison:** All 34 local command files and all 34 generated Codex command skills were enumerated and paired. Full mapping is preserved in COMPONENTS.md and component-map.json.

**Where it lives:** `.claude/commands/*.md`; `.agents/skills/codekit-*/SKILL.md`.

## [Skills catalog](https://www.buildthisnow.com/protected/codekit-docs/skills-catalog)

**Reviewed:** full rendered section text (18,276 characters in the browser extraction).

**Covers:** Catalog of 60 shared skills grouped by purpose, including development, design, research, payments, marketing and operations.

**Local comparison:** All 60 local skill entry points and mirrors exist; 7 additional Codex-only skills also ship. Numerous references are duplicated across harnesses. Catalog claims are declarations, not validated learning/product outcomes.

**Where it lives:** `.claude/skills/*`; `.agents/skills/*`; `skills-lock.json`.

## [Custom skills](https://www.buildthisnow.com/protected/codekit-docs/advanced/custom-skills)

**Reviewed:** full rendered section text (2,914 characters in the browser extraction).

**Covers:** Skill structure, descriptions/triggers, references, bounded loading and adding custom knowledge.

**Local comparison:** Use the existing skill format and discovery mechanism. For our derivative, Codex should own the canonical active entry points; do not add custom DSLs or duplicate the same knowledge across manually edited harness trees.

**Where it lives:** skills `create-skill`, `find-skills`, `trace-to-skill`; `skill-activate.js` and alias JSON.

## [The hook pipeline](https://www.buildthisnow.com/protected/codekit-docs/advanced/hook-pipeline)

**Reviewed:** full rendered section text (9,256 characters in the browser extraction).

**Covers:** Session/prompt/subagent/tool/compaction/stop behavior, context injection, state tracking and guardrails.

**Local comparison:** Local Codex JSON has 14 registrations across 8 events. The two edit parsers do not understand native patch inputs as written; other event paths need live validation. Stop hooks and regex guards are not substitutes for sandbox permissions or real tests.

**Where it lives:** `.claude/hooks/*`; `.claude/settings.json`; `.codex/hooks.json`.

## [Agent architecture](https://www.buildthisnow.com/protected/codekit-docs/advanced/agent-architecture)

**Reviewed:** full rendered section text (4,884 characters in the browser extraction).

**Covers:** Specialist role boundaries, skill/philosophy context, references and coordination.

**Local comparison:** 28 role pairs exist. Context injection uses budgets and name matchers, so generated roles alone do not guarantee every intended document is loaded. Parallel state is keyed by role rather than unique run ID.

**Where it lives:** `.claude/agents/*`; `.codex/agents/*`; `subagent-prime.sh`; `progress-track.sh`; cached `scripts/agent.sh`.

## Local documentation and coverage boundary

- All 1,337 non-Git, non-Finder files are in inventory.tsv and inventory.json, including hidden .claude, .agents, .codex, .githooks and .github directories.
- docs/ contains 134 inventoried files: stack references, patterns, built-feature reference descriptions, tool documentation, conceptual overviews and licensing. The deep vendor/reference material was indexed; no claim of a full line-by-line semantic audit is made.
- Claude-to-Codex mirrors were counted once when reasoning about capabilities; duplicates remain individually recorded in the inventory.
- The 31 cached CLI files were inventoried separately. The remote skeleton has a complete 440-file path listing but received selected-file review only.
- 120 local JSON/TOML/Python/JavaScript/shell syntax checks passed. No workflow, integration, agent build, monitoring schedule, deployment or live application test was executed.
- Syntax checks and source inspection do not establish runtime compatibility, application correctness, security clearance, ownership of third-party content or owner approval.
