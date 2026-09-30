---
name: trace-to-skill
description: >
  Evolve agent skills via trajectory analysis. Use for "trace to skill", "stress test",
  "evolve agents", "improve pipeline", "skill evolution", "analyze traces", "evolve phase".
---

# Trace-to-Skill

Evolve agent/skill definitions by analyzing real execution traces across diverse tasks.
Parametric knowledge (asking LLM to write skills from imagination) = useless. Must ground in real traces.

## Why This Works

Parallel fleet of analysts examine diverse traces → extract patches → hierarchical merge keeps only
patterns recurring across many traces → those are systematic, not noise. One comprehensive skill > fragmented collection.

## Pipeline

```
SPECS → TRACES → ANALYSTS → MERGE → APPLY → VALIDATE
  15      15      4×batch    1        patch    held-out
diverse  parallel parallel   merge    agents   5-7 specs
specs    sessions analysts   report   + docs   verify
```

## Step 1: Spec Pool (15 diverse features)

Cover every dimension the target agent handles. Narrow pool = narrow skill.

| Dimension | Spread Required |
|-----------|----------------|
| Size | 1 XS, 4-5 S, 7 M, 2 L |
| Patterns | Every pattern the agent should know |
| Complexity | Simple CRUD → multi-step workflows → external APIs |
| Auth/RLS | User-scoped, admin-only, multi-tenant |
| Edge cases | Real-time, file upload, Stripe, Inngest |

Write coverage matrix in README.md. **Every dimension hit by 2+ features.**

## Step 2: Workspace Setup

```
dev/{phase}-stress-test/
├── README.md                       # Coverage matrix + status
├── SESSION-INSTRUCTIONS.md         # Frozen rules for trace sessions
├── roadmap.json                    # Claim/lock/status tracking
├── specs/{NN}-{name}.md            # 15 pre-written specs
├── traces/{NN}-{name}/             # Full execution outputs
│   ├── {phase-outputs}             # plans, migrations, code, etc.
│   └── decisions.md                # Struggles = GOLD
├── analysts/
│   ├── {analyst-type}.md           # 4 analyst definitions
│   └── merge-prompt.md             # Merge coordinator
└── analysis/
    ├── {analyst}-patches-b{N}.md   # Raw patches per batch
    └── evolution-report.md         # Final merged output
```

## Step 3: Generate Traces (1 per session)

Each session: claim feature → read spec → run EXACT production process → save outputs.

**Rules:**
- ONE feature per session (no cross-contamination)
- EXACT production process (no shortcuts)
- Freeze agent definition S0 (same version for ALL traces)
- **Document struggles in decisions.md** (richest signal)
- Claim-lock via git commit+push if parallel sessions

Run 5-8 sessions in parallel. 15 features ÷ 5 parallel ≈ 3 rounds.

## Step 4: Analyze (4 Analysts × Batches of 4-5)

Four specialized analysts run **in parallel** per batch. Each sees batch traces + frozen S0.
Analysts NEVER see each other's patches.

| Analyst | Focus | Patch Prefix |
|---------|-------|-------------|
| Architecture | Cache, RLS, boundaries, data flow, Inngest | `ARCH_PATCH` |
| Pattern | Pattern selection, compliance, anti-patterns, brief quality | `PATTERN_PATCH` |
| Completeness | Missing UI states, mutation flows, mobile, a11y, edge cases | `COMPLETENESS_PATCH` |
| Buildability | Sequencing, handoffs, task clarity, brief sufficiency, risks | `BUILD_PATCH` |

**Patch format:**
```
{PREFIX}: {feature-id}
AREA: {specific area}
GAP: {what's missing/wrong}
PATTERN: {when this happens — GENERALIZE}
FIX: {concrete fix}
SEVERITY: {critical | important | minor}
```

Batch 4-5 features per round (not all 15 — analyst needs cross-trace comparison within batch).

**Adapt analysts per phase** — see `references/phase-analysts.md`.

## Step 5: Merge (Prevalence-Weighted)

Consolidate ALL patches across all analysts and batches into one evolution report.

| Frequency | Routing |
|-----------|---------|
| 8+ features | **Universal** → agent definition checklist. MUST add. |
| 4-7 features | **Common** → agent def or pattern doc. SHOULD add. |
| 2-3 features | **Occasional** → brief template or reference. Consider. |
| 1 feature | **Idiosyncratic** → discard (unless severity=critical). |

**Merge guidelines:**
1. Deduplicate — same gap from different analysts → keep best version
2. Resolve conflicts — contradictory → pick stronger evidence or synthesize
3. Preserve unique insights — different failure modes → keep all
4. Prevalent pattern bias — recurring = systematic, express as general principles
5. Be concrete — "always verify X after Y" > "be thorough about Z"
6. Max 30 new rules per round

