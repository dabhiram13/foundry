---
name: debugger-detective
description: >
  Source-agnostic bug investigation. Use for "debug this", "find the root cause", "why is X broken",
  "trace this bug", "investigate this error", "bisect this regression", or whenever a bug is reported
  without a clear fix path. Captures evidence, ranks hypotheses, reproduces, isolates, proposes the
  minimal fix, and leaves a postmortem artifact. Complements `sentry` (prod errors), `fix-test`
  (failing tests), and `browser-debugging` (UI repros) — this is the general methodology.
---

# Debugger Detective

General-purpose bug investigator. Not bound to Sentry, tests, or the browser — those are *sources*, this is the *method*.

## When to Use

- A bug is reported but you do not know the cause yet
- A Sentry issue or failing test needs depth before a fix
- Intermittent or hard-to-reproduce failures
- Regressions ("worked last week, broken today")
- Build / type / runtime errors that do not have an obvious one-line fix
- Cross-layer bugs (client → API → DB) where blame is unclear

## Core Rules

1. **No fix without a root cause.** Symptoms-first patches create whack-a-mole.
2. **Reproduce before investigating.** If you cannot trigger it, the first job is finding the trigger.
3. **Observation before interpretation.** State what was observed before why it happened.
4. **One hypothesis at a time.** Do not stack three fixes in one attempt.
5. **Minimal diff.** A bug fix is not a refactor. Do not rename, restructure, or optimize while fixing.
6. **Cite file:line.** Every claim about the code points at a specific location.
7. **3-failure circuit breaker.** After three rejected hypotheses, stop and re-scope — the bug is probably not where you are looking.

## Four-Phase Loop

### Phase 1 — Capture

Record the failure before touching anything. Fill in as much as the current evidence allows — blanks are fine, they become the next probes.

```markdown
## Capture
- Symptom:
- Source: (sentry issue | failing test | user report | browser console | build log | …)
- First seen: (commit / date / deploy)
- Trigger: (steps to reproduce, or "unknown — see Phase 2")
- Deterministic | intermittent | one-off:
- Environment: (local | preview | prod, cwd, branch, relevant services)
- Evidence on hand: (stack trace, request/response, screenshots, logs)
```

### Phase 2 — Investigate

Start with a quick **environment gate** — 20 seconds to rule out "it's not the code":

| Gate | Check |
|---|---|
| Right cwd / branch? | `pwd`, `git status -sb` |
| Services up? | Supabase, Inngest, dev server, local DB |
| Version / deps clean? | `node --version`, `npm ls <pkg>`, lockfile drift |
| Env vars present? | `.env.local`, `.env` — compare to `.env.example` |
| Permissions / tokens? | Expired JWT, missing RLS policy, wrong service role |
| Disk / quota? | Full disk, 429s, connection limits |

If any gate fails, the environment is the bug. Document and stop.

Otherwise, generate **2–3 competing hypotheses** from different frames:

- Code-path (logic error in the flow you expected)
- State / data (bad row, stale cache, missing migration)
- Config / environment (wrong env var, feature flag, build flag)
- Concurrency / timing (race, retry, event ordering)
- Boundary (RLS, auth, oRPC schema, middleware)

For each hypothesis, collect evidence **for and against** with concrete file:line refs. Rank by evidence strength (strongest to weakest):

1. Controlled reproduction that uniquely discriminates
2. Primary artifact (timestamped log, trace, metric, git history) directly bearing on the claim
3. Multiple independent sources converging
4. Single-source inference that fits but is not yet discriminating
5. Weak circumstantial clues (naming, proximity, stack order)
6. Intuition / speculation

Down-rank any hypothesis that:
- Requires extra ad-hoc assumptions to hold
- Fails to make a distinctive prediction
- Survives only because no one looked for disconfirming evidence

**Before fixing, run one discriminating probe** — a check whose outcome tells you which hypothesis is right, not one that merely gathers more of the same support.

### Phase 3 — Fix

Only after root cause is confirmed:

