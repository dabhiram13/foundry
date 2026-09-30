# Aggregation Pattern

Dashboards, counts, stats. Don't run live aggregations on large tables.

## Decision tree

| Rows aggregated | Freshness need | Strategy |
|---|---|---|
| <10,000 | Real-time | Live query |
| 10K – 1M | 5-min stale OK | Materialized view + Inngest cron refresh |
| >1M or multi-table JOIN | 5-min stale OK | Pre-computed table (Inngest worker writes) |
| Per-entity counters (views, likes) | Real-time | Counter column + DB trigger |

## Templates

### Counter column — high-write, per-row

```sql
ALTER TABLE public.posts ADD COLUMN view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_post_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_view_count
  AFTER INSERT ON public.post_views
  FOR EACH ROW EXECUTE FUNCTION increment_post_view();
```

### Materialized view — cross-table stats

```sql
CREATE MATERIALIZED VIEW public.user_stats AS
  SELECT
    user_id,
    count(*)        AS post_count,
    sum(view_count) AS total_views
  FROM public.posts
  GROUP BY user_id;

CREATE UNIQUE INDEX idx_user_stats_user_id
  ON public.user_stats (user_id);
```

```ts
// Inngest cron — non-blocking refresh every 5 min
export const refreshUserStats = inngest.createFunction(
  { id: 'refresh-user-stats' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    await step.run('refresh', async () => {
      const admin = createAdminClient()
      await admin.rpc('refresh_user_stats')
    })
  }
)
```

```sql
-- rpc wrapper so the cron can call it with CONCURRENTLY
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_stats;
END;
$$;
```

### Pre-computed table

Inngest worker computes on schedule, writes to a regular table. Use when materialized views can't express the logic (complex JOINs, conditional aggregation, external data mixed in).

## Rules

1. Live queries over >10K rows need an EXPLAIN ANALYZE before shipping.
2. Materialized view needs a UNIQUE INDEX for `REFRESH ... CONCURRENTLY` (otherwise refresh locks the view).
3. Counter triggers need `SECURITY DEFINER` + explicit `SET search_path = public` — prevents PII leaks and search-path hijack.
4. Never live-aggregate for a dashboard that loads on every page view.
5. Per-user RLS: query materialized view by `user_id` with explicit WHERE — RLS doesn't apply to materialized views directly.

## Gotchas

- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires the unique index. Without it, refresh takes an exclusive lock.
- Counter columns drift on crash or trigger bug — add a weekly full-recompute cron as sanity.
- Triggers run inside the transaction. Slow triggers slow every mutation. Keep them minimal.
- Materialized views don't inherit RLS. If data is user-scoped, include `user_id` in the view and filter in the query.
