<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: start
description: One-time intent-first intake. Understand what the user wants, choose the best path, reflect it back, and ask for a simple yes/no before proceeding.
---

# Start

This is the default first command for the product.
It is for initial intake, or for an explicit reroute when the user asks to reframe the project.

Do not make the user choose between `/discover`, `/spec`, `/mvp-spec`, or `/mvp-build` before the kit has understood what they want.
Do not keep sending the user back through `/start` after intake is complete.
**Do not write any artifact files to disk before the user confirms the path in Step 4.** Classification and drafting happen in memory; persistence happens in Step 5.

Your job is simple:
1. understand the request
2. classify it
3. propose one path
4. ask for yes/no
5. proceed — and only now write the artifacts

Arguments: `$ARGUMENTS`
- No args = ask what the user wants done
- `--resume` = resume from `dev/active/start/`

---

## Start Lifecycle

`/start` is not the permanent hub for every later task.

Use it when:
- the project has not been started yet
- the user explicitly wants to restart intake
- the product direction has materially changed

Do not use it when:
- the user is asking for the next feature after intake is already complete
- the user wants a focused fix, spec, or build inside an already-started project
- the only thing missing is execution

When `/start` completes (Step 5), write a durable started-state file:
- `.foundry/state/project-started.json`

That state means future work should continue through the narrowest downstream command, not re-enter `/start` automatically.

---

## Core Rule

Use buyer language:
- "new project"
- "existing project"
- "small fix"
- "simple build"
- "complex work"
- "starter plan"
- "repo scan"
- "best next move"

Avoid internal system nouns unless absolutely needed:
- "stack-detect"
- "skill-scout"
- "scan/tailor/restore"
- "archive/prune"
- "orchestration state"
- "detached orchestrators"

Those are implementation details, not the product.

---

## Outputs (written AFTER Step 4 yes)

These files are persisted in Step 5, not before:

- `dev/active/start/intent.md`
- `dev/active/start/session-summary.md`
- `.foundry/state/project-started.json`

And exactly one of:
- `dev/active/start/starter-plan.md` for new + simple
- `dev/active/start/stack-report.md` for existing + small
- `dev/active/start/repo-scan.md` for existing + complex
- `dev/active/start/discovery-brief.md` for new + complex

If the user says "no" at Step 4, nothing is written. Trust leak avoided.

---

## Step 1: Get The Intent (no file writes yet)

If `$ARGUMENTS` already contains the request, use it.

Otherwise ask one direct question:

> What do you want done?

If the user gives multiple things, prioritize the most immediate one.

Hold the intent in memory under this shape:

```markdown
# Intent (draft — not yet saved)

- Request:
- Context:
- Repo state signals:
- Open ambiguities:
```

Do not write `intent.md` yet.

---

## Step 2: Classify Quietly (still no file writes)

Classify on two axes:

### Axis A — Project State
- `existing project`
- `new project`

### Axis B — Work Shape
- `small fix`
- `simple build-now`
- `complex`

Infer from context. Do not ask the user to choose the mode unless the request is genuinely ambiguous.

Use these signals:

| Classification | Signals |
|---|---|
| `existing project` | app code already exists, user says "fix", "change", "add to this app", repo has manifests, app dirs, migrations |
| `new project` | idea-stage, no real app yet, user says "build me", "I want a product for..." |
| `small fix` | narrow bug, one flow, one screen, one endpoint, low coupling |
| `simple build-now` | new but small scope, quick dashboard, utility, single workflow, no deep product shaping needed |
| `complex` | multiple flows, architecture uncertainty, integrations, broad scope, repo coupling, many unknowns |

If the request is ambiguous after inspection, ask at most one clarifying question.

---

## Step 3: Draft The Path (still no file writes)

Draft the path-specific artifact in memory. Keep it ready to persist if the user says yes.

### Path 1 — Existing Project + Small Fix

Goal: solve it now.

Draft shape for `stack-report.md`:

