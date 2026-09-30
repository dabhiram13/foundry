# Frontend Architecture

How pages work: RSC, data fetching, caching, state management, loading states, gotchas. One file.

---

## Decision Tree (Read First)

```
Is data the same for all users?
+-- YES -> 'use cache' + getPublicORPCCaller() -> caller.public.*
|         Does client need interactivity?
|         +-- YES -> use() promise pattern or initialData prop
|         +-- NO  -> render directly in server component
+-- NO  -> Is it cacheable (stale OK for 30s+)?
          +-- YES -> 'use cache: private' + getORPCCaller() -> caller.protected.*
          +-- NO  -> No directive + getORPCCaller() -> caller.protected.*

Does the page need pagination/infinite scroll?
+-- YES -> Hybrid: use() for page 1 + useInfiniteQuery for pages 2+
+-- NO  -> Server component awaits + passes as props

Does the user need to see their own writes immediately?
+-- YES -> updateTag('tag') in server action + router.refresh()
+-- NO  -> revalidateTag('tag', 'max') for eventual consistency
```

---

## Cache Tiers

| Tier | Directive | Cookies? | Caller | Use when |
|------|-----------|----------|--------|----------|
| Public | `"use cache"` | No | `getPublicORPCCaller()` | Shared across all users |
| Shared + auth | `"use cache: remote"` | No | `getPublicORPCCaller()` | Expensive aggregations in dynamic context |
| User-scoped | `"use cache: private"` | Yes | `getORPCCaller()` | Per-user cacheable data |
| Dynamic | No directive | Yes | `getORPCCaller()` | Must be fresh every request |

### cacheLife Profiles

| Profile | Stale | Revalidate | Expire | Use for |
|---------|-------|------------|--------|---------|
| `'minutes'` | 5min | 1min | 1hr | Frequently changing |
| `'hours'` | 5min | 1hr | 1day | Public content |
| `'days'` | 5min | 1day | 1week | Rarely changing |
| `'max'` | 5min | — | Max | Truly static |

Custom: `cacheLife({ stale: 60 })` (private), `cacheLife({ expire: 3600 })` (remote).

---

## Two Data Paths

| Path | Used by | Transport | Caching |
|------|---------|-----------|---------|
| oRPC server caller | Server Components, `data.ts` | In-process (no HTTP) | `'use cache'` + `cacheLife` + `cacheTag` |
| oRPC HTTP client | Client Components | POST `/api/rpc` | TanStack Query (`staleTime`, `gcTime`) |

Server components use callers (no HTTP). Client components use HTTP client. Never mix.

---

## Data Functions (`data.ts`)

### Public data

```tsx
import { cacheTag, cacheLife } from 'next/cache'
import { getPublicORPCCaller } from '@/lib/orpc/server'

export async function fetchIdeasList(page: number = 1) {
  'use cache'
  cacheTag('ideas', `ideas-page-${page}`)
  cacheLife('hours')
  const caller = getPublicORPCCaller()
  return caller.public.ideas.list({ page })
}
```

### Authenticated data (cacheable)

```tsx
import { getORPCCaller } from '@/lib/orpc/server'

export async function fetchMyPurchases() {
  'use cache: private'
  cacheLife({ stale: 60 })
  cacheTag('my-purchases')
  const caller = await getORPCCaller()
  return caller.protected.billing.getMyPurchases()
}
```

### Authenticated data (must be fresh)

```tsx
export async function fetchWaitlistStatus() {
  const caller = await getORPCCaller()
  return caller.protected.swarm.getWaitlistStatus()
}
```

---

## Page Patterns

### Pattern 1: Self-Contained Components (THE default pattern)

Page.tsx is static — pure layout, ZERO data fetching. Each component that needs data is self-contained: owns its cache, skeleton, and client.

```tsx
// app/protected/{feature}/page.tsx — static, sync, dumb layout
export default function FeaturePage() {
  return (
    <>
      <h1>Feature</h1>
      <FeatureCardServer />      {/* self-contained */}
      <FeatureStatsServer />     {/* self-contained */}
      <StaticContent />          {/* no data, just renders */}
    </>
  )
}
```

Each server component internally:

```tsx
// features/{feature}/components/{feature}-card-server.tsx
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { getORPCCaller } from '@/lib/orpc/server'
import { FeatureCard } from './feature-card'
import { FeatureCardSkeleton } from './feature-card-skeleton'

async function getFeatureData() {
  'use cache: private'           // per-user | 'use cache' for public
  cacheLife('hours')
  const caller = await getORPCCaller()
  return caller.protected.feature.get()
}

export function FeatureCardServer() {
  const dataPromise = getFeatureData()   // NOT awaited — streams
  return (
    <Suspense fallback={<FeatureCardSkeleton />}>
      <FeatureCard dataPromise={dataPromise} />
    </Suspense>
  )
}
```

Client unwraps with `use()`:

```tsx
// features/{feature}/components/{feature}-card.tsx
'use client'
import { use } from 'react'

export function FeatureCard({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise)    // Suspense catches until resolved
  // useQuery/useMutation only if client needs revalidation or mutations
  return <div>{data.title}</div>
}
```

**Rules:**
- Server component is sync (exported), creates promise, wraps client in Suspense
- Data function has `'use cache: private'` (per-user) or `'use cache'` (public)
- Client uses `use()` to unwrap — Suspense fallback shows skeleton while streaming
- Each component is independent — parallel streaming, no waterfall
- Skeleton must be pixel-perfect match of the rendered component

### Pattern 2: List Page with Filters (PPR)

```tsx
// app/protected/{feature}/page.tsx — dumb layout, no Suspense, no data fetching
import { createSearchParamsCache } from 'nuqs/server'
import { featureParsers } from '@/lib/search-params/feature'

const cache = createSearchParamsCache(featureParsers)

export default async function FeaturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = await cache.parse(searchParams)
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feature</h1>
        <p className="text-muted-foreground mt-1">Description.</p>
      </div>
      {/* Filters -- client component, always interactive, never skeleton */}
      <FeatureFilters />
      {/* Results -- self-contained server component (owns its own Suspense) */}
      <FeatureResultsServer filters={filters} />
    </div>
  )
}
```

The server component owns its Suspense, same as Pattern 1:

```tsx
// features/{feature}/components/feature-results-server.tsx
import { Suspense } from 'react'
import { FeatureResultsClient } from './feature-results-client'
import { FeatureResultsSkeleton } from './feature-results-skeleton'
import { getFeatureResults } from './feature-results-data'

export function FeatureResultsServer({ filters }: Props) {
  const dataPromise = getFeatureResults(filters)
  return (
    <Suspense fallback={<FeatureResultsSkeleton />}>
      <FeatureResultsClient dataPromise={dataPromise} />
    </Suspense>
  )
}
```

### Pattern 3: Detail Page (multiple self-contained sections)

Same as Pattern 1 — each server component is self-contained. Page just composes them.

```tsx
// app/protected/{feature}/[id]/page.tsx — static layout
export default async function DetailPage({ params }: Props) {
  const { id } = await params
  return (
    <>
      <HeaderServer id={id} />     {/* own cache, own skeleton, own client */}
      <DetailsServer id={id} />    {/* own cache, own skeleton, own client */}
      <StatsServer id={id} />      {/* own cache, own skeleton, own client */}
    </>
  )
}
```

Each server component follows Pattern 1: sync export → `getXxx()` promise (not awaited) → `<Suspense fallback={<Skeleton />}>` → `<Client dataPromise={promise} />`. Independent TTLs, parallel streaming, no waterfall.

### Pattern 4: Promise Streaming with `use()` (embedded in all patterns)

This is NOT a separate pattern — it's HOW every server→client handoff works.
See Pattern 1 for the complete example. The rule: server creates promise (NOT awaited), client unwraps with `use()`, Suspense catches the suspension.
```

### Pattern 5: Hybrid — `use()` + useInfiniteQuery

Server fetches page 1, client fetches pages 2+:

```tsx
'use client'
import { use } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { client } from '@/lib/orpc/client'