- Propose **one minimal change**. Predict the test that proves it.
- Check for the same pattern elsewhere in the codebase (`grep` for the failing idiom).
- Keep the diff tight — no drive-by renames or "while I'm in here" cleanups.
- If the fix requires architectural change, stop and escalate; this skill does not redesign.

### Phase 4 — Report

Emit a postmortem artifact that `/heal` and `trace-to-skill` can consume. Save to `dev/reports/bugs/<short-slug>.md`:

```markdown
## Bug Report — <slug>

**Symptom:** <what the user saw>
**Root cause:** <the actual underlying issue at file:line>
**Why it happened:** <how the bug entered the codebase — commit, missing test, assumption>
**Reproduction:** <minimal steps>
**Fix:** <the minimal change, file:line>
**Verification:** <command/test whose pass proves the fix>
**Similar patterns:** <grep results — other places at risk>
**Prevention:** <lint rule, test, type, assertion, or policy that would have caught it>

## References
- `file.ts:42` — <where the bug manifests>
- `file.ts:108` — <where the root cause originates>
- Related: <sentry issue / PR / commit>
```

## Route to the Right Source

`debugger-detective` is the method. Call these skills for source-specific mechanics:

| Source | Skill |
|---|---|
| Production error from Sentry | `sentry` (triage) → come back here for root cause |
| Failing Playwright/E2E test | `fix-test` (if it's already captured in a flow) |
| UI bug needing browser repro | `browser-debugging` (reproduce) → come back here for analysis |
| Need to locate unfamiliar code | `codebase-navigation` |
| Need up-to-date library docs | `documentation-lookup` |
| Silent catches / swallowed errors hunt | adopt the pattern catalog in `feature-code-review` |
| Regression bisect across commits | `git log --oneline`, `git bisect` — see Bisect below |
| Performance regression | `browser-debugging` (see `references/chrome-devtools/`) + `/performance` |
| Log summarization | verdict line + ≤3 facts + artifact path |

## Bisect (Regression Isolation)

When "it worked before":

1. **Identify a known-good commit** (last green deploy, tag, CI pass).
2. **Identify a known-bad commit** (current HEAD, first Sentry occurrence).
3. `git bisect start && git bisect bad && git bisect good <sha>`
4. Write a **one-line repro script** that exits non-zero on the bug. Use `git bisect run <script>` for auto-mode. Manual for flaky bugs.
5. When bisect lands on a commit, read the diff. The bug is in those lines or in an interaction with them.

## Output Standard

Do not end with "I fixed it." Always include:

1. The failure pattern (which hypothesis class)
2. The root-cause hypothesis with evidence
3. The recovery action (the minimal diff)
4. The evidence that the fix worked (command/test output)
5. The postmortem artifact path

If blocked: end with the **current best hypothesis**, the **critical unknown**, and the **single next probe** that would collapse the most uncertainty. "Stuck" is acceptable; "not sure" without a next step is not.

## Failure Modes to Avoid

- **Symptom fixing** — adding null checks everywhere instead of asking "why is it null?"
- **Skipping reproduction** — investigating before you can trigger the bug
- **Stack-trace skimming** — reading only the top frame
- **Hypothesis stacking** — testing three fixes at once
- **Confirmation bias** — gathering only evidence that confirms your favorite theory
- **Flat evidence** — treating a hunch and a stack trace as equally strong
- **Refactor creep** — "while I'm in here, let me also…"
- **Fake convergence** — merging two hypotheses that sound alike but imply different root causes
- **Missing probe** — ending with "not sure" instead of a concrete next investigation step
- **Infinite variation** — retrying the same failed approach with slightly different wording

## Final Checklist

- Did I capture the observation before interpreting it?
- Did I run the environment gate?
- Did I preserve competing hypotheses until evidence collapsed them?
- Did I seek disconfirming evidence for my leading theory?
- Is the root cause identified (not just the symptom)?
- Is the fix minimal and cited at file:line?
- Did I check for the same pattern elsewhere?
- Did I write the postmortem artifact?
- If blocked, did I name the critical unknown and the next probe?
