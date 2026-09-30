---
name: project-tool-docs
description: >
  Creates production-ready documentation for external tools/libraries. Spawns up to 3
  tool-scout agents in parallel using Context7 + Jina MCP. Produces multi-file docs
  per tool: get-started.md + one doc per feature. Use for "document tools", "create tool docs",
  "tool documentation", "document external tools", "research tool".
---

# Project Tool Docs

Spawns up to 3 `tool-scout` agents in parallel. Each produces a `docs/tools/{tool}/`
folder with multiple files: one get-started + one doc per feature needed.

## When to Use

- After `/discover` (reads `docs/project/external-tools.md`)
- When adding a new external tool mid-project
- When existing tool docs are incomplete

## Pre-flight

1. Read `docs/project/external-tools.md` — tools + features needed
2. Read `docs/project/technical-requirements.md` — context for each tool
3. Read `references/doc-guidelines.md` — writing guidelines

## Output Structure

Each tool gets its own folder:

```
docs/tools/{tool}/
├── get-started.md        # Install, config, env vars, quick setup
├── {feature-1}.md        # One doc per feature we need
├── {feature-2}.md
└── {feature-3}.md
```

Example for Mux:
```
docs/tools/mux/
├── get-started.md
├── upload.md
├── playback.md
└── download.md
```

## Execution

### Step 1: Build Tool List

From `external-tools.md`, extract per tool:
- Tool name / package name
- List of specific features needed (these become individual doc files)
- Why we need it

Single tool request → skip this, use user input directly.

### Step 2: Delegate to tool-scout Agents

**Spawn up to 3 agents in parallel** (`.foundry/agents/tool-scout.md`).

Pass this context per tool:

```
Tool: {tool name}
Package: {npm package or service name}

Features to document (one file each):
- {feature-1}
- {feature-2}
- {feature-3}

Our stack: Supabase (DB/Auth/Storage/Realtime), Vercel, Next.js, Tailwind v4, shadcn/ui, oRPC, TypeScript.

Output folder: docs/tools/{tool}/

Write these files:
1. get-started.md — install, config, env vars, basic setup
2. {feature-1}.md — dedicated doc for this feature
3. {feature-2}.md — dedicated doc for this feature
...one file per feature listed above.

Guidelines: {paste references/doc-guidelines.md}

Research:
1. Context7 MCP: resolve-library-id → query-docs per feature
2. Jina MCP: ONLY if Context7 has gaps
```

**Parallel rules:**
- 3 or fewer tools → all at once
- 4+ tools → batches of 3

### Step 3: Verify

1. Each tool has `docs/tools/{tool}/get-started.md`
2. Each feature has its own `.md` file
3. No `<!-- VERIFY: -->` markers remaining
4. Update `docs/project/external-tools.md` with doc status

## Adding a Single Tool

1. Ask: What features do we need from {tool}?
2. Spawn single tool-scout
3. Add tool to `docs/project/external-tools.md`

## Post-flight

- [ ] All tools from external-tools.md have doc folders
- [ ] Each tool has get-started.md + one file per feature
- [ ] No `<!-- VERIFY: -->` markers
- [ ] external-tools.md updated

## References

- `references/doc-guidelines.md` — writing guidelines for all tool docs
