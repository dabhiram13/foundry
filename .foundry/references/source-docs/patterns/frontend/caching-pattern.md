# Caching Pattern — The 5 Types in Next.js 16

All data goes through oRPC. Never use `createAdminClient()` or `createClient()` directly in feature code.

## 1. `'use cache'` — Public/Build-Time Cache

Shared across ALL users. Cannot access `cookies()`, `headers()`.

**When**: Public data — ideas list, landing page, published content.

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

**Rules**:
- NO `cookies()`, `headers()`, `searchParams`
- NO `getORPCCaller()` — it calls `cookies()` internally
- USE `getPublicORPCCaller()` — no cookies, safe in cache scope
- Only calls `caller.public.*` procedures

## 2. `'use cache: private'` — Per-User Cache

Cached per user. CAN access `cookies()`. Not shared across users.

**When**: User-specific data where caching is valuable — purchases, profile, dashboard, any authenticated data.

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

**Rules**:
- Requires `cacheLife({ stale: N })` with minimum 30 seconds
- Can use `getORPCCaller()` — cookies allowed here
- Calls `caller.protected.*` or `caller.admin.*` procedures
- Stored per-user on the client side

## 3. `'use cache: remote'` — Server-Side Runtime Cache

Cached on the server (Redis/KV). Shared across users. Works in dynamic contexts where regular `'use cache'` would fail.

**When**: Expensive queries already in a dynamic context — batch aggregations, computed metrics.

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

**Rules**:
- Use `expire` (not `stale`) for TTL
- Cannot access user-specific data safely
- Use for data already in a dynamic context

## 4. `cacheLife()` — TTL Profiles

Controls how long cached data lives. Works with all three `'use cache'` variants.

### Built-in Profiles

| Profile | Stale | Revalidate | Expire | Use for |
|---------|-------|------------|--------|---------|
| `'default'` | 5min | — | 15min | General |
| `'minutes'` | 5min | 1min | 1hr | Frequently changing data |
| `'hours'` | 5min | 1hr | 1day | Public content, ideas |
| `'days'` | 5min | 1day | 1week | Rarely changing data |
| `'weeks'` | 5min | 1week | 1month | Near-static content |
| `'max'` | 5min | — | Max | Truly static content |

### Custom Profiles

```tsx
cacheLife({ stale: 60 })        // 1 min — dashboard metrics (private)
cacheLife({ stale: 3600 })      // 1 hour — user profile (private)
cacheLife({ expire: 3600 })     // 1 hour server TTL — batch queries (remote)
cacheLife({
  stale: 3600,       // 1 hour serve stale while revalidating
  revalidate: 7200,  // 2 hours background revalidation
  expire: 86400,     // 1 day hard expiration
})
```

## 5. `cacheTag()` + Invalidation — The Full Lifecycle

Tags enable surgical invalidation of specific cache entries.

### Tagging Convention

```
cacheTag('ideas')                              // all ideas
cacheTag('ideas', `ideas-page-${page}`)        // specific page
cacheTag(`idea-${slug}`)                       // specific idea
cacheTag('my-purchases')                       // user's purchases (private)
cacheTag('purchases', `purchases-${userId}`)   // specific user's purchases
```

### Three Invalidation Methods

| Method | Where | Behavior | Use case |
|--------|-------|----------|----------|
| `updateTag('tag')` | Server Actions only | Immediate expiration | Read-your-own-writes |
| `revalidateTag('tag', 'max')` | Server Actions + Route Handlers | Stale-while-revalidate | Background/eventual consistency |
| `refresh()` | Server Actions only | Invalidates client router cache | Force UI to re-render |

**IMPORTANT**: Always use `revalidateTag('tag', 'max')` — omitting `'max'` will error in Next.js 16.

### Full Lifecycle Example (using .actionable())

```tsx
// features/ideas/actions.ts
'use server'
import { publish as publishProcedure } from '@/lib/orpc/procedures/ideas'
import { buildActionContext, cacheInvalidator } from '@/lib/orpc/action-utils'

export const publishIdeaAction = publishProcedure.actionable({
  context: buildActionContext,
  interceptors: [cacheInvalidator<{ success: boolean }>('ideas')],
})
```

Client-side mutation hook:

```tsx
const router = useRouter()
const publish = useMutation({
  mutationFn: async (input: { id: string }) => {
    const [error, data] = await publishIdeaAction(input)
    if (error) throw error
    return data
  },
  onSuccess: () => router.refresh(),
})
```

## Decision Matrix

```
Is the data the same for all users?
├─ YES → Is it in a dynamic context (after connection(), cookies)?
│         ├─ YES → 'use cache: remote'  + getPublicORPCCaller() → caller.public.*
│         └─ NO  → 'use cache'          + getPublicORPCCaller() → caller.public.*
└─ NO  → Is it cacheable (stale OK for 30s+)?
          ├─ YES → 'use cache: private'  + getORPCCaller() → caller.protected.*
          └─ NO  → No directive          + getORPCCaller() → caller.protected.*

Does the user need to see their own writes immediately?
├─ YES → updateTag('tag') + refresh()           (Server Action)
└─ NO  → revalidateTag('tag', 'max')            (eventual consistency)
```

## What's NOT Cached with Next.js Cache

- **oRPC HTTP calls from client components** — use TanStack Query (`staleTime: 30_000`)
- **Mutations** — always bypass cache, then invalidate with `updateTag()`
- **JWT-only operations** — so fast they don't need caching

## Common Mistakes

| Mistake | Why it breaks | Fix |
|---------|---------------|-----|
| `getORPCCaller()` in `'use cache'` | Calls `cookies()` — build error | Use `getPublicORPCCaller()` for public data |
| `createAdminClient()` in feature code | Bypasses oRPC validation/mapping | Go through oRPC procedures |
| No `cacheTag()` | Can't invalidate — stale forever until TTL | Always tag |
| `revalidateTag('tag')` without `'max'` | Errors in Next.js 16 | Always `revalidateTag('tag', 'max')` |
| `useQuery` without `initialData` | Loading spinner on first render | Pass server data as `initialData` |
| `invalidateQueries()` after mutation | Doesn't clear server cache | Use `.actionable()` with `cacheInvalidator()` + `router.refresh()` |
| `updateTag()` inside oRPC handler | 500 error — wrong context | Use `.actionable()` server action with interceptor |
| `client.*` for mutations | No server cache invalidation | Use `.actionable()` server actions |
| `cacheInvalidator<Type>('tag')` | Type error — interceptor is polymorphic | Use `cacheInvalidator('tag')` without generic |
| `'use cache'` at file level (top of file) | Silently fails in Next.js 16 | Place directive as first line inside function body |
| `React.cache()` wrapping a `'use cache'` function | Redundant — `'use cache'` already deduplicates within render pass | Remove `React.cache()` wrapper |
