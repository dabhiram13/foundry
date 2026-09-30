# Session Instructions Template

Copy and adapt for each phase. Reference: `dev/planning-stress-test/PLANNING-SESSION-INSTRUCTIONS.md`.

```markdown
# {Phase} Stress Test — Session Instructions

{PHASE}-ONLY session for ONE feature. Do NOT run {next phase}.

## Claim (MUST DO FIRST)

1. Read `dev/{phase}-stress-test/roadmap.json`
2. Find first `status: "pending"`
3. Set `"in_progress"`, save, commit, push immediately
4. Push fails → pull, pick next pending, repeat

## Execute

1. Read input from `{input-path}/{NN}-{name}/`
2. `mkdir -p dev/{phase}-stress-test/traces/{NN}-{name}/`
3. Run EXACT production process for this phase
4. Save all outputs to traces directory
5. **Document struggles in decisions.md**

## Finalize

1. Update roadmap.json: status → "done", add notes (struggles!)
2. `git add -A && git commit -m "{phase}: {NN}-{name} done" && git push`
3. Stop. Do not run another feature.

## Rules

- ONE feature per session
- EXACT production process (no shortcuts)
- Struggles = most valuable data. Always document.
- Treat specs as real — execute against current codebase
```

## Phase Input/Output

| Phase | Input | Output |
|-------|-------|--------|
| Planning | `specs/{NN}.md` | plan.md, briefs, tasks.md, decisions.md |
| DB | evolved `plans/{NN}/` | migration.sql, rls.sql, indexes.sql, decisions.md |
| Backend | plans + migrations | procedures.ts, inngest.ts, schemas.ts, decisions.md |
| Connector | plans + migrations + procedures | page.tsx, data.ts, actions.ts, hooks.ts, decisions.md |
| Designer | connector output + ux-brief | components, layouts, decisions.md |
| Testing | fully built feature | tests, results, bug-fixes.md, decisions.md |
| Full E2E | specs (from scratch) | entire pipeline output, decisions.md |
