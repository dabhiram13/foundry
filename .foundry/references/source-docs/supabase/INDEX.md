# Supabase — Index

> Planner: read this to select files for the Reference Manifest.

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `auth.md` | Auth flow, custom JWT hook, Turnstile, RBAC, claims injection | Always (any protected feature) | Database Architect, oRPC Expert |
| `jwt.md` | Decoded JWT example, custom claims structure, reading claims server-side | Feature reads specific claims or modifies auth context | oRPC Expert |
| `security.md` | RLS patterns, key management (anon vs service_role), hardening rules | Feature has database tables with row-level access | Database Architect |
| `realtime.md` | Postgres changes, WebSocket channels, RLS-gated subscriptions | Feature has live/realtime updates | oRPC Expert, Backend Connector |
| `storage.md` | Buckets, upload/download, RLS on storage.objects, CDN, signed URLs | Feature has file uploads or media | Database Architect, oRPC Expert |
| `performance.md` | RLS optimization (auth.uid() caching), query plan analysis | Feature has complex RLS policies or perf-sensitive queries | Database Architect |
| `views.md` | Regular views, materialized views, refresh strategies, Inngest cron refresh, RLS on views | Feature has dashboards, metrics, aggregations, or complex joins | Database Architect, Backend |
| `logging.md` | Log sources per service, retention, debugging strategy | Optional — debugging reference | Any |
| `orchestration.md` | Proposed Supabase state model for detached orchestrators, feature flag, worker/run tables, merge helper scope | Feature considers optional parallel detached workers | Orchestrator, Database Architect |
