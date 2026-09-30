# Hook Pattern — Skeletons

Extracted from `webapp/features/stripe/hooks/` and `webapp/features/posts/hooks/`.

## Simple Query Hook (only when client-side state is needed)
Use server components with `'use cache'` for standard data display. Only use `useQuery` when:
- Infinite scroll / client-managed pagination
- Real-time SSE subscriptions
- Interactive search/autocomplete with client-side state

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc/client'

export function use{Feature}() {
  return useQuery(orpc.protected.{feature}.get.queryOptions())
}
```

## Mutation Hook
```typescript
'use client'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { createAction, removeAction } from '../actions'  // 'use server' .actionable() exports

export function use{Feature}Mutations() {
  const router = useRouter()

  const create = useMutation({
    mutationFn: async (input: { title: string }) => {
      const [error, data] = await createAction(input)
      if (error) throw error
      return data
    },
    onSuccess: () => router.refresh(),
  })

  // Return { create, remove, update } as needed
  return { create }
}
```

## Infinite Query
Co-located in list component (see component-pattern.md). Uses `useInfiniteQuery` with `initialData` from server component's promise.

## Barrel Export
```typescript
// webapp/features/{feature}/hooks/index.ts
export { use{Feature}Mutations } from './use-{feature}-mutations'
```

## Rules
1. ALWAYS add `'use client'` directive
2. **Server-first data fetching** — prefer server components with `'use cache'` + `cacheTag()` over `useQuery`
3. Use `useQuery` / `useInfiniteQuery` ONLY for client-managed state (infinite scroll, real-time, interactive search)
4. **All mutations use `.actionable()` server actions** — call action, destructure `[error, data]`, throw on error
5. After mutation: `router.refresh()` in `onSuccess` — server cache already busted via `updateTag()` in action interceptor
6. **No `invalidateQueries`** — server-side `updateTag()` + `router.refresh()` handles cache
7. **No `client.*` for mutations** — use server actions from `features/{feature}/actions.ts`
8. Hook files named `use-{feature}.ts` / `use-{feature}-mutations.ts` (kebab-case)
9. Export from barrel `hooks/index.ts`
10. **Derive values from query data directly** — NEVER copy query data into `useState` via `useEffect`