export function ListClient({ filters, firstPagePromise }: Props) {
  const firstPage = use(firstPagePromise)

  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['feature', JSON.stringify(filters)],
    queryFn: ({ pageParam }) =>
      client.protected.feature.list({ ...filters, page: pageParam }),
    initialData: { pages: [firstPage], pageParams: [1] },
    initialPageParam: 1,
    getNextPageParam: (last, _, lastParam) => last.hasMore ? lastParam + 1 : undefined,
    staleTime: 30_000,
  })

  return <div>...</div>
}
```

Use `useInfiniteQuery` for infinite scroll / load-more. NOT for simple lists.

---

## Components

### Self-Contained Server Component (THE standard)

Three files per data-driven component: server wrapper, data function, client.

```tsx
// features/{feature}/components/{feature}-card-server.tsx
// Sync export — creates promise, wraps client in Suspense
import { Suspense } from 'react'
import { FeatureCard } from './feature-card'
import { FeatureCardSkeleton } from './feature-card-skeleton'
import { getFeatureData } from './feature-card-data'

export function FeatureCardServer() {
  const dataPromise = getFeatureData()
  return (
    <Suspense fallback={<FeatureCardSkeleton />}>
      <FeatureCard dataPromise={dataPromise} />
    </Suspense>
  )
}
```

```tsx
// Data function — cached, separate or inline in server file
import { cacheLife, cacheTag } from 'next/cache'
import { getORPCCaller } from '@/lib/orpc/server'

export async function getFeatureData() {
  'use cache: private'       // per-user | 'use cache' for public
  cacheTag('feature')
  cacheLife('hours')
  const caller = await getORPCCaller()
  return caller.protected.feature.get()
}
```

```tsx
// features/{feature}/components/{feature}-card.tsx
'use client'
import { use } from 'react'

export function FeatureCard({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise)    // Suspense catches until resolved
  // useMutation for writes, useQuery ONLY if client needs revalidation
  return /* Card */
}
```

### Client-Only Component (rare — only for interactivity that can't be server-rendered)

Only when you need: infinite scroll, real-time SSE, interactive search with debounce.

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc/client'

export function FeatureCard() {
  const { data, isLoading } = useQuery(
    orpc.protected.feature.get.queryOptions()
  )
  if (isLoading) return <FeatureSkeleton />
  return /* Card */
}
```

### Skeleton

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function FeatureResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3 animate-in fade-in-0 duration-500"
          style={{ animationDelay: `${i * 75}ms` }}>
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}
```

Skeletons match only data content — never filters or toolbar.

---

## Hooks

### Mutation Hook

```typescript
'use client'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/lib/orpc/client'

export function useFeatureMutations() {
  const router = useRouter()
  const create = useMutation({
    mutationFn: (data) => client.protected.feature.create(data),
    onSuccess: () => router.refresh(), // server re-renders with fresh cache
  })
  return { create }
}
```

### Query Hook (rare — prefer server components)

Only for infinite scroll, real-time SSE, interactive search.

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc/client'

export function useFeature() {
  return useQuery(orpc.protected.feature.get.queryOptions())
}
```

---

## Loading States

### The Rule

Filters, search bars, toolbars stay OUTSIDE `<Suspense>` — always interactive.
Dynamic data (cards, rows, table body) goes INSIDE `<Suspense>`.

| Trigger | Show | Why |
|---------|------|-----|
| First page load | Skeleton (Suspense fallback) | No data yet |
| Filter/search change | Pending dim (`opacity-50` + spinner) | Stale content visible while loading |
| Pagination (infinite scroll) | Loader at bottom | Existing items stay |
| Mutation success | Optimistic update then `router.refresh()` | Keep UI responsive |

### Pending State with nuqs

```tsx
'use client'
import { useQueryStates } from 'nuqs'
import { useTransition } from 'react'

export function FeatureFilters() {
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useQueryStates(featureParsers, {
    shallow: false,       // triggers RSC re-render
    startTransition,      // wraps URL update in transition
  })

  return (
    <div className="flex items-center gap-3">
      <Input
        value={filters.q}
        onChange={(e) => setFilters({ q: e.target.value, page: 1 })}
      />
      {isPending && <Spinner />}
    </div>
  )
}
```

`shallow: false` + `startTransition` makes nuqs trigger a server re-render inside a React transition. Suspense does NOT re-mount — React keeps stale content visible while streaming.

### When `key={}` on Suspense IS correct

- Route-level navigation (different page)
- Tab panels with different server components and different data shapes
- NOT for filter/search changes within the same view

---

## State Management

