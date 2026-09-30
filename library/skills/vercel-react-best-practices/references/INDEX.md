# Vercel React Best Practices — Index

> Planner: read this to select files for the Reference Manifest.
> Only assign files that match the feature's characteristics. Do NOT assign all files.

## Eliminating Waterfalls (CRITICAL)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `async-defer-await.md` | Move await into branches where actually used | Feature has conditional async operations | Connector |
| `async-parallel.md` | Promise.all() for independent operations | Feature fetches multiple data sources | Connector |
| `async-dependencies.md` | better-all for partial dependencies | Feature has waterfall-prone data fetching | Connector |
| `async-suspense-boundaries.md` | Suspense to stream content | Feature has slow/independent page sections | Connector |
| `async-api-routes.md` | Start promises early, await late in API routes | Feature has API routes with multiple DB calls | Backend |

## Bundle Size Optimization (CRITICAL)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `bundle-barrel-imports.md` | Import directly, avoid barrel files | Feature creates new component library | Connector, Designer |
| `bundle-dynamic-imports.md` | next/dynamic for heavy components | Feature uses heavy libs (charts, editors, maps) | Connector, Designer |
| `bundle-defer-third-party.md` | Load analytics/logging after hydration | Feature adds third-party scripts | Connector |
| `bundle-conditional.md` | Load modules only when feature activated | Feature has feature flags or conditional UI | Connector |
| `bundle-preload.md` | Preload on hover/focus for perceived speed | Feature has navigation-heavy UI | Designer |

## Server-Side Performance (HIGH)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `server-cache-react.md` | React.cache() for per-request dedup | Feature has shared data across components | Connector |
| `server-cache-lru.md` | LRU cache for cross-request caching | Feature has expensive computations | Connector |
| `server-serialization.md` | Minimize data passed to client components | Feature passes large props to client | Connector |
| `server-parallel-fetching.md` | Restructure components to parallelize fetches | Feature has sequential server fetches | Connector |
| `server-after-nonblocking.md` | after() for non-blocking operations | Feature has analytics/logging on server | Connector |

## Re-render Optimization (MEDIUM)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `rerender-memo.md` | Extract expensive work into memoized components | Feature has complex list rendering | Designer |
| `rerender-derived-state.md` | Subscribe to derived booleans, not raw values | Feature has state-dependent UI | Designer |
| `rerender-transitions.md` | startTransition for non-urgent updates | Feature has search/filter with heavy UI updates | Designer |
| `rerender-defer-reads.md` | Don't subscribe to state only used in callbacks | Feature has stores (zustand) with many subscribers | Designer |
| `rerender-lazy-state-init.md` | Pass function to useState for expensive values | Feature computes initial state from props | Designer |

## Rendering Performance (MEDIUM)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `rendering-content-visibility.md` | content-visibility for long lists | Feature has long scrollable lists | Designer |
| `rendering-hoist-jsx.md` | Extract static JSX outside components | Feature has static UI mixed with dynamic | Designer |
| `rendering-conditional-render.md` | Use ternary, not && for conditionals | Always — basic correctness | Designer |
| `rendering-activity.md` | Activity component for show/hide | Feature toggles visibility of heavy components | Designer |
