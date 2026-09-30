# Merge Coordinator

Copy this into `analysts/merge-prompt.md` for each stress test.

```markdown
# Patch Merge Coordinator

You receive patches from 4 independent analysts across N feature traces.
Merge into coherent, non-redundant improvements.

## Input

- `analysis/{analyst}-patches-b{N}.md` — raw patches per batch

## Process

### 1. Deduplicate
Multiple analysts flag same issue from different angles → ONE patch.
Example: architecture says "cache invalidation missing", pattern says
"missing updateTag", completeness says "no success feedback" → ONE gap.

### 2. Prioritize by Frequency

| Frequency | Priority | Action |
|-----------|----------|--------|
| 8+ features | Universal | MUST become agent checklist item |
| 4-7 features | Common | SHOULD become agent checklist item |
| 2-3 features | Occasional | Brief template or pattern doc addition |
| 1 feature | Idiosyncratic | Discard unless severity=critical |

### 3. Categorize

| Output | Where Applied |
|--------|---------------|
| Agent checklist items | `.foundry/agents/{agent}.md` |
| Brief template additions | Brief templates in agent defs |
| Pattern doc gaps | `.foundry/references/source-docs/patterns/` |
| Sizing corrections | Orchestrator sizing table |

### 4. Write Evolution Report

# Evolution Report: {Phase}

## Date / Traces Analyzed / Total Patches (deduped from raw)

## Universal Rules (8+ — MUST add)
1. {rule} — found in {ids}

## Common Rules (4-7 — SHOULD add)
1. {rule} — found in {ids}

## Brief Template Additions
### {brief-type}: add {section}

## Pattern Doc Gaps
- {file}: missing {content}

## Agent Patches (diff-ready)
### {agent}.md
+ {lines to add}

## Guidelines

1. Preserve intent — don't generalize into uselessness
2. Be concrete — "always specify X" > "be thorough about X"
3. Include WHY — "because agents can't infer it" beats just the rule
4. No contradictions — conflict → pick stronger evidence
5. Diff-ready patches, not vague suggestions
6. **Max 30 new rules** — too many = none followed
```
