# Pagination Pattern

Cursor always wins at scale. Offset is an exception.

## When to use what

| Use case | Pattern |
|---|---|
| Infinite scroll | Cursor + tiebreaker |
| "Load more" button | Cursor + tiebreaker |
| Page jumping (1, 2, 3, … 50) | Offset — only if the user actually needs it |
| Sort change | Reset cursor on sort change |

## Cursor template

```ts
// Contract
input: z.object({
  cursor: z.string().optional(), // opaque base64 of { createdAt, id }
  limit: z.number().int().min(1).max(100).default(20),
})
output: z.object({
  items: z.array(ItemSchema),
  nextCursor: z.string().nullable(),
})

// Handler
const decoded = input.cursor ? decodeCursor(input.cursor) : null

let query = context.supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .order('id',         { ascending: false }) // tiebreaker — MANDATORY
  .limit(input.limit + 1)

if (decoded) {
  query = query.or(
    `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`
  )
}

const { data } = await query
const hasMore = data.length > input.limit
const items = hasMore ? data.slice(0, -1) : data
const nextCursor = hasMore
  ? encodeCursor({
      createdAt: items.at(-1)!.created_at,
      id:        items.at(-1)!.id,
    })
  : null
```

## Required index

```sql
CREATE INDEX idx_posts_feed
  ON public.posts (created_at DESC, id DESC);
```

## Rules

1. Cursor pagination REQUIRES a unique tiebreaker. Always include `id` in the `ORDER BY`.
2. Index the sort column + tiebreaker together — composite index, matching sort direction.
3. Encode cursors as opaque base64 — never expose raw column values to the client.
4. Max page size capped in Zod (100). Prevents DOS through huge limits.
5. Total count is expensive — use `estimated_count` from `pg_stat_user_tables` or skip entirely.
6. Sort change resets the cursor. The frontend must detect sort change and re-fetch from page 1.

## When offset is OK

- Admin tables with page jumping (1, 2, 3, 4, 5).
- Result sets known to be small (<1K).
- Internal tooling where UX beats performance.

Otherwise: cursor.

## Gotchas

- `.range(offset, offset + limit)` is an offset pattern — don't call this "cursor pagination."
- RLS policies must allow the same sort order as the index — otherwise the planner skips the index.
- Tiebreaker must be stable and unique. `id` (UUID or serial) always works. `created_at` alone does not.
- Cursor decoded from an old query on a sorted-differently table = silent wrong results. Invalidate cursor on sort change.
