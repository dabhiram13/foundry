---
name: git-workflow
description: >
  Run safe day-to-day git workflows: inspect status, review diffs, create atomic commits,
  prepare clean pull requests, and avoid destructive history mistakes. Use for "commit this",
  "help with git", "prepare a PR", "what changed", "clean up my branch", or when working
  in a repo with active changes.
---

# Git Workflow

Use this skill to keep git operations safe, reviewable, and easy to understand.

## When to Use

- The user wants a commit or PR
- The worktree is dirty and you need to understand what changed
- You need to split work into atomic commits
- You need to summarize a branch before review
- You need to avoid dangerous git history edits

## Core Rules

- Prefer read-first commands before any commit action
- Never rewrite history unless the user explicitly asks
- Never use destructive commands by default
- Group commits by real feature or fix boundary, not by file count
- Summarize the meaningful change before committing

## Standard Flow

1. Inspect the repo state:

```bash
git status --short
git diff --stat
git diff -- <path>
```

2. Separate your changes from unrelated ones:
- identify files touched for the current task
- do not revert unrelated work
- if the same file has mixed concerns, split carefully or ask

3. Stage intentionally:

```bash
git add <file1> <file2>
git diff --cached
```

4. Write an atomic commit:
- one feature, fix, or refactor per commit
- use a direct message that says what changed
- if the repo uses conventions, follow them

Example:

```bash
git commit -m "feat: add repo-scan start routing"
```

5. For PR prep, summarize:
- what changed
- main files
- tests run
- notable risks

## PR Review Prep

Before opening or reviewing a PR:

```bash
git diff --stat origin/main...
git log --oneline --decorate --max-count=10
```

Use that to produce:
- a short change summary
- a risk list
- exact files worth reviewer attention

## Safe Defaults

Prefer:

```bash
git status --short
git diff --stat
git diff --cached
git log --oneline --decorate --max-count=15
```

Avoid by default:

```bash
git reset --hard
git checkout --
git push --force
git rebase -i
```

## Commit Quality Checklist

- [ ] only task-relevant files are staged
- [ ] diff matches one coherent change
- [ ] commit message reflects the actual change
- [ ] no accidental debug artifacts
- [ ] tests or verification are noted

## Related

- `feature-code-review` — review the code before or after commit
- `session-management` — recover prior intent before preparing a commit
