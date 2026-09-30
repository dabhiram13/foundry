---
name: codex-security-review
description: Codex-native security review workflow for recent changes. Focuses on realistic application risk, business-logic failures, auth/data exposure, and actionable follow-up into monitor/heal.
version: 1.0.0
---

# Codex Security Review

Use this skill when:
- auditing recent code changes
- reviewing for auth, data exposure, business-logic abuse, and app-layer risk
- feeding findings into monitor and heal

## Goal

Produce high-signal findings with low false-positive noise.

## Review priorities

1. Auth bypass and privilege mistakes
2. Data exposure and IDOR-style access issues
3. Broken multi-tenant boundaries
4. Unsafe input handling and injection surfaces
5. Secrets/config mistakes
6. Security regressions introduced by recent features

## Method

1. Review recent relevant changes.
2. Read the implementation, not just the diff headline.
3. Check business logic abuse paths, not only syntax-level issues.
4. Confirm exploitability where possible using available runtime/data sources.
5. Write findings by severity with exact affected area.

## Severity guidance

Critical:
- direct unauthorized access to sensitive data
- privilege escalation
- production secret exposure

High:
- realistic auth or workflow bypass
- missing tenant isolation
- unsafe sensitive mutation path

Medium:
- defense-in-depth gap
- missing headers or weaker validation without clear exploit path

## Output contract

Each finding should state:
- what is wrong
- why it matters in business terms
- where it lives
- what kind of fix is appropriate
- whether heal should attempt it automatically

## Integration

- Feed actionable findings into Linear through monitor
- Only hand off to heal when the scope is bounded and verifiable
