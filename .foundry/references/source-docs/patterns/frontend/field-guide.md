# Frontend Field Guide

The essential patterns every frontend agent must know. Planners: curate from this into feature briefs. Builders: your brief references specific sections — read what it tells you.

---

## Decision Tree (always start here)

```
Is data the same for all users?
+-- YES -> 'use cache' + getPublicORPCCaller() -> caller.public.*
+-- NO  -> Cacheable (stale OK for 30s+)?
          +-- YES -> 'use cache: private' + getORPCCaller() -> caller.protected.*
          +-- NO  -> No directive + getORPCCaller() -> caller.protected.*

Pagination/infinite scroll?
+-- YES -> Hybrid: use() for page 1 + useInfiniteQuery for pages 2+
+-- NO  -> Server component awaits + passes as props

User sees own writes immediately?
+-- YES -> updateTag('tag') in server action + router.refresh()
+-- NO  -> revalidateTag('tag', 'max') for eventual consistency
```

---

## 5 Page Patterns

### Pattern 1: Self-Contained Components (THE default)

Page is static layout, zero data fetching. Each component owns its cache + skeleton + client.

```tsx
// page.tsx — static, dumb layout
export default function FeaturePage() {
  return (
    <>
      <h1>Feature</h1>
      <FeatureCardServer />      {/* self-contained */}
      <FeatureStatsServer />     {/* self-contained */}
    </>
  )
}

// Server component — sync export, creates promise, wraps in Suspense
export function FeatureCardServer() {
  const dataPromise = getFeatureData()   // NOT awaited
  return (
    <Suspense fallback={<FeatureCardSkeleton />}>
      <FeatureCard dataPromise={dataPromise} />
    </Suspense>
  )
}

// Client — unwraps with use()
'use client'
export function FeatureCard({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise)
  return <div>{data.title}</div>
}
```

### Pattern 2: List Page with Filters (PPR)

```tsx
// page.tsx — parses searchParams, filters OUTSIDE Suspense, results INSIDE
const cache = createSearchParamsCache(featureParsers)

export default async function FeaturePage({ searchParams }) {
  const filters = await cache.parse(searchParams)
  return (
    <div className="w-full space-y-6">
      <h1>Feature</h1>
      <FeatureFilters />                          {/* client, always interactive */}
      <FeatureResultsServer filters={filters} />  {/* self-contained, owns Suspense */}
    </div>
  )
}
```

### Pattern 3: Detail Page (multiple independent sections)
Same as Pattern 1 — each section is self-contained. Page just composes them with `id` prop.

### Pattern 4: Promise Streaming with use()
Embedded in all patterns. Server creates promise (NOT awaited), client unwraps with `use()`.

### Pattern 5: Hybrid — use() + useInfiniteQuery
Server fetches page 1 via `use()`, client fetches pages 2+ via `useInfiniteQuery`. Only for infinite scroll / load-more.

---

## Cache Tiers

| Tier | Directive | Cookies? | Caller | Use when |
|------|-----------|----------|--------|----------|
| Public | `'use cache'` | No | `getPublicORPCCaller()` | Shared across all users |
| User-scoped | `'use cache: private'` | Yes | `getORPCCaller()` | Per-user cacheable data |
| Dynamic | No directive | Yes | `getORPCCaller()` | Must be fresh every request |

cacheLife: `'minutes'` (feeds), `'hours'` (content), `'days'` (static). Custom: `cacheLife({ stale: 60 })`.

---

## Loading States

| Trigger | Show | Never do |
|---------|------|----------|
| First page load | Skeleton (Suspense fallback) | — |
| Filter/search change | Pending dim (`opacity-50` + spinner) | Skeleton swap |
| Pagination | Loader at bottom | Remove existing items |
| After mutation | Optimistic update + `router.refresh()` | Full page reload |

