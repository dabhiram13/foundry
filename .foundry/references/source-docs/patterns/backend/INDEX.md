# Backend Patterns — Index

> Planner: read this to select files for the brief's `## Must Read` section. Flag only patterns this feature actually triggers.

## Core

| File | Contains | Select when |
|------|----------|-------------|
| `orpc.md` | Secure schemas, contracts, procedures, router wiring, migrations, `.actionable()` mutation pattern | Always (any feature with backend work) |
| `inngest.md` | Background jobs, cron, event triggers, steps, Supabase access, flow control, retries, cancellation | Feature has background jobs, cron, or async workflows |
| `ratelimit.md` | Upstash Redis rate limiting — tiers, pattern for new procedures | Feature adds new procedure tiers or changes rate limits |

## Scaling (select per feature)

| File | Contains | Select when |
|------|----------|-------------|
| `fan-out.md` | Orchestrator + worker pattern, concurrency per user, scale math | Any loop over user items with external API calls, or per-item processing >2s |
| `idempotency.md` | processed_events dedup, UPSERT natural key, webhook replay handling | Webhook handlers, external events, anywhere retry is possible |
| `file-storage.md` | `uploadFile`, `useUploadImage`, compression presets, blob vs supabase routing | Feature has uploads, external asset ingestion, or user-generated images |
| `search-strategy.md` | ilike vs pg_trgm vs tsvector decision tree by row count | Feature has search, filtering, or lookup on user content |
| `aggregation.md` | Live query vs materialized view vs pre-computed table vs counter trigger | Feature has dashboards, stats, counts, analytics |
| `pagination.md` | Cursor + tiebreaker, composite index, when offset is OK | Feature returns lists >100 rows |
| `realtime.md` | Supabase Realtime filtered channels, reconnection, polling fallback | Feature has live updates, collaborative state, or background job status |
