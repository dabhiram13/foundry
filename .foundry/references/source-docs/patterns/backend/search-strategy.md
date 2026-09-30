# Search Strategy

Pick the right index before the table grows. Fixing a bad search plan at 50K rows is painful.

## Decision by row count

| Rows (max expected) | Strategy | Index |
|---|---|---|
| <1,000 | `ilike` inline | none |
| 1K – 50K | `pg_trgm` fuzzy | `GIN (col gin_trgm_ops)` |
| >50K | `tsvector` full-text | `GIN (to_tsvector('english', col))` |
| Exact prefix only (usernames, emails) | `text_pattern_ops` btree | `btree (col text_pattern_ops)` |

## Templates

### pg_trgm — fuzzy search, handles typos

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_posts_title_trgm
  ON public.posts USING GIN (title gin_trgm_ops);
```

```ts
const { data } = await supabase
  .from('posts')
  .select('*')
  .ilike('title', `%${query}%`)
  .limit(20)
```

### tsvector — full-text with ranking

```sql
ALTER TABLE public.posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body,  '')), 'B')
  ) STORED;

CREATE INDEX idx_posts_search ON public.posts USING GIN (search_vector);
```

```sql
-- rpc function callable from supabase.rpc('search_posts', { q })
CREATE OR REPLACE FUNCTION search_posts(q text)
RETURNS SETOF public.posts
LANGUAGE sql STABLE AS $$
  SELECT *
  FROM public.posts
  WHERE search_vector @@ plainto_tsquery('english', q)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', q)) DESC
  LIMIT 20;
$$;
```

### Exact prefix — autocomplete, usernames

```sql
CREATE INDEX idx_users_username_prefix
  ON public.users (username text_pattern_ops);
```

```ts
.ilike('username', `${query}%`) // prefix-only, NOT %query%
```

## Rules

1. Multi-column filter + search → EXPLAIN ANALYZE. Composite indexes often needed.
2. RLS interacts with GIN indexes — verify the planner still uses the index with RLS enabled.
3. Never `ilike '%query%'` on >1K rows without an index — it's a sequential scan.
4. Weighted tsvector (`setweight`) when multiple fields contribute — titles should outrank body matches.
5. `pg_trgm` minimum query length is 3 chars. Shorter queries must fall back to a different approach (prefix, exact).

## Gotchas

- Stemming depends on tsvector config — `'english'` strips suffixes, `'simple'` doesn't. Pick once, stick with it.
- Generated columns can't be referenced in RLS policies directly — check before choosing tsvector over a regular column.
- GIN index creation on a large existing table is slow and blocks writes. Create CONCURRENTLY in a separate migration if the table already has data.
