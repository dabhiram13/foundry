# Automation Pack Template

> Standard automation set for each cloned Build Kit product repo.

## Rule

Install the same pack in every product repo. Change project-specific inputs, not the workflow shape.

## Automation 1: Hourly Delivery Loop

**Schedule:** Every hour
**Purpose:** Pull the next actionable Linear issue into a worktree and move it to draft PR.

### Prompt Template

Review the current Linear issues for this repo's product and pick the single best unblocked issue to advance. Work only on issues that are clearly scoped, autonomous-safe, and likely to fit within one run. Create an isolated worktree and branch, implement the smallest complete slice, run the required quality gates, and open or update a draft PR with a concise summary, verification results, and remaining risks. Skip issues that are ambiguous, oversized, blocked, or require product decisions. Do not merge. Do not start more than one new issue in a single run. If there are already three open autonomous PRs or branches, prefer advancing one of them instead of starting new work.

## Automation 2: Daily Monitor

**Schedule:** Daily
**Purpose:** Check health, drift, and build quality across the repo.

### Prompt Template

Review the current state of the repo and identify the highest-signal maintenance risks. Check recent unresolved work, stale branches or PRs, repeated failures, pattern drift, and anything that is degrading reliability. Summarize what needs attention first and why. Do not change production code unless the task is clearly safe and bounded.

## Automation 3: Daily Error Triage

**Schedule:** Daily
**Purpose:** Summarize Sentry or runtime issues into actionable work.

### Prompt Template

Review recent production or preview errors for this product, group them by root cause, and identify which ones should become Linear issues. Focus on recurring, user-facing, or revenue-affecting failures. Provide clear next actions and mark anything that can be safely auto-remediated later.

## Automation 4: Weekly Security And Quality Sweep

**Schedule:** Weekly
**Purpose:** Catch problems that should not wait for feature work.

### Prompt Template

Run a focused review for security, dependency risk, major quality regressions, and architecture drift. Prioritize concrete findings with clear remediation paths. Create or recommend bounded follow-up work rather than broad rewrites.

## Portfolio Rules

If you operate many products:

- Keep one automation pack per repo
- Keep schedules consistent across repos
- Keep prompts standardized
- Let Linear project state control what each automation does

## Backlog Rules

For autonomous execution, only issues with all of the following should be eligible:

- Clear acceptance criteria
- No unresolved product decisions
- No missing credentials or environment setup
- No dependency on another unfinished issue

## Operating Limits

- One new implementation issue per hourly run
- Three open autonomous PRs max
- Human merge required
- Human decision required for blocked or ambiguous work

This is the simplest durable model: one reusable pack, one repo at a time, one bounded issue per run.
