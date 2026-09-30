---
name: codex-heal
description: Codex-native remediation workflow. Fixes bounded critical/high issues on isolated branches or worktrees, runs verification gates, and reports confidence without merging automatically.
version: 1.0.0
---

# Codex Heal

Use this skill when:
- monitor has identified a bounded critical/high issue
- you want an isolated remediation branch or worktree
- you need a separate fixing agent from the reporting agent

## Goal

Take a prioritized issue queue and convert it into a verified branch, not a silent background mutation.

## Non-negotiable rules

1. Never modify `main` directly.
2. Prefer a dedicated branch or worktree per heal run.
3. Keep fixes surgical.
4. Run quality gates and relevant tests.
5. Do not auto-merge.
6. If the issue is not bounded, stop and write back to Linear instead.

## Input requirements

Each issue passed into heal should include:
- title
- severity
- source system
- problem statement
- relevant file/service area
- suggested owner or fix lane

## Workflow

1. Confirm working tree state is safe.
2. Create a remediation branch or worktree.
3. Group issues by technical lane:
   - backend
   - frontend
   - infra/deploy
   - security
4. Fix one group at a time.
5. Run gates:
   - typecheck
   - lint
   - build
   - targeted tests
6. Re-check the original failure signal where possible.
7. Summarize:
   - fixed
   - not fixed
   - unverified
   - residual risk

## Confidence model

High confidence:
- original problem reproduced or clearly understood
- change set is narrow
- gates passed
- signal cleared or likely cleared

Low confidence:
- issue not reproducible
- broad changes required
- incomplete verification
- additional failures introduced

## Output contract

Every heal run should end with:
- branch/worktree name
- what changed
- gates run
- confidence
- recommended next human action
