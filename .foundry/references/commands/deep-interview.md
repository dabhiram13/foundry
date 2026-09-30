<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: deep-interview
description: Socratic requirements gathering with ambiguity scoring. Asks ONE question at a time targeting the weakest clarity dimension. Produces a crystal-clear spec when ambiguity drops below 20%.
---

# Deep Interview

You are conducting a structured requirements interview. Your job is to reduce ambiguity below 20% through targeted Socratic questioning — ONE question at a time, always targeting the weakest clarity dimension.

The user said: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask: "What do you want to build? Give me the rough idea."

---

## Setup

### 1. Detect Context (brownfield vs greenfield)

Check if `docs/INDEX.md` exists:
- **Brownfield** (exists): Read `docs/INDEX.md`, relevant `docs/built/*.md`, `db-schema.md`, `docs/project/product-overview.md`. You have codebase context — cite repo evidence in questions.
- **Greenfield** (doesn't exist): No existing codebase context. Questions must be self-contained.

### 2. Initialize Clarity Scores

Track these dimensions across every round:

| Dimension | Weight (greenfield) | Weight (brownfield) | Meaning |
|-----------|-------------------|-------------------|---------|
| Goal Clarity | 0.40 | 0.35 | What are we building and why? |
| Constraint Clarity | 0.30 | 0.25 | What limits, rules, and boundaries exist? |
| Success Criteria | 0.30 | 0.25 | How do we know it's done and correct? |
| Context Clarity | — | 0.15 | How does this fit with what already exists? |

**Ambiguity formula:**
- Greenfield: `ambiguity = 1 - (goal * 0.40 + constraints * 0.30 + criteria * 0.30)`
- Brownfield: `ambiguity = 1 - (goal * 0.35 + constraints * 0.25 + criteria * 0.25 + context * 0.15)`

Start all dimensions at 0.1 (nearly unknown). Update after EACH user response.

### 3. Initialize Ontology Tracker

Track entities mentioned across rounds:

```
Entity: {name}
Type: {noun | data-type | actor | system}
Fields/attributes: {discovered properties}
Relationships: {connections to other entities}
First mentioned: round {N}
Stability: {new | shifting | stable (unchanged for 3+ rounds)}
```

Ontology stability is a secondary readiness signal — if core entities keep changing names or definitions, requirements aren't crystallized yet.

---

## Interview Loop

### Each Round

1. **Score update**: Re-evaluate all clarity dimensions based on the user's last response. Show the dashboard:

```
Round {N} | Ambiguity: {X}%
  Goal: {score}/1.0 | Constraints: {score}/1.0 | Criteria: {score}/1.0 {| Context: {score}/1.0}
  Weakest: {dimension name}
  Entities: {count} ({stable count} stable)
```

2. **Target the weakest dimension**: Formulate ONE question that maximally reduces ambiguity in the weakest dimension. 

**Question quality rules:**
- About PRODUCT INTENT, never implementation
- Reference what you already know — don't ask what's been answered
- For brownfield: cite specific files, tables, or features that exist ("I see `users` table has a `role` column — does this feature need role-based access?")
- Propose answers when you can: "Based on what you said, I think X. Is that right, or is it more like Y?"
- Never ask compound questions (A and B?) — ONE thing at a time

3. **Challenge agents** (activate at thresholds):
- **Round 4+**: Contrarian mode — before asking, internally challenge: "What's the strongest argument that the current understanding is WRONG?" If you find one, ask about it.
- **Round 6+**: Simplifier mode — before asking, check: "Is the scope creeping? Could this be simpler?" If yes, propose the simpler version.
- **Round 8+**: Ontologist mode (if ambiguity > 30%) — focus exclusively on entity definitions and relationships. "Let me make sure I understand the data model: {entity} has {fields} and relates to {other} via {relationship}. Correct?"

4. **Wait for user response.** Process it. Repeat.

### Exit Conditions

- **Ambiguity ≤ 20%**: Threshold met. Proceed to spec generation.
- **Round 3+**: If ambiguity ≤ 30%, offer early exit: "Ambiguity is at {X}%. I can generate the spec now (good enough for S/XS features) or keep refining. Your call."
- **Round 10**: Warning: "We're at round 10. Ambiguity is {X}%. I recommend generating the spec now and iterating during planning."
- **Round 15**: Hard cap. Generate spec with whatever clarity exists. Note unresolved areas.
- **User says "enough" / "just build it" / "let's go"**: Respect immediately. Generate spec.

---

## Spec Generation

When the interview concludes, generate the spec:

### Output: `dev/active/{feature-slug}/spec.md`

```markdown
# {Feature Name}

## Interview Summary
Rounds: {N} | Final ambiguity: {X}%
Clarity: Goal {score} | Constraints {score} | Criteria {score} {| Context {score}}

## The Experience
{Storyboard-style description of what the user experiences. Present tense, second person.}

## Business Rules
{Every constraint and rule discovered during the interview.}
- {Rule}: {decision} → At boundary: {what happens}

## Success Criteria (testable)
{Each criterion must be verifiable by an agent — not "works well" but "user can create X and see it in Y within Z seconds"}
1. {Criterion} — verifiable by: {how to test it}
2. {Criterion} — verifiable by: {how to test it}

## Edge Cases
{Discovered during Contrarian mode and constraint questioning}
- {Edge case}: {expected behavior}

## Scope Boundaries
- IN: {what's included}
- OUT: {what's explicitly excluded}

## Ontology
| Entity | Type | Key Fields | Relationships |
|--------|------|-----------|---------------|
{From ontology tracker — stable entities only}

## Unresolved (ambiguity > 0)
{Any areas where clarity is below 0.5 — flagged for planner attention}

## Scale Profile
{If applicable — items at launch, at 1K users, at 10K users}
```

### After Spec Generation

Create the feature workspace:
```
mkdir -p dev/active/{feature-slug}/
```

Save spec.md, then offer next steps:

> **Spec ready!** Ambiguity: {X}%
>
> **Next steps:**
> 1. `/spec --review` — refine this spec further
> 2. Plan + build (recommended for M/L) — runs consensus planning then build
> 3. Build directly (for XS/S) — straight to orchestrator
> 4. Refine further — continue the interview

---

## Integration with /enhance

When invoked from `/enhance` context (existing feature), automatically:
- Set brownfield mode
- Pre-populate Context Clarity from the existing `docs/built/{feature}.md`
- Start Goal Clarity at 0.3 (user already knows what they want to change)
- Reduce round cap to 8 (enhancements are narrower scope)
