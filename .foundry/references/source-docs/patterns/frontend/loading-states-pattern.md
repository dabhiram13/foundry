# Loading States Pattern

## The Rule

Only dynamic data (cards, list rows, table body) goes inside `<Suspense>`. Filters, search bars, toolbars, and view toggles stay **outside** -- always interactive, never unmounted.

## Boundary Placement

```
WRONG (current posts page):
<Suspense key={filtersKey} fallback={<PostsGridSkeleton />}>
  <PostsResultsServer>            -- server bridge
    <PostsResultsClient>          -- client component
      <PostsFilters />            -- FILTERS INSIDE SUSPENSE (breaks on re-mount)
      <PostCard /> x N            -- data cards
    </PostsResultsClient>
  </PostsResultsServer>
</Suspense>
Problem: key={filtersKey} unmounts everything, filters flash as skeleton,
search loses focus, scroll resets.

CORRECT:
<FiltersBar />                    -- client, always interactive, never skeleton
<ResultsServer>                   -- self-contained: owns its own Suspense internally
  <Suspense fallback={<ResultsSkeleton />}>
    <ResultsClient>               -- cards/table only
      <PostCard /> x N
    </ResultsClient>
  </Suspense>
</ResultsServer>
```

## Skeleton vs Pending State

| Trigger | Show | Why |
|---------|------|-----|
| First page load | Skeleton (`Suspense` fallback) | No data yet, show layout shape |
| Filter/search change | Pending dim (`opacity-50` + spinner) | Data exists, show stale while loading fresh |
| Pagination (infinite scroll) | `<InfiniteScrollLoader />` at bottom | Existing items stay visible |
| Tab/view change (same data) | Instant swap, no loading | Client-side state, no fetch |
| Tab change (different data) | Skeleton | New data shape, nothing to dim |
| Mutation success | Optimistic update then `router.refresh()` | Keep UI responsive |

## Correct Page Architecture

Page is dumb layout — no Suspense, no data fetching. Each server component owns its own Suspense internally.

```tsx
// app/protected/{feature}/page.tsx — dumb layout, no Suspense, no data fetching
import { createSearchParamsCache } from 'nuqs/server'
import { featureParsers } from '@/lib/search-params/feature'
import { FeatureFilters } from '@/features/{feature}/components/feature-filters'
import { FeatureResultsServer } from '@/features/{feature}/components/feature-results-server'

const cache = createSearchParamsCache(featureParsers)

export default async function FeaturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = await cache.parse(searchParams)

  return (
    <div className="w-full space-y-6">
      {/* Static header -- renders instantly, zero JS */}
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

The server component owns its Suspense:

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

## Pending State with nuqs (preferred)

```tsx
// features/{feature}/components/feature-filters.tsx
'use client'
import { useQueryStates } from 'nuqs'
import { useTransition } from 'react'
import { featureParsers } from '@/lib/search-params/feature'

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
        placeholder="Search..."
      />
      <Select
        value={filters.category}
        onValueChange={(v) => setFilters({ category: v, page: 1 })}
      >
        {/* options */}
      </Select>
      {isPending && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}
    </div>
  )
}
```

Key: `shallow: false` + `startTransition` makes nuqs trigger a server re-render inside a React transition. The Suspense boundary does NOT re-mount -- React keeps showing stale content while the server streams the update.


## When key={} on Suspense IS Correct

- **Route-level navigation**: Navigating from `/posts` to `/settings` -- different page, skeleton is appropriate
- **Tab panels with different server components**: Each tab loads a completely different async component with different data shape
- **Initial load after hard navigation**: Browser navigates to `?category=tech` from a link -- Suspense fallback is fine for first paint
- **NOT for filter/search changes** within the same view. Use `startTransition` instead.

## Skeleton Component Rules

Skeletons match **only the data content** -- never filters or toolbar:

```tsx
// CORRECT -- skeleton for results grid only (filters are outside Suspense)
export function FeatureResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i}
            className="rounded-xl border bg-card p-5 space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

Never put `<Skeleton className="h-10 w-full" />` for the search bar in a results skeleton.

## Gotchas

- **`key={filtersKey}` on Suspense destroys all children.** Every child component unmounts and remounts. Search inputs lose focus. Scroll position resets. Filter dropdowns close. Use `startTransition` instead.
- **Filters inside Suspense = filter bar flashes as skeleton.** If `PostsFilters` renders inside the Suspense boundary, changing filters shows a skeleton where the filter bar was. Users lose their place.
- **`shallow: true` (nuqs default) does NOT re-render server components.** URL updates but server data is stale. Set `shallow: false` when filters drive server-side queries.
- **`startTransition` without `shallow: false` is useless for server data.** Both are required together: `shallow: false` triggers the RSC re-render, `startTransition` makes it non-blocking.
- **Do NOT `await` in the server bridge component.** `PostsResultsServer` creates the promise and passes it down. `use()` in the client component unwraps it. Awaiting defeats streaming.
- **Infinite scroll sentinel must be outside the pending-dimmed container.** If `pointer-events-none` covers the sentinel, IntersectionObserver still fires but user cannot scroll to trigger it naturally.
- **`router.refresh()` after mutations does NOT need Suspense key change.** It re-renders server components in-place. The Suspense boundary stays mounted, no skeleton flash.
- **Multiple Suspense boundaries are fine.** A page can have separate boundaries for sidebar stats vs main content. Each streams independently. Keep them granular.
