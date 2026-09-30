---
name: codex-monitor
description: Codex-native monitoring and operating summary workflow. Uses Linear, GitHub, Vercel, Sentry, and reports to produce actionable summaries and create/update issues without mixing in code fixes.
version: 1.0.0
---

# Codex Monitor

Use this skill when:
- setting up recurring ops summaries
- triaging what changed across builds, deploys, PRs, and incidents
- creating or updating Linear issues from operational signals
- deciding whether a separate heal agent should be triggered

## Goal

Convert noise into a small operating queue:
- what broke
- what changed
- what was fixed
- what needs ownership now

## Inputs

Gather from as many of these as exist:
- latest Sentry incidents
- Vercel deployments, build logs, runtime logs
- GitHub PRs, CI failures, review friction
- Linear backlog/in-progress blockers
- local reports under `dev/reports/`

## Workflow

1. Read the current project context and recent reports.
2. Collect live signals from connected systems.
3. Group duplicates into one operating item.
4. Score severity by business impact, not just technical noise.
5. Create or update Linear issues for actionable work.
6. Produce a concise summary:
   - urgent now
   - important but not urgent
   - shipped/fixed since last check
   - blocked/waiting
7. Decide whether heal should be invoked.

## Trigger rules for heal

Start a separate fix flow only if:
- issue is critical/high
- fix scope is bounded
- verification path exists

Otherwise:
- write/update Linear
- keep it in the summary

## Linear policy

Use Linear for:
- production incidents that require ownership
- deploy failures with follow-up work
- repeated flaky behavior
- security/performance findings that are not instantly resolved

Do not create Linear issues for:
- pure duplicates
- resolved transient noise without follow-up value

## Summary format

Keep it short and ranked:
- Critical
- High
- Medium
- Fixed/cleared

Each item should include:
- source
- impact
- owner if known
- Linear link if created

## Separation of concerns

This skill reports and routes.
It does not implement fixes.