```
Server state (95% of data)
  -> oRPC procedures + RSC data fetching ('use cache' + cacheTag)
  -> TanStack Query for client interactivity (useQuery/useMutation)

URL state (most client interactivity)
  -> nuqs (filters, search, tabs, pagination, sort, modals, wizard steps)

Local component state (simple toggles)
  -> useState (dropdown open, input focus, animation state)

Shared ephemeral client state (RARE)
  -> Zustand (multi-select, drag state, undo stack, cart, presence)
  -> One store per feature, selectors always, client-only
```

**Rule of thumb**: if a PM would say "why can't I share this link?", it belongs in nuqs, not Zustand.

### When to use Zustand (ALL THREE must be true)

1. **Shared** — 2+ distant components need read/write (not parent-child)
2. **Ephemeral** — resets on refresh (NOT filters, tabs, pagination)
3. **Complex** — nested objects, arrays, computed derivations (not a single boolean)

Examples: kanban drag state, multi-select across list, real-time presence, undo/redo stack.

---

## Cache Invalidation

### Server-side (after DB write)

```tsx
'use server'
import { updateTag } from 'next/cache'

export async function publishIdea(id: string, slug: string) {
  await caller.admin.ideas.publish({ id })
  updateTag('ideas')          // bust list cache — immediate
  updateTag(`idea-${slug}`)   // bust detail cache — immediate
}
```

### Client-side (after mutation)

```tsx
const router = useRouter()
mutation.mutate(data, {
  onSuccess: () => router.refresh(), // re-renders server components with fresh cache
})
```

**No `invalidateQueries`** — mutations call `updateTag()` server-side, client calls `router.refresh()`.

**IMPORTANT**: Always `revalidateTag('tag', 'max')` — omitting `'max'` errors in Next.js 16.

---

## Gotchas

### Data

- **Server-first data fetching** — `useQuery` only for infinite scroll, real-time, interactive search
- **Derive values from query data directly** — never copy into `useState` via `useEffect`
- **No `any`** — use `unknown`, `Error` type, `Record<string, unknown>`
- **React Hook Form + Zod for all forms** — never `useState` for form fields

### Cache

- **`getORPCCaller()` in `'use cache'` (non-private)** — calls `cookies()`, build error. Use `getPublicORPCCaller()`
- **`createAdminClient()` in feature code** — go through oRPC procedures
- **`client.protected.*` from server components** — no cookie forwarding
- **No `cacheTag()`** — can't invalidate, stale forever until TTL
- **`revalidateTag('tag')` without `'max'`** — errors in Next.js 16
- **`useQuery` without `initialData`** — loading spinner on first render

### Cache Components Mode

- **No route segment configs** — never `export const dynamic`, `export const revalidate`. Dead with cacheComponents
- **Force dynamic with `connection()`** — `await connection()` to defer to request time
- **No runtime APIs inside `'use cache'`** — pass values as arguments instead
- **Default is dynamic** — only add `'use cache'` for data that should be cached

### Loading States

- **`key={filtersKey}` on Suspense destroys all children** — search loses focus, scroll resets
- **Filters inside Suspense = filter bar flashes as skeleton**
- **`shallow: true` (nuqs default) does NOT re-render server components** — set `shallow: false`
- **Don't `await` in server bridge components** — create promise, pass down, `use()` unwraps in client

### Auth

- **Never query `auth.users` on the client** — use `profiles` table
- **Never `getSession()` or `getUser()`** — always `getClaims()` server-side

### Error Boundaries

- **Every `<Suspense>` MUST be wrapped in an ErrorBoundary** — use `unstable_catchError` from `next/error` (Next.js 16 native). Route-level `error.tsx` is NOT enough — it catches the whole page, not individual sections.
- **Pattern**: `import ErrorBoundary from '@/features/{feature}/components/{feature}-error-boundary'` → `<ErrorBoundary title="..."><Suspense fallback={<Skeleton />}><Server /></Suspense></ErrorBoundary>`
- **Create with `unstable_catchError`**: `'use client'; import { unstable_catchError as catchError, type ErrorInfo } from 'next/error'; function Fallback(props: { title: string }, { error, unstable_retry }: ErrorInfo) { return <div>...</div> } export default catchError(Fallback)`
- **This is connector's responsibility**, not designer's. Designer styles the fallback.

### Mutations

- **No `invalidateQueries`** — `updateTag()` server-side + `router.refresh()` client-side
- **`useMutation` for loading/error** — never manual `useState(false)` + try/finally
