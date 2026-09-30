# Page Pattern — Skeletons

Extracted from `webapp/app/protected/posts/page.tsx` and the PPR pattern.

## Cache Tiers (decide FIRST for every data fetch)

| Tier | Directive | Cookies? | Use when |
|------|-----------|----------|----------|
| Public | `"use cache"` | No | No auth, shared across all users |
| Shared + auth | `"use cache: remote"` | Yes | Auth needed, data shareable |
| User-scoped | `"use cache: private"` | Yes | Per-user data |
| Dynamic | No directive | Yes | Must be fresh every request |

## PPR Page (List Features)
```tsx
// webapp/app/protected/{feature}/page.tsx
import { Suspense } from 'react'
import { createSearchParamsCache } from 'nuqs/server'
import { {feature}Parsers } from '@/lib/search-params/{feature}'
import { {Feature}Filters } from '@/features/{feature}/components'
import { {Feature}ResultsServer } from '@/features/{feature}/components'
import { {Feature}ResultsSkeleton } from '@/features/{feature}/components'

const cache = createSearchParamsCache({feature}Parsers)

interface {Feature}PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function {Feature}Page({ searchParams }: {Feature}PageProps) {
  const filters = await cache.parse(searchParams)
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{Feature}</h1>
        <p className="text-muted-foreground mt-1">Description.</p>
      </div>
      {/* Filters OUTSIDE Suspense — always interactive, never skeleton */}
      <{Feature}Filters />
      {/* Results INSIDE Suspense — skeleton on first load, pending dim on filter change */}
      <Suspense fallback={<{Feature}ResultsSkeleton />}>
        <{Feature}ResultsServer filters={filters} />
      </Suspense>
    </div>
  )
}
```
> **No `key={filtersKey}`** on Suspense for filter changes. nuqs `startTransition` keeps stale content visible while streaming. See `loading-states-pattern.md`.

## Cached Server Component (user-scoped data)
```tsx
// webapp/features/{feature}/components/{feature}-stats.tsx
import { cacheTag, cacheLife } from 'next/cache'
import { getORPCCaller } from '@/lib/orpc/server'

export async function {Feature}Stats() {
  "use cache: private"          // user-scoped — reads cookies, per-user cache
  cacheTag("{feature}-stats")
  cacheLife("minutes")

  const caller = await getORPCCaller()
  const stats = await caller.protected.{feature}.getStats({})
  return /* render stats */
}
```

## Cached Server Component (public data)
```tsx
// webapp/features/{feature}/components/{feature}-public-list.tsx
import { cacheTag, cacheLife } from 'next/cache'
import { getPublicORPCCaller } from '@/lib/orpc/server'

export async function {Feature}PublicList() {
  "use cache"                   // public — no cookies, CDN cache
  cacheTag("{feature}")
  cacheLife("hours")

  const caller = getPublicORPCCaller()  // no cookies — safe in 'use cache'
  const items = await caller.public.{feature}.list({})
  return /* render items */
}
```

## Server Component Bridge (creates promise, does NOT await)
```tsx
// webapp/features/{feature}/components/{feature}-results-server.tsx
import { fetch{Feature}Page } from '../data'
import { {Feature}ResultsClient } from './{feature}-results-client'

export async function {Feature}ResultsServer({ filters }: Props) {
  const firstPagePromise = fetch{Feature}Page(filters, 1)
  return <{Feature}ResultsClient filters={filters} firstPagePromise={firstPagePromise} />
}
```

## Simple Page (No Filters/Pagination)
```tsx
// webapp/app/protected/{feature}/page.tsx
import { Suspense } from 'react'
import { {Feature}Content, {Feature}Skeleton } from '@/features/{feature}/components'

export default function {Feature}Page() {
  // Static header → Suspense fallback={Skeleton} → Content (cached server component)
}
```

## Server-Side Data Fetching
```typescript
// webapp/features/{feature}/data.ts
// Choose cache tier based on data type:

// Public data — no cookies, safe in 'use cache'
export async function fetchPublic{Feature}() {
  "use cache"
  cacheTag("{feature}")
  cacheLife("hours")
  const caller = getPublicORPCCaller()
  return caller.public.{feature}.list({})
}

// User-scoped data — needs cookies
export async function fetch{Feature}Page(filters: Filters, page: number) {
  "use cache: private"
  cacheTag("{feature}", `{feature}-page-${page}`)
  cacheLife("minutes")
  const caller = await getORPCCaller()
  return caller.protected.{feature}.list({ ...filters, page })
}
```

## URL State (nuqs)
```typescript
// webapp/lib/search-params/{feature}.ts
// Define parsers once → reuse in createSearchParamsCache (RSC) and useQueryStates (client)
// See url-state-pattern.md for full API
```

## Mutation → Cache Invalidation
```typescript
// Inside oRPC procedure (server-side):
import { updateTag } from 'next/cache'

// After DB write:
updateTag("{feature}")  // busts all caches tagged with "{feature}"

// Client-side after mutation:
router.refresh()  // re-renders server components with fresh cache
```

## Rules
1. Page components are async Server Components (no 'use client')
2. **Decide cache tier FIRST** for every data fetch — document in decisions.md
3. **Filters OUTSIDE Suspense**, results INSIDE — see `loading-states-pattern.md`
4. **No `key={filtersKey}` on Suspense for filter changes** — use nuqs `startTransition` for pending dim. See `loading-states-pattern.md`.
5. Server component creates promise but does NOT await it (for list features)
6. Client component uses React 19 `use()` to unwrap
7. URL state via `nuqs` — define parsers in `lib/search-params/{feature}.ts`. See `url-state-pattern.md`.
8. Page files go in `webapp/app/protected/{feature}/page.tsx`
9. Loading skeleton: optional `loading.tsx` for route-level loading
10. **No `invalidateQueries`** — mutations call `updateTag()` server-side, client calls `router.refresh()`
11. **Page MUST own Suspense boundaries** — render `<ErrorBoundary><Suspense fallback={<Skeleton />}>...</Suspense></ErrorBoundary>` in page.tsx. NEVER delegate Suspense to CLIENT components. Delegation to SERVER components IS allowed for self-contained sections (e.g., ImportHistoryServer, NotificationListServer own their Suspense internally).
12. **Static page shells MUST NOT render client components with data-dependent props** — if a client component needs workspaceId, plan limits, counts, etc., it must live inside a server component that has that data.
13. **Every `<Suspense>` MUST be wrapped in an ErrorBoundary** — use `unstable_catchError` from `next/error` (Next.js 16 native). Users see blank screens on server fetch failure without this. This is a connector deliverable, not designer.
