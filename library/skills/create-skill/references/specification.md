# Skill Specification

## Definition

Folder with SKILL.md teaching repeatable workflows. Principles: progressive disclosure, composability, portability.

**Analogy:** MCP = tools (kitchen), Skills = recipes (how to use)

## Structure

| Component | Required | Rules |
|-----------|----------|-------|
| Folder | Yes | Kebab-case: `my-skill-name`. No spaces/caps/underscores. |
| SKILL.md | Yes | Exact case. No variations. No README.md inside. |
| scripts/ | No | Executables: `validate.py`, `process.sh` |
| references/ | No | On-demand docs |
| assets/ | No | Templates |

## YAML Frontmatter

```yaml
---
name: skill-name           # Required: kebab-case, matches folder
description: >             # Required: what + triggers (<1024 chars)
  Does X for Y. Use for "trigger1", "trigger2", ".filetype".
license: MIT               # Optional
compatibility: Claude.ai, Claude Code, API  # Optional
metadata:                  # Optional
  author: Name
  version: 1.0.0
  mcp-server: server-name
---
```

**Description rules:**
- Include: what (1 sentence) + trigger phrases + file types
- Good: `"Analyzes Figma for dev handoff. Use for .fig, 'figma to code'."`
- Bad: `"Helps with projects"` (vague, no triggers)

**Forbidden:** XML `<>`, "claude"/"anthropic"

## SKILL.md Body

```markdown
# Skill Name
Brief explanation.

## When to Use
- Scenario 1

## Prerequisites
- MCP: server-name

## Steps
1. `python scripts/fetch.py --id $ID`
2. Verify output

## Expected Output
Success description.

## Examples
**User:** "request"
**Actions:** 1. X 2. Y
**Result:** outcome

## Troubleshooting
| Error | Solution |
|-------|----------|
| Issue | Fix |

## References
- `references/detail.md`
```

## Writing Rules

| DO | DON'T |
|----|-------|
| Specific commands | Vague: "Validate data" |
| Numbered steps | Bury key info |
| Error handling | Assume solo use |
| Examples | README.md inside |
| Under 5,000 words | |

## Categories

| Type | Description | Example |
|------|-------------|---------|
| Doc/Asset | Generate content | `frontend-design` |
| Workflow | Multi-step automation | `discover` |
| MCP Enhancement | Optimize tool usage | `sentry-code-review` |

## Success Criteria

90%+ trigger rate, fewer tool calls, zero failures, no corrections.

## Distribution

```bash
zip -r skill.zip skill-name/
```

| Platform | Method |
|----------|--------|
| Claude.ai | Settings > Skills > Upload |
| Claude Code | `library/skills/` |
| API | `v1/skills` (Code Execution beta) |

GitHub: repo-level README (outcomes-focused), link from MCP docs.
