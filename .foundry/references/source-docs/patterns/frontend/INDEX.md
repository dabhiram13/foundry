# Feature Frontend References — Index

> Planner: read this to select files for the Reference Manifest.

## Core Patterns (always included)

| File | Contains | Agent |
|------|----------|-------|
| `field-guide.md` | **Start here** — decision tree, 5 page patterns, cache tiers, loading states, mutations, top 20 gotchas, pattern index. Planners curate from this into briefs. | Planner (**READ FIRST**), all agents (via brief) |
| `architecture.md` | **Deep reference** — full RSC, data fetching, caching, state management, loading states, components, hooks, gotchas | Planner (for deep dives), Connector (when brief references it) |
| `visual-quality.md` | **Design excellence bar** — page recipes, card richness, micro-interactions, anti-patterns | Design Agent (**READ FIRST**) |
| `form-pattern.md` | React Hook Form + Zod, useForm, zodResolver, field patterns | Backend Connector (if forms), Design Agent (if forms) |
| `tailwind-v4.md` | Semantic tokens, banned colors, oklch, dark mode, radius tokens | Design Agent |

Note: `field-guide.md` is the condensed version (~200 lines). `architecture.md` is the full reference (~560 lines). Planners read both, build agents read what the brief tells them.

## Advanced Patterns (select per feature)

### url-state — nuqs
- **Select when**: feature has filters, search, tabs, pagination, sorting, or any state in the URL
- **Agents**: Backend Connector, Design Agent
- **File**: `url-state-pattern.md`
- **Replaces**: manual `filter-schema.ts` + `filtersFromSearchParams()` + `filtersCacheKey()`
- **Also read**: `loading-states-pattern.md` (always pair with url-state)
- **NOT Zustand**: if state should survive refresh or be shareable, it's URL state, not client state

### client-state — Zustand
- **Select when**: feature has shared ephemeral client state across distant components (multi-select + bulk actions, drag state + toolbar, undo/redo, cart, real-time presence)
- **Agents**: Backend Connector, Design Agent
- **File**: `client-state-pattern.md`
- **RARE**: most features do NOT need this. Read the decision table in the file before selecting.
- **NOT for**: filters, tabs, pagination, search, sort (use nuqs), server data (use oRPC/TanStack Query), parent-child state (use props/useState)
- **Rule**: if a PM would say "why can't I share this link?", use nuqs instead

### loading-states — Suspense boundaries
- **Select when**: url-state is selected, or feature has multiple async sections, or incorrect skeleton flash must be avoided
- **Agents**: Backend Connector, Design Agent
- **File**: `loading-states-pattern.md`
- **Key rule**: filters OUTSIDE Suspense, results INSIDE. nuqs `startTransition` for pending dim instead of skeleton flash.

### datatable — TanStack Table + shadcn
- **Select when**: feature displays tabular data with sorting, filtering, pagination, or column visibility
- **Agents**: Backend Connector, Design Agent
- **File**: `datatable-pattern.md`
- **Includes**: nuqs URL state integration, faceted/date/slider filters, column pinning, skeletons
- **Also read**: `url-state-pattern.md` (datatable uses nuqs internally)

### kanban — board with drag-and-drop columns
- **Select when**: feature has workflow/pipeline states with drag-to-reorder or cross-column moves
- **Agents**: Backend Connector, Design Agent
- **File**: `kanban-pattern.md`
- **Note**: uses `<Kanban>` wrapper component. Do NOT use raw dnd-kit for kanban.
- **Also read**: `optimistic-pattern.md` (reorder needs optimistic updates)

### dnd — raw dnd-kit sortable lists
- **Select when**: feature has reorderable lists, drag handles, or drop zones that are NOT kanban boards
- **Agents**: Backend Connector, Design Agent
- **File**: `dnd-pattern.md`
- **Note**: for kanban, use `kanban-pattern.md` instead
- **Also read**: `optimistic-pattern.md` (reorder needs optimistic updates)

### optimistic — useOptimistic + TanStack onMutate
- **Select when**: feature has toggle, like/bookmark, add/remove from list, or reorder actions where latency matters
- **Agents**: Backend Connector, Design Agent
- **File**: `optimistic-pattern.md`
- **Includes**: decision table for `useOptimistic` vs TanStack `onMutate`, reconciliation with `updateTag` + `router.refresh`

### virtual-scroll — @tanstack/react-virtual
- **Select when**: feature renders 500+ items in a list or table, or has infinite scroll over large datasets
- **Agents**: Backend Connector, Design Agent
- **File**: `virtual-scroll-pattern.md`
- **Includes**: dynamic row heights, TanStack Table integration, infinite scroll combo

### multistep-form — multi-step wizard
- **Select when**: feature has a form with 3+ logical sections, conditional steps, or step progress in the URL
- **Agents**: Backend Connector, Design Agent
- **File**: `multistep-form-pattern.md`
- **Includes**: single `useForm` with `trigger()` per step, nuqs step URL state, error-step jumping
- **Also read**: `form-pattern.md` (base form mechanics), `url-state-pattern.md` (step state in URL)

### image-upload — useUploadImage hook
- **Select when**: feature has user-facing image uploads (avatars, covers, post images, thumbnails)
- **Agents**: Backend Connector (wires hook), Design Agent (builds UI)
- **File**: `image-upload.md`
- **Includes**: preset selection (avatar/cover/content/thumbnail), 5 required UI states (idle/compressing/uploading/success/error), 4.5MB client-side validation, accessibility requirements
- **Backend counterpart**: `.foundry/references/source-docs/patterns/backend/file-storage.md` (same presets, server-side `uploadFile`)

## Pattern Dependencies

```
datatable ──requires──> url-state
url-state ──pair-with──> loading-states
kanban ────pair-with──> optimistic, client-state (if multi-select/toolbar)
dnd ───────pair-with──> optimistic
multistep-form ──requires──> form (core), url-state
virtual-scroll + datatable  (can combine for large tables)
client-state ──never-replaces──> url-state (different concerns)
```

## Selection Examples

**"Settings page with reorderable notification preferences"**
-> `dnd-pattern.md`, `optimistic-pattern.md`

**"Product catalog with filters, sorting, and pagination"**
-> `datatable-pattern.md`, `url-state-pattern.md`, `loading-states-pattern.md`

**"User onboarding wizard (profile, preferences, team setup)"**
-> `multistep-form-pattern.md`, `url-state-pattern.md`, `form-pattern.md`

**"Activity feed with 10k+ items and infinite scroll"**
-> `virtual-scroll-pattern.md`, `optimistic-pattern.md` (if likes/reactions)

**"Task board with todo/in-progress/done columns"**
-> `kanban-pattern.md`, `optimistic-pattern.md`, `client-state-pattern.md` (if multi-select + bulk actions)

**"Product builder with live preview panel"**
-> `client-state-pattern.md`, `form-pattern.md`

**"Real-time collaborative whiteboard with presence"**
-> `client-state-pattern.md`
