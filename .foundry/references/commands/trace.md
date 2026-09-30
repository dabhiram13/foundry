<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: trace
description: Render a build timeline from trace.jsonl — shows agent durations, phase transitions, quality gate results, retries, persistence blocks, and failures.
---

# Build Trace Viewer

Reads `dev/active/{feature}/trace.jsonl` and renders a visual timeline of the entire build process.

Arguments: `$ARGUMENTS`
- No args = auto-detect active feature from `.foundry/.build-active.json` or most recent `dev/active/*/`
- `{feature-slug}` = specific feature
- `--archive {feature}` = read from `dev/archive/{feature}/trace.jsonl`
- `--compare {feature1} {feature2}` = side-by-side comparison of two builds

---

## Step 1: Load Trace

```bash
# Determine trace file path
FEATURE="${ARGUMENTS:-$(jq -r '.feature' .foundry/.build-active.json 2>/dev/null)}"
TRACE_FILE="dev/active/${FEATURE}/trace.jsonl"
# Fallback to archive
[ -f "$TRACE_FILE" ] || TRACE_FILE="dev/archive/${FEATURE}/trace.jsonl"
```

If no trace file found: "No trace found. Traces are recorded automatically during builds."

Read every line of the trace file. Parse each JSON event.

---

## Step 2: Render Timeline

### Build Header

```
═══════════════════════════════════════════════════════
  BUILD TRACE: {feature}
  Started: {first event ts}  |  Duration: {total time}
  Phase: {current/final phase}  |  Iterations: {max iteration seen}
═══════════════════════════════════════════════════════
```

### Phase Timeline

For each `phase_change` event, show the phase with duration:

```
PHASES
──────
  planning   ████████░░░░░░░░░░░░░░░░░░░░░░  3m 22s
  building   ████████████████████░░░░░░░░░░░  12m 45s
  testing    ████████░░░░░░░░░░░░░░░░░░░░░░  4m 10s
  quality    ███░░░░░░░░░░░░░░░░░░░░░░░░░░░  1m 30s
  cleanup    ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0m 55s
  complete   █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0m 20s
```

### Agent Timeline

For each `agent_start` / `agent_stop` pair, show duration:

```
AGENTS
──────
  planner            ██████████░░░░░░  2m 30s  ✓
  architect          ████████░░░░░░░░  2m 30s  ✓
  critic             ██████████░░░░░░  3m 15s  ✓  → APPROVE
  db-architect       ███░░░░░░░░░░░░░  0m 55s  ✓
  backend            ████████████░░░░  5m 20s  ✓
  backend-evaluator  ██████░░░░░░░░░░  2m 10s  ✓  → PASS
  connector          ████████░░░░░░░░  3m 45s  ✓  ┐ parallel
  api-tester         ██████░░░░░░░░░░  2m 30s  ✓  ┘
  designer           ██████████░░░░░░  4m 15s  ✓
  design-evaluator   ████████░░░░░░░░  2m 55s  ✗  → FAIL (retry)
  designer (retry)   ████████░░░░░░░░  3m 10s  ✓
  flow-tester        ██████░░░░░░░░░░  2m 20s  ✓
  slop-cleaner       ████░░░░░░░░░░░░  1m 30s  ✓
  complete (x3)      ██░░░░░░░░░░░░░░  0m 45s  ✓
```

### Events Log

Show notable events chronologically:

```
EVENTS
──────
  10:00:00  build_start          feature=user-dashboard, size=M
  10:00:02  session_start        source=orchestrator-init
  10:00:05  phase_change         → planning
  10:03:27  phase_change         → building
  10:08:15  deliverable_warning  ⚠️ connector: 0 files modified
  10:12:30  evaluator_fail       design-evaluator: boundary violations
  10:12:31  agent_retry          designer
  10:16:10  phase_change         → testing
  10:20:20  phase_change         → quality
  10:21:50  phase_change         → cleanup
  10:22:45  phase_change         → complete
  10:23:05  build_complete
```

### Persistence Blocks (if any)

```
PERSISTENCE
───────────
  Block #1  iteration 2   phase=building   (build continued)
  Block #2  iteration 3   phase=testing    (build continued)
```

### Compaction Events (if any)

```
COMPACTION
──────────
  10:15:00  phase=building  iteration=2  (state preserved)
```

### Summary Statistics

```
SUMMARY
───────
  Total duration:     23m 05s
  Agents spawned:     16 (14 unique, 2 retries)
  Evaluator passes:   1 pass, 1 fail
  Critic verdict:     APPROVE (round 1)
  Persistence blocks: 2
  Compactions:        1
  Fix interventions:  0
```

---

## Step 3: Analysis (optional, if `--analyze` flag)

If `--analyze` is passed, add:

### Bottleneck Analysis
- Which agent took longest?
- Which phase has the most retries?
- Are there agents that could have run in parallel but didn't?

### Pattern Comparison (if multiple traces available)
- Compare this build's timeline with previous builds
- Flag agents that are consistently slow
- Flag phases that consistently need retries

---

## If `--compare {feature1} {feature2}`

Load both trace files. Render side-by-side:

```
COMPARISON: {feature1} vs {feature2}
═══════════════════════════════════════
                    {feature1}    {feature2}
Total duration:     23m 05s       18m 30s
Agents spawned:     16            12
Retries:            2             0
Evaluator fails:    1             0
Critic rounds:      1             2
```

Highlight where the builds diverged and why one was faster/slower.