**Output categories:**

| Output | Where Applied |
|--------|---------------|
| Agent checklist items | `.foundry/agents/{agent}.md` |
| Brief template additions | Brief templates in agent defs |
| Pattern doc gaps | `.foundry/references/source-docs/patterns/` |
| Sizing corrections | Orchestrator mode rules |

## Step 6: Apply + Validate

1. Write evolution-report.md with diff-ready patches
2. Apply patches to agent definitions + pattern docs
3. Run held-out specs (5-7 not used in analysis) with evolved agents
4. Compare pre vs post quality
5. If gaps remain → iterate (2-3 rounds converge)

## Phase Roadmap

Each phase reuses the same 15 feature specs, evolving different agents:

| Phase | Target Agents | Trace Artifacts | Key Analyst Adaptations |
|-------|--------------|-----------------|------------------------|
| Planning | planner | plans, briefs, decisions | Standard 4 analysts |
| DB | db-architect | migrations, RLS, indexes | Schema analyst, RLS analyst |
| Backend | backend + backend-evaluator | procedures, Inngest, evaluator grades | Export shape, error handling, evaluator calibration |
| Frontend | connector + designer + design-evaluator | pages, components, evaluator grades | RSC boundaries, all UI states, evaluator calibration |
| Testing | api-tester, flow-tester | tests, results, bug fixes | Coverage, reliability, fixtures |
| Full E2E | orchestrator + all agents | entire pipeline output | + Pipeline analyst (handoff gaps) |

**Order:** Evolve each phase individually first, then run full E2E stress test with all evolved agents.
Each phase feeds evolved outputs to the next (evolved plans → DB traces, evolved migrations → backend traces).

## Key Principles

1. Parametric = useless. Must have real traces with real failures.
2. Error analysis > success analysis. Errors reliably valuable, successes volatile.
3. Parallel > sequential. All analysts see frozen S0, no drift, 5-20× faster.
4. Prevalence = generalizability. Recurring across diverse traces = systematic.
5. Struggles are gold. decisions.md doubts/tensions = richest trace artifact.
6. Max 30 rules/round. Too many = none followed.
7. Skills transfer downward. Opus-evolved skills improve Sonnet, not always vice versa.
8. Diversity > volume. 15 diverse specs > 50 similar ones.
9. Separate generator from evaluator. Agents can't judge their own work. (Anthropic research)
10. Evaluator calibration > generator checklists. Easier to tune a skeptical judge than a self-critical builder.
11. Strip scaffolding per model. Re-examine what's load-bearing on each model release.
12. Planners stay high-level. Define WHAT (contracts), not HOW (implementation). Over-specification cascades.

## Evaluator Calibration (NEW — for Backend + Frontend phases)

When stress-testing phases that include evaluators (backend, frontend), add a calibration loop:

1. **Run traces** with evaluator in the pipeline
2. **Read evaluator grades** — find where evaluator judgment diverges from yours:
   - Evaluator said PASS but you'd say FAIL (too lenient)
   - Evaluator said FAIL but you'd say PASS (too strict)
   - Evaluator missed a violation entirely (blind spot)
3. **Update evaluator prompt** with calibration examples (few-shot)
4. **Re-run 3 traces** with calibrated evaluator
5. **Repeat** until evaluator grades match your judgment on 80%+ of criteria

This is the paper's key insight: tuning a standalone evaluator to be skeptical is more tractable
than making a generator critical of its own work. The calibration loop IS the stress test for evaluators.

**Evaluator trace artifacts (in addition to standard):**
- Grade report (the 4-criteria table)
- Fixes applied (diff of changes)
- False positives (evaluator flagged something that was actually correct)
- False negatives (evaluator missed something you'd catch)

## Anti-Patterns

| Don't | Why | Do |
|-------|-----|----|
| Analyze all 15 at once | Too much per analyst | Batch 4-5 |
| Generic analyst ("find problems") | Shallow patches | Specialized + checklisted |
| Skip decisions.md | Miss richest signal | Require struggles documented |
| Merge without frequency | Can't filter noise | Count citations per pattern |
| Patch agents directly | Lose rationale | Evolution report first |
| Reuse trace specs for validation | Overfitting | Hold out 5-7 specs |
| Evolve all phases at once | Can't attribute improvement | One phase → validate → next |

## References

- `references/phase-analysts.md` — Analyst adaptations per pipeline phase
- `references/merge-prompt.md` — Merge coordinator prompt template
- `references/session-template.md` — Session instructions template