```markdown
# Stack Report

## Request
- What the user wants:

## Relevant Area
- Likely files:
- Likely modules:
- Likely dependencies:

## Constraints
- Main risk:
- Main ambiguity:

## Best Next Move
- `/spec` for this focused change, then build immediately
```

### Path 2 — New Project + Simple Build-Now

Goal: do not over-discover. Build the thing.

Collect only the minimum needed:
1. what it does
2. who it is for
3. any reference app or category

Draft shape for `starter-plan.md`:

```markdown
# Starter Plan

## Product
- What:
- Who:
- Reference:

## Build Shape
- Core screens:
- Core data:
- Main risk:

## Best Next Move
- `/spec` the simple build and proceed immediately
```

### Path 3 — Existing Project + Complex

Goal: map enough to act, not enough to know everything.

Do not send this path into `/discover`.

Spawn 3 bounded scan sub-agents in parallel:
- `stack scanner`
- `scope scanner`
- `risk scanner`

Each one must:
- read only high-signal files
- stay narrow
- output short bullets with exact file references
- avoid architecture essays

Scanner contracts:

**Stack scanner**
- detect framework/runtime
- auth, data layer, billing, testing, deploy
- name only the systems relevant to this request

**Scope scanner**
- find likely files, modules, routes, and flows tied to the request
- identify where the change will probably land

**Risk scanner**
- coupling, migrations, auth/data risk, likely regression zones
- note blockers or missing context

Draft shape for `repo-scan.md`:

```markdown
# Repo Scan

## Request
- What the user wants:

## What We Found
- Stack:
- Relevant files:
- Relevant flows:

## Main Constraints
- Constraint 1:
- Constraint 2:
- Constraint 3:

## Open Questions
- Question 1:
- Question 2:
- Question 3:

## Best Next Move
- `/spec` this change, then build
```

After the scan, ask at most 3 short questions.

### Path 4 — New Project + Complex

Goal: this is real product work. Discover it properly.

Draft shape for `discovery-brief.md`:

```markdown
# Discovery Brief

## Product
- What:
- Who:
- Reference:
- Main unknowns:

## Why Discovery Is Needed
- Scope:
- Product risk:
- Research needs:

## Best Next Move
- `/discover`
```

This is the only path that should default to full discovery.

---

## Step 4: Reflect Back And Ask Yes/No (no file writes yet)

Always respond in this shape:

> I think you want: ...
>
> This looks like: `{classification}`
>
> Best next move: ...
>
> I will do: ...
>
> Proceed? Yes or no.

Do not expose multiple competing workflows. Propose one.

If the user says no:
- ask what is wrong with the framing
- adjust
- re-draft in memory
- propose one new path
- **still no file writes**

---

## Step 5: Proceed And Persist

Only after the user confirms yes:

1. Create `dev/active/start/` and `.foundry/state/` if missing.
2. Write `dev/active/start/intent.md` from the Step 1 draft.
3. Write the path-specific artifact from the Step 3 draft.
4. Write `dev/active/start/session-summary.md`.
5. Write `.foundry/state/project-started.json`:

```json
{
  "started": true,
  "classification": "",
  "best_next_move": "",
  "created_at": "",
  "last_confirmed_request": ""
}
```

Then route:

| Path | Next Move |
|---|---|
| existing project + small fix | run `/spec` for the focused change, then build |
| new project + simple build-now | run `/spec` and build the whole thing right away |
| existing project + complex | use the repo scan + answers to drive `/spec`, then build |
| new project + complex | run `/discover` |

Once the user confirms yes and the state file is written, intake is complete.
Future work should go through the recommended next command unless the user explicitly asks to re-run `/start`.

---

## Success Criteria

`/start` is successful when:
- the user explains the problem in plain language
- the system infers the right path
- one useful artifact appears quickly — but only after the user says yes
- the user sees one recommended next move
- the user only has to answer yes or no before execution starts
- the started-state is written so later sessions do not re-run intake by accident
- no artifact files are left behind if the user rejects the framing

If the system drifts into internal vocabulary or workflow sprawl before that, cut it.
