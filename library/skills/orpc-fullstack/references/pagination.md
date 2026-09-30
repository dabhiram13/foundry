# Paginated procedures

Cursor is the default. Offset is the exception, and it has to be argued for.

The full rule set, including the index requirement and the gotchas, is
`.foundry/references/source-docs/patterns/backend/pagination.md`. This file is how it lands inside a procedure.

## Output shapes

| Kind | Shape |
|---|---|
| Cursor | `{ items, nextCursor, hasMore }` |
| Offset | `{ items, page, hasMore, totalCount }` |
| Not paginated | `{ items }` |

The array is always called `items` — connector hooks and the evaluator both key on that name.

## Cursor procedure

```ts
import { z } from 'zod'
import { protectedProcedure } from '../base'
import { secureObject } from '../schemas'
import { Errors } from '../errors'

const ListInput = secureObject({
  cursor: z.string().optional(),                       // opaque base64 of { createdAt, id }
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const list = protectedProcedure
  .route({ method: 'GET', path: '/protected/posts/list' })
  .input(ListInput)
  .handler(async ({ context, input }) => {
    const decoded = input.cursor ? decodeCursor(input.cursor) : null

    let query = context.supabase
      .from('posts')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })              // tiebreaker — mandatory
      .limit(input.limit + 1)                          // one extra row answers hasMore

    if (decoded) {
      query = query.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      )
    }

    const { data, error } = await query
    if (error) throw Errors.internal(error.message)

    const rows = data ?? []
    const hasMore = rows.length > input.limit
    const items = hasMore ? rows.slice(0, -1) : rows
    const last = items.at(-1)

    return {
      items,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
    }
  })
```

Rules that come with that query:

1. The tiebreaker is not optional. `created_at` alone repeats and skips rows.
2. The composite index must match the sort, direction included:
   `CREATE INDEX idx_posts_feed ON public.posts (created_at DESC, id DESC);`
3. Cursors are opaque base64. Never hand the client a raw column value.
4. `limit` is capped in Zod at 100. An uncapped limit is a denial-of-service input.
5. A sort change invalidates the cursor — the client re-fetches from the start.
6. `count: 'exact'` on a large table is a sequential scan. Skip the total, or estimate it.

## Offset procedure

Only for admin tables with real page-jumping, or result sets known to stay under about a thousand
rows. `PaginationSchema` from `../schemas` already bounds it (`page` 1–10000, `limit` 1–100):

```ts
const offset = (input.page - 1) * input.limit
const { data, count, error } = await context.supabase
  .from('items')
  .select('*', { count: 'exact' })
  .range(offset, offset + input.limit - 1)

if (error) throw Errors.internal(error.message)

return {
  items: data ?? [],
  page: input.page,
  totalCount: count ?? 0,
  hasMore: offset + input.limit < (count ?? 0),
}
```

`.range()` is offset pagination. Do not describe it as cursor pagination in a plan, a comment, or a
deliverable — the evaluator grades that claim against the code.

## On the client

```tsx
useInfiniteQuery(
  orpc.protected.posts.list.infiniteOptions({
    input: (cursor: string | undefined) => ({ cursor, limit: 20 }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }),
)
```

`nextCursor: null` ends the list — that is why the field is nullable rather than absent.
