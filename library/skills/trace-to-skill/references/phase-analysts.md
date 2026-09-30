# Phase-Specific Analyst Adaptations

Base 4 analysts (architecture, pattern, completeness, buildability) adapt per phase.

## Planning (reference implementation)

Standard 4 analysts. No changes needed.
- Architecture: cache tiers, RLS, boundaries, data flow, Inngest
- Pattern: pattern selection, compliance, anti-patterns, brief quality
- Completeness: UI states, mutation flows, mobile, a11y, plan gating
- Buildability: sequencing, handoffs, clarity, brief sufficiency

## DB

| Base Analyst | Becomes | Focus |
|-------------|---------|-------|
| Architecture | **Schema** | Normalization, FK integrity, indexes, type choices (text vs enum, jsonb vs columns) |
| Pattern | **RLS** | Policy per CRUD op, perf (no N+1 in policies), admin paths, helper function deps |
| Completeness | Completeness | Missing indexes, missing policies, edge cases (NULL handling, cascades) |
| Buildability | Buildability | Execution order, deps on other tables, stub functions for missing infra |

## Backend (includes backend-evaluator calibration)

| Analyst | Added Focus |
|---------|------------|
| Architecture | Procedure output shapes match frontend, error handling, rate limiting |
| Pattern | oRPC conventions, Inngest step patterns, .actionable() on every mutation |
| Completeness | Missing procedures, edge cases, error responses |
| Buildability | Individual procedure exports (not just router), Zod↔DB type match |

**Evaluator calibration analysts (run alongside standard 4):**
| Analyst | Focus |
|---------|-------|
| **Evaluator-Accuracy** | Compare backend-evaluator grades to analyst findings. False positives (evaluator flagged correct code)? False negatives (evaluator missed violations analysts found)? |
| **Evaluator-Calibration** | Is the evaluator too lenient or too strict? Which criteria need reweighting? What few-shot examples would improve judgment? |

## Frontend (Connector + Designer + design-evaluator calibration)

| Analyst | Added Focus |
|---------|------------|
| Architecture | RSC boundaries, cache directives inside function body, updateTag not revalidateTag |
| Pattern | Page patterns 1-5, loading-states placement, optimistic approach selection |
| Completeness | All 6 UI states per page, focus management, dark mode, responsive |
| Buildability | Connector→designer handoff, component prop contracts, shared component conflicts |

**Evaluator calibration analysts (run alongside standard 4):**
| Analyst | Focus |
|---------|-------|
| **Evaluator-Accuracy** | Compare design-evaluator grades to analyst findings. Does evaluator catch architecture violations? Does it grade visual quality honestly? False positives/negatives? |
| **Evaluator-Calibration** | Is visual quality criterion too lenient (rubber-stamping "AI slop")? Is architecture criterion catching what matters? What screenshots/examples would calibrate better taste? |

## Testing

| Base Analyst | Becomes | Focus |
|-------------|---------|-------|
| Architecture | **Coverage** | Tested vs should-be-tested, critical paths covered |
| Pattern | **Quality** | Reliability, flakiness, false positives, test independence |
| Completeness | Completeness | Edge cases, error paths, concurrent scenarios |
| Buildability | Buildability | Setup complexity, data fixtures, cleanup, CI runtime |

## Full E2E

Standard 4 + **Pipeline Analyst**:
- Information loss between phases (plan says X, code does Y)
- Handoff gaps (backend exports vs connector imports)
- Context.md updates between agent groups
- Orchestrator routing decisions
