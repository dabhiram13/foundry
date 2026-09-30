# Doc Template

Standard format for all tool documentation. Every section is required.

---

```markdown
# {Tool Name}

> {One-line: what it is and why we use it in this project}

## Quick Reference

| | |
|---|---|
| **Package** | `{npm package or service}` |
| **Version** | `{version we use}` |
| **Docs** | {official docs URL} |
| **Env Vars** | `{VAR_1}`, `{VAR_2}` |
| **Used For** | {specific features in our project} |

## Installation

{Install command + any peer dependencies}

## Configuration

{Setup steps specific to our stack — env vars, provider wrappers, initialization}

### Environment Variables

| Var | Required | Description | Where to Get |
|-----|----------|-------------|--------------|
| `{VAR}` | Yes/No | {what it does} | {dashboard URL or generation step} |

## Features

### {Feature 1 Name}

**What**: {what this feature does for us}

**Usage**:
{Code example — TypeScript, matching our patterns}

**Error Handling**:
{How errors surface, how to catch them, what to show the user}

### {Feature 2 Name}
{same structure}

## Integration with Our Stack

### Server-Side (oRPC Procedures)
{How to use this tool inside oRPC procedures — server-only patterns}

### Client-Side (React Components)
{If any client-side SDK needed — or "Server-only, no client SDK needed"}

### Background Jobs (Inngest)
{If this tool is used in async jobs — or "Not used in background jobs"}

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| {error code/message} | {why it happens} | {what to do} |

## Edge Cases

- {Edge case 1: scenario + how to handle}
- {Edge case 2: scenario + how to handle}

## Rate Limits & Costs

| Tier | Limit | Cost |
|------|-------|------|
| {tier} | {requests/period} | {price} |

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| {mistake developers make} | {correct approach} |

## Code Recipes

### {Recipe 1: Common pattern name}
{Complete, copy-paste-ready code block}

### {Recipe 2: Common pattern name}
{Complete, copy-paste-ready code block}
```

---

## Template Rules

- Every code example must be TypeScript
- Every code example must include error handling
- Server-side code uses our oRPC pattern (procedures, context.claims)
- Client-side code uses our hook pattern (useQuery, useMutation)
- No placeholder code — every example must be functional
- If a section doesn't apply, write "N/A — {reason}" (don't delete the section)
- Mark uncertain info with `<!-- VERIFY: {what to check} -->`
