<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: sentry
description: Analyze production errors from Sentry. Deep triage, root cause analysis, fix recommendations. Reports saved to dev/reports/sentry/. Loopable via /monitor.
---

# Sentry Error Analysis

Fetch and analyze production errors from Sentry. Produces a deep report with categorized issues, root cause analysis, and actionable fix recommendations.

Arguments: `$ARGUMENTS`
- No args = full analysis (last 24h or since last report)
- `--days N` = look back N days
- `--critical-only` = only critical and high severity issues

---

## Phase 1: Check Previous Reports

Look for the most recent report in `dev/reports/sentry/`:

```bash
ls -t dev/reports/sentry/*.md 2>/dev/null | head -1
```

If found, pass it to the analyst for comparison (new vs recurring vs resolved).

## Phase 2: Gather Context

Read `docs/INDEX.md` to get the list of built features. This helps the analyst map errors to features.

## Phase 3: Spawn Sentry Analyst

Spawn the `sentry-analyst` agent with:

```
You are the sentry-analyst agent (.foundry/agents/sentry-analyst.md).

PROJECT: Use the `sentry` CLI to query the project's issues.
TIME WINDOW: {24h or --days N or since last report date}
PREVIOUS REPORT: {path or "none"}
BUILT FEATURES: {list from docs/INDEX.md}

Write your report to: dev/reports/sentry/{YYYY-MM-DD}-sentry.md
```

## Phase 4: Present Results

After the analyst completes, read the report summary and present to user:

> **Sentry Report — {date}**
>
> | Metric | Value |
> |--------|-------|
> | Unresolved issues | {N} |
> | Critical/High | {N} |
> | New since last report | {N} |
> | Users affected (24h) | {N} |
>
> **Top issues requiring attention:**
> 1. [{ID}] {title} — {severity} — {events} events — {fix complexity}
> 2. ...
>
> Full report: `dev/reports/sentry/{date}-sentry.md`
>
> Run `/fix-issue` to interactively fix issues from this report.

## Phase 5: Critical Alert

If any critical issues found, warn prominently:

> **CRITICAL ISSUES DETECTED** — {N} critical issues affecting {N} users.
> Recommend running `/fix-issue` immediately.
