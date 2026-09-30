# Optimistic Updates Pattern

## When to Use

- User-initiated actions where the outcome is predictable (toggle, add to list, delete, reorder)
- Latency-sensitive interactions where waiting for server round-trip feels sluggish (likes, bookmarks, chat messages)
- Do NOT use for actions with complex server-side validation, payment flows, or operations that frequently fail

## Decision: useOptimistic vs TanStack onMutate

| Scenario | Use | Why |
|----------|-----|-----|
| Toggle state (like, bookmark, pin) | `useOptimistic` | Single boolean/enum flip, no cache to manage |
| Add item to server-rendered list | `useOptimistic` | List comes from RSC, no TanStack cache exists |
| Remove item from server-rendered list | `useOptimistic` | Same — list is server-rendered props |
| Complex cache with multiple query keys | TanStack `onMutate` | Need snapshot + rollback across cached queries |
| Reorder items (drag-and-drop) | TanStack `onMutate` | Position array in cache, rollback must restore order |
| Infinite scroll list mutations | TanStack `onMutate` | Data lives in `useInfiniteQuery` cache pages |

Rule of thumb: if the data source is a server component (via `"use cache"`), use `useOptimistic`. If data lives in TanStack Query cache (`useQuery`/`useInfiniteQuery`), use `onMutate`.

## React 19 useOptimistic

### API

```typescript
const [optimisticState, addOptimistic] = useOptimistic<TState, TAction>(
  passthrough,  // real server state — when this changes, optimistic state resets
  updateFn?     // (currentState, optimisticValue) => newState — omit to replace entirely
);
// addOptimistic(action) — MUST be called inside startTransition or form action
```

- When `passthrough` changes (after `router.refresh()`), React discards pending optimistic updates and uses the new value.
- `updateFn` is a reducer: receives accumulated state + action, returns new state. Supports multiple rapid calls.

### Pattern: Toggle

```tsx
'use client'
import { useOptimistic, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { client } from '@/lib/orpc/client'

// `bookmarked` comes from server component as prop
export function BookmarkButton({ postId, bookmarked }: { postId: string; bookmarked: boolean }) {
  const router = useRouter()
  const [optimisticBookmarked, setOptimisticBookmarked] = useOptimistic(bookmarked)

  async function toggle() {
    startTransition(async () => {
      setOptimisticBookmarked(!optimisticBookmarked)
      try {
        await client.protected.posts.toggleBookmark({ postId })
        router.refresh() // triggers updateTag() server-side → new passthrough value
      } catch {
        // No manual rollback needed — passthrough (original `bookmarked`) hasn't changed,
        // so when transition settles, React reverts to `bookmarked` prop value.
        // But if you need to show an error toast, do it here.
      }
    })
  }

  return (
    <button onClick={toggle} aria-pressed={optimisticBookmarked}>
      {optimisticBookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  )
}
```

### Pattern: Add to List

```tsx
'use client'
import { useOptimistic, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { client } from '@/lib/orpc/client'

type Comment = { id: string; content: string; author: string; createdAt: string }

// `comments` comes from server component
export function CommentList({ postId, comments }: { postId: string; comments: Comment[] }) {
  const router = useRouter()
  const [optimisticComments, addOptimisticComment] = useOptimistic<Comment[], Comment>(
    comments,
    (state, newComment) => [...state, newComment]
  )

  async function handleSubmit(content: string) {
    const tempId = `temp-${crypto.randomUUID()}`
    startTransition(async () => {
      addOptimisticComment({
        id: tempId,
        content,
        author: 'You',
        createdAt: new Date().toISOString(),
      })
      try {
        await client.protected.comments.create({ postId, content })
        router.refresh()
      } catch {
        // Transition fails → React reverts to `comments` prop (server state)
      }
    })
  }

  return (
    <>
      {optimisticComments.map((c) => (
        <div key={c.id} className={c.id.startsWith('temp-') ? 'opacity-70' : ''}>
          {c.content}
        </div>
      ))}
    </>
  )
}
```

### Pattern: Remove from List

```tsx
const [optimisticItems, removeOptimistic] = useOptimistic<Item[], string>(
  items,
  (state, removedId) => state.filter((item) => item.id !== removedId)
)

async function handleDelete(id: string) {
  startTransition(async () => {
    removeOptimistic(id)
    try {
      await client.protected.items.delete({ id })
      router.refresh()
    } catch {
      // Reverts automatically — `items` prop unchanged on error
    }
  })
}
```

### Pattern: Reorder (useOptimistic)

Only viable for simple server-rendered lists. For drag-and-drop with `@dnd-kit`, prefer TanStack `onMutate` below.

