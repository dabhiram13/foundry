---
name: create-skill
description: >
  Build Claude Skills from scratch. Use when user asks to "create a skill", "build a skill",
  "make a skill", "skill for X", "write a skill", or describes a repeatable workflow
  they want Claude to learn.
---

# Create Skill

Build Claude Skills following official specifications. Ground truth: this skill's references only.

## Skill Structure

```
skill-name/           # Kebab-case only. No spaces/caps/underscores.
├── SKILL.md          # Required. Exact name, case-sensitive.
├── scripts/          # Optional. Executables (Python/Bash).
├── references/       # Optional. On-demand docs.
└── assets/           # Optional. Templates/icons.
```

**CRITICAL:** No README.md inside skill folder.

## YAML Frontmatter

Always at TOP of SKILL.md. Minimal required:

```yaml
---
name: skill-name           # Kebab-case, matches folder
description: >             # What + triggers (<1024 chars)
  Manages X for Y. Use for "phrase1", "phrase2", ".file-type".
---
```

**Good description:** Specific + trigger phrases + file types
**Bad description:** Vague ("Helps with projects"), missing triggers

**Forbidden:** XML brackets `<>`, "claude"/"anthropic" names

## SKILL.md Body

Keep under 5,000 words. Structure:

```markdown
# Skill Name
Brief explanation.

## When to Use
- Trigger scenarios

## Steps
1. Specific action: `command --flag value`
2. Next action

## Examples
**User:** "example query"
**Actions:** 1. Do X  2. Do Y
**Result:** Expected output

## Troubleshooting
| Error | Fix |
|-------|-----|
| Issue | Solution |

## References
- See `references/detail.md` for more
```

**DO:** Specific commands, numbered steps, error handling, examples
**DON'T:** Vague instructions, bury key info, assume solo use

## Building Workflow

### 1. Gather Requirements
Ask: What problem? Use cases (2-3)? Trigger phrases? MCP/tools needed? Domain rules?

### 2. Design
- Kebab folder name
- YAML with trigger phrases
- Core in SKILL.md, details in references/

### 3. Write
Follow structure above. Be specific.

### 4. Create Supporting Files
- `scripts/` for validation/executables
- `references/` for detailed docs
- `assets/` for templates

### 5. Test
- [ ] Folder kebab-case
- [ ] SKILL.md exact name
- [ ] YAML valid
- [ ] 90%+ trigger rate on relevant queries
- [ ] No README.md inside

## Progressive Disclosure

| Layer | When Loaded | Content |
|-------|-------------|---------|
| YAML frontmatter | Always | Name, description, triggers |
| SKILL.md body | On trigger | Core workflow |
| references/ | When accessed | Detailed specs |
| scripts/ | When executed | Validation code |

## Common Patterns

| Pattern | Use When |
|---------|----------|
| Sequential | Ordered steps with validation |
| Multi-MCP | Phases across services |
| Iterative | Draft → validate → fix loop |
| Context-aware | Decision trees with fallbacks |
| Domain intelligence | Compliance/rules before action |

## Quick Checklist

- [ ] Kebab folder name
- [ ] SKILL.md (exact case)
- [ ] YAML: name + description with triggers
- [ ] No README.md inside
- [ ] Under 5,000 words
- [ ] Specific, actionable steps
- [ ] Error handling included

## References

- `references/specification.md` - Full skill specification
- `references/patterns.md` - Detailed patterns with examples
- `references/troubleshooting.md` - Common issues and fixes
