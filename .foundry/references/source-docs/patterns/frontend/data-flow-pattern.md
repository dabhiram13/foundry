# Data Flow Pattern — oRPC + RSC + Client Hydration

The definitive data flow architecture. Every feature MUST follow these patterns.

## Two Data Paths

| Path | Used by | Transport | Caching |
|------|---------|-----------|---------|
| oRPC server caller | Server Components, `data.ts` | In-process (no HTTP) | `'use cache'` + `cacheLife` + `cacheTag` |
| oRPC HTTP client | Client Components | POST `/api/rpc` | TanStack Query (`staleTime`, `gcTime`) |

**Key rule**: Server components use oRPC callers (no HTTP). Client components use oRPC HTTP client. Never mix.

## oRPC Callers — Which One When

| Caller | Safe in `'use cache'`? | Has user context? | Use for |
|--------|----------------------|-------------------|---------|
| `getPublicORPCCaller()` | YES | No | Public procedures in `'use cache'` |
| `getORPCCaller()` | Only `'use cache: private'` | Yes | Protected/admin procedures |

```tsx
// Public data — safe in 'use cache' (no cookies)
import { getPublicORPCCaller } from '@/lib/orpc/server'
const caller = getPublicORPCCaller()
await caller.public.ideas.list({ page: 1 })

// Authenticated data — needs cookies
import { getORPCCaller } from '@/lib/orpc/server'
const caller = await getORPCCaller()
await caller.protected.swarm.getWaitlistStatus()
await caller.admin.dashboard.getMetrics()
```

## Data Functions (`data.ts`)

### Public Data — `'use cache'` + `getPublicORPCCaller()`

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

### Authenticated Data (cacheable) — `'use cache: private'` + `getORPCCaller()`

```tsx
import { cacheTag, cacheLife } from 'next/cache'
import { getORPCCaller } from '@/lib/orpc/server'

export async function fetchMyPurchases() {
  'use cache: private'
  cacheLife({ stale: 60 })
  cacheTag('my-purchases')
  const caller = await getORPCCaller()
  return caller.protected.billing.getMyPurchases()
}
```

### Authenticated Data (must be fresh) — no directive + `getORPCCaller()`

```tsx
import { getORPCCaller } from '@/lib/orpc/server'

export async function fetchWaitlistStatus() {
  const caller = await getORPCCaller()
  return caller.protected.swarm.getWaitlistStatus()
}
```

### Dynamic Context — `'use cache: remote'` + `getPublicORPCCaller()`

```tsx
import { cacheTag, cacheLife } from 'next/cache'
import { getPublicORPCCaller } from '@/lib/orpc/server'

export async function fetchBatchMetrics(ids: string[]) {
  'use cache: remote'
  cacheLife({ expire: 3600 })
  cacheTag('batch-metrics')
  const caller = getPublicORPCCaller()
  return caller.public.metrics.getBatch({ ids })
}
```

## CRITICAL: What Goes Where

| Data type | `'use cache'` variant | Caller | Router |
|-----------|----------------------|--------|--------|
| Public, same for everyone | `'use cache'` | `getPublicORPCCaller()` | `caller.public.*` |
| Authenticated, cacheable | `'use cache: private'` | `getORPCCaller()` | `caller.protected.*` |
| Authenticated, must be fresh | No directive | `getORPCCaller()` | `caller.protected.*` |
| Admin, cacheable | `'use cache: private'` | `getORPCCaller()` | `caller.admin.*` |
| Dynamic context, public | `'use cache: remote'` | `getPublicORPCCaller()` | `caller.public.*` |

---

## Pattern 1: Simple Page (No Filters/Pagination)

```tsx
// webapp/app/protected/{feature}/page.tsx
import { Suspense } from 'react'

export default function FeaturePage() {
  return (
    <>
      <h1>Feature</h1>
      <Suspense fallback={<FeatureSkeleton />}>
        <FeatureContentServer />
      </Suspense>
    </>
  )
}
```

Server component awaits data, passes as props:

```tsx
// webapp/features/{feature}/components/{feature}-server.tsx
import { connection } from 'next/server'
import { fetchFeatureData } from '../data'

export async function FeatureContentServer() {
  await connection()
  const data = await fetchFeatureData()
  return <FeatureClient initialData={data} />
}
```

## Pattern 2: Granular Suspense (Multiple Independent Sections)

Each section fetches its own data, streams independently:

