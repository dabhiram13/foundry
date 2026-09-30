# Skill Patterns

## Pattern Selection

| Need | Pattern |
|------|---------|
| Linear stages | Sequential |
| Multiple tools | Multi-MCP |
| Correction loops | Iterative |
| Choose options | Context-aware |
| Compliance rules | Domain Intelligence |
| Independent tasks | Parallel |

## Sequential

Ordered steps with dependencies, validation, rollback.

```markdown
## Workflow
1. Validate prerequisites (API key, permissions)
2. Fetch: `scripts/fetch.py --source $SOURCE`
3. Process: `scripts/process.py`
4. Validate output (if fails → rollback step 2)
5. Deliver result
```

## Multi-MCP

Phases across services with data passing.

```markdown
## Phases
1. **Figma MCP**: Fetch design, extract components
2. **Drive MCP**: Create doc, upload assets
3. **Linear MCP**: Create tickets, attach doc link
4. **Slack MCP**: Notify team with links
```

## Iterative

Draft → Validate → Fix → Repeat.

```markdown
## Loop
1. Generate draft
2. Run `scripts/validate.py`
3. If pass → output; If fixable → fix + goto 2; If unfixable → escalate
4. Max 5 iterations
```

## Context-Aware

Decision tree with fallbacks.

```markdown
## Selection
| Size | Storage |
|------|---------|
| <10MB | Supabase |
| 10-100MB | R2 |
| >100MB | Ask user |

If unavailable: log failure → fallback → inform user
```

## Domain Intelligence

Rules before, audit after.

```markdown
## Pre-flight
1. Verify data classification
2. Check user permissions
3. Confirm audit logging
If any fail: STOP

## Post-action
1. Log to audit trail
2. Verify no PII leaked
3. Apply retention policy
```

## Parallel

Concurrent independent tasks.

```markdown
Execute simultaneously:
- Fetch Source A
- Fetch Source B
- Fetch Source C

After all: merge → dedupe → output
```

## Combining Patterns

```markdown
1. **Gather** (Parallel): API + database + files
2. **Validate** (Domain): compliance + permissions
3. **Process** (Iterative): draft → validate → fix
4. **Distribute** (Multi-MCP): storage + ticket + notify
```
