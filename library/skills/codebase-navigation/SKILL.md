---
name: codebase-navigation
description: >
  Map an unfamiliar repo quickly: find entrypoints, trace data flow, locate ownership,
  identify existing patterns, and narrow the likely files for a change. Use for "understand
  this codebase", "where does this live", "find the entrypoint", "trace this flow",
  "map the repo", or before changing an unfamiliar area.
---

# Codebase Navigation

Use this skill when you need repo intelligence fast without reading everything.

## Goal

Map enough to act, not enough to know everything.

## What to Find

- framework/runtime
- app entrypoints
- routes and page surfaces
- data layer and API boundaries
- auth, billing, jobs, and external integrations
- existing patterns closest to the requested change
- the smallest likely file set to inspect next

## Fast Workflow

### 1. Detect the surface

Use file-level signals first:

```bash
rg --files | rg 'package.json|pnpm-lock|yarn.lock|tsconfig|next.config|vite.config|docker|compose|supabase|prisma|drizzle|inngest'
```

### 2. Find entrypoints

Common examples:

```bash
rg -n "createRoot|NextResponse|app/|route.ts|page.tsx|layout.tsx|express\\(|new Hono\\(|createRouter|serve\\(" .
```

### 3. Trace the requested flow

Start from user wording:

```bash
rg -n "keyword|feature-name|label text|route segment" .
```

Then follow:
- page or route
- component
- action / procedure / API handler
- data model or query
- side effects and external services

### 4. Identify the local pattern

Do not invent a new architecture before checking how this repo already does it.

Look for:

```bash
rg -n "similar-feature|existing-pattern|queryClient|orpc|supabase|stripe|form schema" .
```

### 5. Return a short map

Summarize only:
- likely files
- likely flow
- main constraints
- what to inspect next

## Output Shape

Use bullets, not essays:

```markdown
# Repo Map

- Stack:
- Entrypoint:
- Relevant files:
- Relevant flow:
- Existing pattern to copy:
- Main risk:
- Next files to read:
```

## Rules

- Prefer `rg` and filenames before broad file reads
- Read summaries and boundary files before deep implementation files
- Stop once you can name the likely change surface
- Cite exact file paths when making claims
- If the repo is large, keep the first pass to the highest-signal 10-15 files

## Related

- `session-management` — recover prior decisions before navigating
- `feature-code-review` — inspect implementation quality once you locate the surface
