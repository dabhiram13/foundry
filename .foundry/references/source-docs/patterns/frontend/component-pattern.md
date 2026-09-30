# Component Pattern — Skeletons

Extracted from `webapp/features/stripe/components/` and `webapp/features/posts/components/`.

## Cached Server Component (PREFERRED — use for most data display)
```tsx
// Server component — no 'use client', no hooks, no JS shipped to browser
import { cacheTag, cacheLife } from 'next/cache'
import { getORPCCaller } from '@/lib/orpc/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export async function {Feature}Card() {
  "use cache: private"          // user-scoped (or "use cache" for public)
  cacheTag("{feature}")
  cacheLife("minutes")

  const caller = await getORPCCaller()
  const data = await caller.protected.{feature}.get({})
  if (!data) return null
  return /* Card with CardHeader + CardContent */
}
// Wrap in <Suspense fallback={<{Feature}Skeleton />}> at the page level
```

## Client Component (ONLY for interactive/client-managed state)
Use only when you need: infinite scroll, real-time SSE, interactive search, or client-driven state.
```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { {Feature}Skeleton } from './{feature}-skeleton'

export function {Feature}Card() {
  const { data, isLoading, isError, error } = useQuery(
    orpc.protected.{feature}.get.queryOptions()
  )
  if (isLoading) return <{Feature}Skeleton />
  if (isError) return /* error state: text-sm text-destructive */
  if (!data) return null
  return /* Card with CardHeader + CardContent */
}
```

## List Item Card
```tsx
'use client'
interface {Feature}CardProps { item: {Feature}Item; index: number }

export function {Feature}Card({ item, index }: {Feature}CardProps) {
  return /* article.rounded-lg.border.bg-card.p-4.shadow-sm → h3 + p.text-muted-foreground */
}
```

## Skeleton
```tsx
import { Skeleton } from '@/components/ui/skeleton'
export function {Feature}Skeleton({ count = 3 }: { count?: number }) {
  return /* grid of Skeleton placeholders matching content layout */
}
```

## Infinite Scroll List
```tsx
'use client'
import { use } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { client, orpc } from '@/lib/orpc/client'
import { useInfiniteScroll } from '@/features/_shared/hooks'
import { InfiniteScrollLoader } from '@/features/_shared/components'

export function {Feature}List({ filters, firstPagePromise }: Props) {
  const firstPage = use(firstPagePromise)
  // useInfiniteQuery with queryKey: [...orpc.protected.{feature}.list.key(), { filters }]
  // initialData from firstPage, getNextPageParam from lastPage.hasMore
  // useInfiniteScroll for sentinel ref
  // Render: results count → error state → empty state → items grid → loader → sentinel
}
```

## Rules
1. ALWAYS add `'use client'` to interactive components
2. Use `orpc.protected.{feature}.{action}.queryOptions()` for useQuery
3. Use `client.protected.{feature}.{action}()` for direct calls (mutations, infinite query)
4. Import UI primitives from `@/components/ui/`
5. Use Tailwind classes — no CSS modules, no styled-components
6. Loading states use Skeleton component
7. Error states show destructive-colored message
8. Empty states show centered message with icon