```tsx
// webapp/app/protected/{feature}/[id]/page.tsx
export default async function DetailPage({ params }: Props) {
  const { id } = await params
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderServer id={id} />
      </Suspense>

      <Suspense fallback={<DetailsSkeleton />}>
        <DetailsServer id={id} />
      </Suspense>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsServer id={id} />
      </Suspense>
    </>
  )
}
```

Each server component has its own `'use cache'` with independent TTL:

```tsx
export async function StatsServer({ id }: { id: string }) {
  'use cache: private'
  cacheLife('hours')
  cacheTag(`feature-stats-${id}`)
  const caller = await getORPCCaller()
  const stats = await caller.protected.feature.getStats({ id })
  return <StatsDisplay stats={stats} />
}
```

**Result**: header streams in first, then details, then stats — all independently, with separate cache lifetimes.

## Pattern 3: Promise Streaming with `use()` Hook

For client components that need interactivity but server-fetched initial data:

**Step 1** — Server component starts fetches as promises (do NOT await):

```tsx
export async function ResultsServer({ filters }: Props) {
  const dataPromise = fetchFeaturePage(filters, 1)
  const statsPromise = fetchFeatureStats(filters)

  return (
    <ResultsClient
      dataPromise={dataPromise}
      statsPromise={statsPromise}
    />
  )
}
```

**Step 2** — Client component unwraps with `use()`:

```tsx
'use client'
import { use } from 'react'

export function ResultsClient({ dataPromise, statsPromise }: Props) {
  const data = use(dataPromise)    // Suspends until resolved
  const stats = use(statsPromise)  // Suspends until resolved

  // Full interactivity: useState, handlers, etc.
  return <div>...</div>
}
```

**When to use `use()`**: When the client component needs both server data AND interactivity (useState, event handlers, useInfiniteQuery for pagination).

## Pattern 4: Hybrid — `use()` First Load + oRPC for Pagination

Server fetches page 1, client fetches pages 2+:

```tsx
// Server Component
export async function ListServer({ filters }: Props) {
  const firstPagePromise = fetchFeaturePage(filters, 1)
  return <ListClient filters={filters} firstPagePromise={firstPagePromise} />
}
```

```tsx
// Client Component
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

**Use `useInfiniteQuery` when**: infinite scroll, load-more buttons. NOT for simple lists.

## NEVER Do

- `getORPCCaller()` inside `'use cache'` (non-private) — calls `cookies()`, breaks build
- `createAdminClient()` in feature code — go through oRPC procedures instead
- `client.protected.*` from server components — no cookie forwarding
- `useQuery` without `initialData` for data available at page load — causes loading spinners
- Copy server data into `useState` via `useEffect` — derive from props or `use()`
- Put a client component with data-dependent props in a static page shell — move it inside a server component that fetches the data
- Create data normalization helpers without exporting them — designer needs `fieldToItemKey()`, `resolveDateRange()`, etc. Export from utils or types/index.ts

## Cache Invalidation (via .actionable() Server Actions)

All mutations use `.actionable()` server actions with `cacheInvalidator()` interceptor:

```tsx
// features/{feature}/actions.ts — server action
'use server'
import { update as updateProcedure } from '@/lib/orpc/procedures/{feature}'
import { buildActionContext, cacheInvalidator } from '@/lib/orpc/action-utils'

export const updateAction = updateProcedure.actionable({
  context: buildActionContext,
  interceptors: [cacheInvalidator<{ success: boolean }>('feature')],
})
```

```tsx
// Client-side mutation hook
const router = useRouter()
const mutation = useMutation({
  mutationFn: async (input) => {
    const [error, data] = await updateAction(input)
    if (error) throw error
    return data
  },
  onSuccess: () => router.refresh(),
})
```

## Decision Tree

```
Is data the same for all users?
├─ YES → 'use cache' + getPublicORPCCaller() → caller.public.*
│         Does client need interactivity?
│         ├─ YES → use() promise pattern or initialData prop
│         └─ NO  → render directly in server component
└─ NO  → Is it cacheable (stale OK for 30s+)?
          ├─ YES → 'use cache: private' + getORPCCaller() → caller.protected.*
          └─ NO  → No directive + getORPCCaller() → caller.protected.*

Does the page need pagination/infinite scroll?
├─ YES → Hybrid: use() for page 1 + useInfiniteQuery for pages 2+
└─ NO  → Server component awaits + passes as props

Does the user need to see their own writes immediately?
├─ YES → updateTag('tag') in server action
└─ NO  → revalidateTag('tag', 'max') for eventual consistency
```