```tsx
const [optimisticItems, reorderOptimistic] = useOptimistic<
  Item[],
  { fromIndex: number; toIndex: number }
>(items, (state, { fromIndex, toIndex }) => {
  const next = [...state]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
})
```

## TanStack Query Optimistic (onMutate)

Use when data lives in TanStack Query cache (`useQuery`/`useInfiniteQuery`).

### Pattern: Cache Snapshot + Rollback

```typescript
'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc, client } from '@/lib/orpc/client'

export function useTogglePin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { itemId: string; pinned: boolean }) =>
      client.protected.items.togglePin(input),

    onMutate: async ({ itemId, pinned }) => {
      // 1. Cancel in-flight queries so they don't overwrite optimistic update
      const queryKey = orpc.protected.items.list.key()
      await queryClient.cancelQueries({ queryKey })

      // 2. Snapshot current cache
      const previous = queryClient.getQueryData<Item[]>(queryKey)

      // 3. Optimistically update cache
      queryClient.setQueryData<Item[]>(queryKey, (old) =>
        old?.map((item) =>
          item.id === itemId ? { ...item, pinned } : item
        )
      )

      // 4. Return snapshot for rollback
      return { previous }
    },

    onError: (_err, _vars, context) => {
      // 5. Rollback to snapshot on error
      if (context?.previous) {
        queryClient.setQueryData(orpc.protected.items.list.key(), context.previous)
      }
    },

    onSettled: () => {
      // 6. This project does NOT use invalidateQueries.
      // Server-side updateTag() already ran in the procedure.
      // If this component also needs server-rendered data refreshed:
      // router.refresh()
    },
  })
}
```

### Infinite Query Optimistic Update

For paginated data in `useInfiniteQuery`, `setQueryData` receives `InfiniteData<T>`:

```typescript
onMutate: async ({ itemId }) => {
  const queryKey = [...orpc.protected.items.list.key(), { filters }]
  await queryClient.cancelQueries({ queryKey })
  const previous = queryClient.getQueryData(queryKey)

  queryClient.setQueryData(queryKey, (old: InfiniteData<ItemPage> | undefined) => {
    if (!old) return old
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== itemId),
      })),
    }
  })

  return { previous }
},
```

## Reconciliation with Server Cache

Flow: oRPC procedure calls `updateTag("items")` --> client calls `router.refresh()` --> server components re-render with fresh data --> new props flow down --> `useOptimistic` passthrough updates --> optimistic state resets.

- **`useOptimistic`**: reconciles automatically when `passthrough` prop changes from `router.refresh()`.
- **TanStack `onMutate`**: `onSettled` is the reconciliation point. Since this project uses `router.refresh()` (not `invalidateQueries`), TanStack cache stays as-is after `onSettled`. It updates on next refetch (window focus, mount, or manual).
- **Do not mix both for the same data set.** If server-rendered parent has `useOptimistic` and child has TanStack cache, `router.refresh()` updates the parent but the child's cache is stale.

## Gotchas

- **`addOptimistic` must be called inside a transition** -- wrap in `startTransition(async () => { ... })`. Calling it outside a transition throws a runtime error.
- **`useOptimistic` resets when passthrough changes, not when the mutation succeeds** -- if `router.refresh()` is slow, optimistic state holds. If the prop never changes (bug in `updateTag`), optimistic state persists forever until next render with a new prop value.
- **Temp IDs in optimistic adds** -- use `crypto.randomUUID()` with a `temp-` prefix. Style temp items with `opacity-70` to signal pending state. Never use temp IDs in subsequent mutations before server confirms.
- **Multiple rapid mutations with `useOptimistic`** -- each `addOptimistic` call in a new `startTransition` is independent. The reducer receives accumulated state, so rapid toggles work correctly (each sees previous optimistic state).
- **`cancelQueries` is critical in TanStack `onMutate`** -- without it, an in-flight query response can land after `setQueryData` and overwrite your optimistic update.
- **`onMutate` return type must include snapshot** -- TypeScript infers `context` in `onError` from `onMutate`'s return value. Always return `{ previous }`.
- **Do not mix `invalidateQueries` with this project's pattern** -- `updateTag()` + `router.refresh()` is the invalidation mechanism. Adding `invalidateQueries` creates duplicate fetches and race conditions.
- **Error handling with `useOptimistic`** -- the automatic revert only works if the error is thrown inside the same `startTransition` async function. If you fire-and-forget (no `await`), the transition completes successfully and optimistic state reverts to passthrough immediately, before the mutation even finishes.