### Filter changes with nuqs
```tsx
const [isPending, startTransition] = useTransition()
const [filters, setFilters] = useQueryStates(featureParsers, {
  shallow: false,       // triggers RSC re-render
  startTransition,      // wraps in transition — stale content stays visible
})
```

---

## Mutations

```tsx
// Server-side (in oRPC procedure): updateTag('feature')
// Client-side (after mutation): router.refresh()
// NEVER: invalidateQueries
```

---

## State Management

```
Server state (95%)   -> oRPC + RSC + 'use cache' + cacheTag
URL state (most UI)  -> nuqs (filters, search, tabs, pagination, sort)
Local state (simple) -> useState (dropdown open, focus, animation)
Shared ephemeral     -> Zustand (RARE: multi-select, drag, undo, cart)
```

Rule: if a PM would say "why can't I share this link?", it belongs in nuqs, not Zustand.

---

## Monetization

- Backend returns `{ items, isFree, totalAvailable }`, never throws for plan limits
- `usePlan()` hook for UI-level gating, `isFree` prop for data-level gating
- Shared: `<UpgradeWall>`, `<UpgradeDialog>` from `features/_shared/components`

---

## Top 20 Gotchas (ranked by cost when violated)

### Build Breakers
1. `getORPCCaller()` in `'use cache'` (non-private) — calls `cookies()`, build error. Use `getPublicORPCCaller()`.
2. `export const dynamic` / `export const revalidate` — dead with cacheComponents. Delete them.
3. `revalidateTag('tag')` without `'max'` — errors in Next.js 16. Always `revalidateTag('tag', 'max')`.

### UX Destroyers
4. `key={filtersKey}` on Suspense — destroys all children. Search loses focus, scroll resets. Use `startTransition`.
5. Filters inside Suspense — filter bar flashes as skeleton on every change.
6. `shallow: true` (nuqs default) — URL updates but server data stays stale. Set `shallow: false`.
7. `await` in server bridge component — defeats streaming. Create promise, pass down, `use()` unwraps.
8. `isFetching` skeleton swap — replaces visible content with skeleton. Use `keepPreviousData` or pending dim.
9. Error toasts for plan-limited actions — makes app feel broken. Show upgrade CTAs.

### Performance Killers
10. `useQuery` without `initialData` for data available at page load — unnecessary loading spinner.
11. `invalidateQueries` as primary cache strategy — server cache isn't busted. Use `updateTag()`.
12. `router.refresh()` without `updateTag()` — re-renders but reads stale cache.
13. N+1 queries — collect IDs first, then `.in('id', ids)`.

### Auth Violations
14. `getSession()` / `getUser()` — always `getClaims()` server-side.
15. Query `auth.users` on client — use `profiles` table or oRPC procedures.

### Code Quality
16. Copy query data into `useState` via `useEffect` — derive from props or `use()`.
17. `useState` for form fields — use React Hook Form + Zod.
18. Raw `z.string()` for user input — use `SecureShortText`, `SecureLongText` etc.
19. `any` / `@ts-ignore` / `as unknown as X` — use `unknown`, proper types.
20. `createAdminClient()` in feature code — go through oRPC procedures.

---

## Pattern Index (planner reference)

| Pattern | File | Select when |
|---------|------|-------------|
| URL state (nuqs) | `url-state-pattern.md` | Filters, search, tabs, pagination |
| Loading states | `loading-states-pattern.md` | Filters, multiple async sections |
| DataTable | `datatable-pattern.md` | Tabular data with sort/filter |
| Kanban | `kanban-pattern.md` | Workflow boards with drag |
| DnD | `dnd-pattern.md` | Reorderable lists (not kanban) |
| Optimistic | `optimistic-pattern.md` | Toggle, like, reorder |
| Virtual scroll | `virtual-scroll-pattern.md` | 500+ items |
| Multi-step form | `multistep-form-pattern.md` | 3+ step wizards |
| Client state | `client-state-pattern.md` | Shared ephemeral state (RARE) |
| Forms | `form-pattern.md` | React Hook Form + Zod |
