# Mutations and cache invalidation

Every mutation in this app is a procedure **plus** an `.actionable()` server action. The action is
not optional sugar: `updateTag()` cannot run inside the oRPC HTTP handler, so a mutation called over
HTTP leaves the server cache stale.

## Three files

```
webapp/lib/orpc/procedures/{feature}.ts   the procedure (see procedure-anatomy.md)
webapp/features/{feature}/actions.ts      'use server' — .actionable() wrappers
webapp/features/{feature}/hooks/index.ts  'use client' — useMutation calling the action
```

## The action file

```ts
// webapp/features/posts/actions.ts
'use server'

import { rename as renameProcedure } from '@/lib/orpc/procedures/posts'
import { buildActionContext, cacheInvalidator } from '@/lib/orpc/action-utils'

export const renameAction = renameProcedure.actionable({
  context: buildActionContext,
  interceptors: [cacheInvalidator('posts')],
})
```

- `buildActionContext` (`webapp/lib/orpc/action-utils.ts`) creates the Supabase client, calls
  `getClaims()`, and resolves `context.user` — the same identity path the HTTP handler uses.
- `cacheInvalidator('posts')` calls `updateTag('posts')` after the handler resolves, and only then.
  A thrown error skips it.
- The signature is `cacheInvalidator<T>(...tags: string[])` (`webapp/lib/orpc/action-utils.ts:37`).
  `T` is only the procedure's output type, threaded through `next()` and returned untouched — it
  changes no behaviour. Both call shapes ship today: `cacheInvalidator('settings')`
  (`webapp/features/settings/actions.ts:22`) and `cacheInvalidator<{ success: boolean }>('profile')`
  (`webapp/features/onboarding/actions.ts:23`). Write the bare form and let `T` infer; the two
  files disagree on style, so do not treat either as the house rule until one is settled.
- Pass several tags when one write invalidates several reads: `cacheInvalidator('posts', 'feed')`.
- Every export from a `'use server'` file must be async — that is why the helpers live in
  `action-utils.ts` rather than in the action file itself.

## The client hook

```tsx
// webapp/features/posts/hooks/index.ts
'use client'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { renameAction } from '@/features/posts/actions'

export function useRenamePost() {
  const router = useRouter()
  return useMutation({
    mutationFn: async (values: RenameValues) => {
      const [error, data] = await renameAction(values)
      if (error) throw new Error(error.message ?? 'Rename failed')
      return data
    },
    onSuccess: () => router.refresh(),
    onError: (err: Error) => announce(`Error: ${err.message}`),
  })
}
```

An `.actionable()` action returns the tuple `[error, data]` — it never throws across the server
boundary. Unpack it and throw inside `mutationFn` so TanStack Query sees the failure.

## The order that makes it work

```
1. client calls the server action
2. procedure handler runs (DB write, RLS enforced)
3. interceptor calls updateTag('posts')      → server cache busted, instantly
4. onSuccess calls router.refresh()          → server components re-render with fresh data
```

Do not use:

- `queryClient.invalidateQueries()` for a mutation — it clears the client cache and leaves the
  server cache serving the old row.
- `client.protected.posts.rename(...)` for a mutation — HTTP path, no `updateTag`.
- `updateTag()` inside a procedure handler — it throws in the HTTP handler context.

## Error and pending state at the button

The mutation is the source of both. Keep the button **enabled** while in flight and show the pending
state in its label or an adjacent indicator — a disabled button makes retry impossible when the
request fails (`.foundry/philosophy/async-state.md`). Announce success and failure into the feature's
`aria-live` region, the way the settings hooks do
(`webapp/features/settings/hooks/index.ts`).

## Reads that follow a write

Reads live in a server component or a `data.ts` module using `getORPCCaller()`; the tag you bust is
the tag those reads carry via `cacheTag()`. If a read has no tag, `updateTag()` has nothing to
invalidate — add the tag to the read before adding the invalidator to the write.
