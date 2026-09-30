# Supabase — Views & Materialized Views

## Regular Views

A view is a virtual table defined by a query. It runs the query every time you select from it — always fresh data, no storage cost.

```sql
create view active_users as
  select id, name, email, last_seen_at
  from profiles
  where status = 'active';
```

Query it like a table (works with Supabase client too):

```typescript
const { data } = await supabase.from("active_users").select("*");
```

### When to Use Views

- Simplify complex joins that multiple features query
- Create read-only "API surfaces" for the frontend
- Abstract away schema changes (rename columns, combine tables)
- RLS applies to the underlying tables — views respect existing policies

### RLS on Views

Views run queries as the view definer by default. For RLS to apply:

```sql
-- Option 1: security_invoker (Postgres 15+, Supabase default)
create view my_view with (security_invoker = true) as
  select * from my_table;
-- RLS checks run as the calling user (correct for most cases)

-- Option 2: security_barrier (prevents information leaks through functions)
create view my_view with (security_barrier = true) as
  select * from my_table where user_id = (select auth.uid());
```

Always use `security_invoker = true` unless you have a specific reason not to.

## Materialized Views

A materialized view stores query results on disk. Fast reads, but data is stale until refreshed.

```sql
create materialized view monthly_metrics as
  select
    date_trunc('month', created_at) as month,
    count(*) as total_orders,
    sum(amount) as revenue,
    count(distinct user_id) as unique_buyers
  from orders
  group by date_trunc('month', created_at);

-- Index for fast lookups
create index idx_monthly_metrics_month on monthly_metrics (month);
```

### Refreshing

```sql
-- Full refresh (locks view during refresh)
refresh materialized view monthly_metrics;

-- Concurrent refresh (no lock, but requires a UNIQUE index)
create unique index idx_monthly_metrics_month_unique on monthly_metrics (month);
refresh materialized view concurrently monthly_metrics;
```

### Refresh Strategies

| Strategy | How | Best for | Round-trip |
|----------|-----|----------|------------|
| pg_cron (preferred) | Runs inside Postgres — zero network overhead | Dashboard stats, hourly/daily aggregations | None |
| Inngest cron | External cron calls `supabase.rpc()` via admin client | Complex refresh logic (multi-step, conditional, notifications) | Inngest -> Supabase |
| After mutation | Trigger or Inngest event after data changes | Near-real-time metrics with low write volume | Depends |
| Manual | Admin action or API call | On-demand reports | One call |

### pg_cron (Preferred — Zero Round-Trip)

pg_cron runs inside Postgres. No external service needed. Enable it via Supabase MCP first:

```sql
-- Step 1: Enable the pg_cron extension (via Supabase MCP or migration)
create extension if not exists pg_cron;

-- Step 2: Create the refresh function
create or replace function refresh_monthly_metrics()
returns void as $$
begin
  refresh materialized view concurrently monthly_metrics;
end;
$$ language plpgsql security definer;

-- Step 3: Schedule with pg_cron (every hour)
select cron.schedule(
  'refresh-monthly-metrics',  -- unique job name
  '0 * * * *',                -- cron expression (every hour)
  $$select refresh_monthly_metrics()$$
);

-- To unschedule:
select cron.unschedule('refresh-monthly-metrics');

-- To see scheduled jobs:
select * from cron.job;
```

db-architect: when creating materialized views, ALWAYS set up pg_cron refresh in the same migration.

### Inngest Cron (For Complex Refresh Logic)

Use when refresh involves multi-step logic, conditional checks, or notifications:

```sql
-- Postgres function to refresh
create or replace function refresh_monthly_metrics()
returns void as $$
begin
  refresh materialized view concurrently monthly_metrics;
end;
$$ language plpgsql security definer;
```

```typescript
// Inngest cron function — use when refresh needs multi-step logic
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const refreshMetrics = inngest.createFunction(
  { id: "refresh-monthly-metrics" },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    await step.run("refresh", async () => {
      const supabase = createAdminClient();
      const { error } = await supabase.rpc("refresh_monthly_metrics");
      if (error) throw error;
    });

    // Inngest advantage: can add steps after refresh
    await step.run("notify-if-anomaly", async () => {
      // Check for anomalies, send alerts, etc.
    });
  }
);
```

### When to Use Materialized Views

- Aggregation queries that are expensive (COUNT, SUM, AVG over large tables)
- Dashboard stats, leaderboards, analytics
- Data that doesn't need to be real-time (hourly/daily refresh is fine)
- Reports that join many tables

### When NOT to Use

- Data must be real-time — use regular views or queries instead
- Small tables — the overhead of refresh isn't worth it
- Frequently changing data with low tolerance for staleness

## Querying from Supabase Client

Both views and materialized views are queryable like tables:

```typescript
// Regular view — always fresh
const { data } = await supabase.from("active_users").select("*");

// Materialized view — fast but stale until refreshed
const { data } = await supabase.from("monthly_metrics").select("*").order("month", { ascending: false });
```

## Pitfalls

- **Materialized views don't have RLS** — they store pre-computed data. If you need per-user filtering, add a `user_id` column and filter client-side, or use a regular view instead.
- **`REFRESH MATERIALIZED VIEW` locks the view** — use `CONCURRENTLY` with a unique index to avoid blocking reads.
- **Views with `security_invoker = false`** bypass RLS — always set `security_invoker = true` for user-facing views.
- **Materialized views don't auto-update** — you MUST set up a refresh strategy (cron, trigger, or manual).
