# Supabase Logging — Debugging, Tracing & Observability

## Golden Rule

**Check the right log source for the right problem.** Each Supabase service has its own log stream.

| Log Source | Dashboard Path | What It Shows |
|------------|---------------|---------------|
| `edge_logs` | `/logs/edge-logs` | API requests/responses (REST, GraphQL) via Cloudflare |
| `postgres_logs` | `/logs/postgres-logs` | Database queries, errors, statements |
| `auth_logs` | `/logs/auth-logs` | Authentication/authorization activity |
| `storage_logs` | `/logs/storage-logs` | Object uploads, retrievals, errors |
| `realtime_logs` | `/logs/realtime-logs` | WebSocket connections, channel activity |
| `function_logs` | `/functions` > Logs tab | `console.log` output from Edge Functions |
| `function_edge_logs` | `/functions` > Invocations tab | Edge Function request/response metadata |

---

## Log Retention by Plan

| Plan | Retention |
|------|-----------|
| Free | 1 day |
| Pro | 7 days |
| Team | 28 days |
| Enterprise | 90 days |

Need longer retention? Use [Log Drains](#log-drains) to export to external systems.

---

## Logs Explorer — SQL Queries on Logs

Dashboard: `/logs-explorer`

The Logs Explorer uses **BigQuery SQL** syntax. All [BigQuery functions and operators](https://cloud.google.com/bigquery/docs/reference/standard-sql/functions-and-operators) are supported.

### Available Tables

```
auth_logs, edge_logs, function_edge_logs, function_logs,
postgres_logs, realtime_logs, storage_logs
```

### Timestamp Handling

Raw timestamps are unix microseconds. Use `datetime()` to convert:

```sql
-- Raw: 1664270180000
-- Readable:
select datetime(timestamp) from edge_logs;
-- 2022-09-27T09:17:10.439Z
```

### Unnesting Metadata

Metadata is stored as nested arrays. Use `cross join unnest()`:

```sql
select datetime(timestamp), r.method, h.x_real_ip
from
  edge_logs as t
  cross join unnest(t.metadata) as m
  cross join unnest(m.request) as r
  cross join unnest(r.headers) as h
where h.x_real_ip is not null;
```

### Best Practices

1. **Always filter by `timestamp`** — scanning full history causes timeouts on large projects
2. **Select individual fields, not entire metadata objects** — avoids memory errors
3. **Max 1000 rows per query** — use `LIMIT` to further reduce
4. **Use Templates** — available in the Templates tab for common queries

```sql
-- BAD: selects entire nested metadata
select datetime(timestamp), m as metadata
from edge_logs as t
  cross join unnest(t.metadata) as m;

-- GOOD: selects only what you need
select datetime(timestamp), r.method, r.path
from edge_logs as t
  cross join unnest(t.metadata) as m
  cross join unnest(m.request) as r;
```

---

## Common Debug Queries

### API — 5XX Errors

```sql
select datetime(timestamp), r.status_code, r.method, r.path
from
  edge_logs as t
  cross join unnest(t.metadata) as m
  cross join unnest(m.response) as r
where r.status_code >= 500
order by timestamp desc
limit 100;
```

### Auth — Failed Logins

```sql
select datetime(timestamp), event_message
from auth_logs
where event_message like '%error%'
  or event_message like '%invalid%'
order by timestamp desc
limit 100;
```

### Storage — 5XX Errors

```sql
select id, datetime(timestamp), event_message, r.statusCode, e.message as errorMessage
from
  storage_logs
  cross join unnest(metadata) as m
  cross join unnest(m.res) as r
  cross join unnest(m.error) as e
where r.statusCode >= 500
order by timestamp desc
limit 100;
```

### Storage — Filter by HTTP Method

```sql
select id, datetime(timestamp), event_message, r.method
from
  storage_logs
  cross join unnest(metadata) as m
  cross join unnest(m.req) as r
where r.method in ("POST")
order by timestamp desc
limit 100;
```

### Storage — Filter by IP Address

```sql
select id, datetime(timestamp), event_message, r.remoteAddress
from
  storage_logs
  cross join unnest(metadata) as m
  cross join unnest(m.req) as r
where r.remoteAddress in ("IP_ADDRESS")
order by timestamp desc
limit 100;
```

---

## Logging Postgres Queries with pgAudit

By default, not all Postgres queries are logged. Enable selective logging with **pgAudit**.

### Setup

1. Enable the `pgAudit` extension in Dashboard > Database > Extensions
2. Configure what to log:

```sql
-- Permanent: log function calls, writes, and DDL
alter role postgres set pgaudit.log to 'function, write, ddl';

-- For API traffic (PostgREST), set on authenticator role
alter role authenticator set pgaudit.log to 'write';
```

3. **Fast reboot** required for permanent changes
4. View in Dashboard > Logs > Postgres Logs

### Log Categories

| Value | What It Logs |
|-------|-------------|
| `read` | SELECT, COPY when source is a relation |
| `write` | INSERT, UPDATE, DELETE, TRUNCATE, COPY when destination is a relation |
| `function` | Function calls and DO blocks |
| `role` | GRANT, REVOKE, CREATE/ALTER/DROP ROLE |
| `ddl` | CREATE, ALTER, DROP (not covered by ROLE) |
| `misc` | DISCARD, FETCH, CHECKPOINT, VACUUM, SET |
| `all` | Everything above |

### Adjust Log Level

```sql
alter role postgres set pgaudit.log_level to 'info';
-- or for more detail:
alter role postgres set pgaudit.log_level to 'debug5';
-- Note: error, fatal, panic are NOT allowed
```

### Reset pgAudit Config

```sql
alter role postgres reset pgaudit.log;
-- Then fast reboot
```

### Scope Narrowly

Too-wide logging = noise. Only log the statement classes you need for your debugging session.

---

## RAISE Messages in Postgres

`RAISE INFO`, `RAISE NOTICE`, `RAISE WARNING`, `RAISE LOG` appear in Postgres Logs.

Check your current level:

```sql
show log_min_messages;
```

**Gotcha**: `LOG` level is *higher* than `WARNING` and `ERROR`. If level is `LOG`, you won't see `WARNING`/`ERROR`.

---

## Edge Function Logging

### Production

- **Invocations tab**: Request/response data (headers, body, status, duration). Filter by date/status.
- **Logs tab**: Platform events, uncaught exceptions, custom `console.*` messages. Filter by timestamp/level.

### Development (Local)

Errors and `console.log` print to your terminal.

### Automatic Logs

- **Uncaught exceptions**: Error message + stack trace
- **Custom log events**: `console.log`, `console.error`, `console.warn`
- **Boot/Shutdown**: Function lifecycle events

### Structured Logging

```ts
console.log(JSON.stringify({
  action: 'payment_processed',
  userId: user.id,
  amount: 49.99,
  status: 'success'
}));
```

### Log Message Limit

Max **10,000 characters** per message. Longer messages are truncated.

---

## Realtime Connection Logging

**Not enabled by default.** Enable per client:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, anonKey, {
  realtime: {
    params: {
      log_level: 'info',
    },
  },
});
```

---

## Query Performance Debugging

### pg_stat_statements

Extension for tracking SQL execution statistics. Key columns:

| Column | Description |
|--------|-------------|
| `query` | Normalized query text |
| `calls` | Number of executions |
| `total_exec_time` | Cumulative execution time (ms) |
| `mean_exec_time` | Average execution time (ms) |
| `rows` | Total rows retrieved/affected |
| `shared_blks_hit` | Buffer cache hits |
| `shared_blks_read` | Disk reads (cache misses) |

### Find Slow Queries

```sql
select
  query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(total_exec_time::numeric, 2) as total_ms,
  rows
from pg_stat_statements
order by mean_exec_time desc
limit 20;
```

### Find Most Executed Queries

```sql
select query, calls, rows, round(mean_exec_time::numeric, 2) as avg_ms
from pg_stat_statements
order by calls desc
limit 20;
```

### Reset Statistics

```sql
select pg_stat_statements_reset();
```

### Dashboard

Query Performance report available at: `/observability/query-performance`

---

## Log Drains — External Destinations

**Team & Enterprise plans only.** Dashboard: Project Settings > Log Drains.

| Destination | Transport | Configuration |
|-------------|-----------|---------------|
| Generic HTTP | HTTP | URL, HTTP Version, Gzip, Headers |
| DataDog | HTTP | API Key, Region |
| Loki | HTTP | URL, Headers |
| Sentry | HTTP | DSN |

- Batched: max 250 logs or 1-second intervals
- Gzip compression when supported
- Pricing: $60/month per drain + $0.20 per million events

---

## Metrics API (Prometheus)

Endpoint: `https://<project-ref>.supabase.co/customer/v1/privileged/metrics`

Auth: HTTP Basic — `service_role:<service_role_key>`

```bash
curl <project-url>/customer/v1/privileged/metrics \
  --user 'service_role:<your-service-role-key>'
```

~200 Postgres metrics (CPU, IO, WAL, connections, query stats). Scrape into Prometheus, Grafana, Datadog, etc.

Starter dashboard: [supabase-grafana](https://github.com/supabase/supabase-grafana)

---

## Debugging Workflow

```
1. Identify the service:  API? Auth? Database? Storage? Realtime? Edge Function?
2. Check the matching log source in Dashboard
3. Use regex search for keywords/error codes
4. If needed, go to Logs Explorer for SQL-level queries
5. For Postgres issues, enable pgAudit temporarily
6. For performance, check pg_stat_statements and Query Performance dashboard
7. For production monitoring, set up Log Drains + Metrics API
```

---

## Common Troubleshooting Patterns

| Symptom | Where to Look | What to Search |
|---------|--------------|----------------|
| 500 on API calls | `edge_logs` | `status_code >= 500` |
| Auth failures | `auth_logs` | `error`, `invalid`, status codes |
| Slow queries | `postgres_logs` + `pg_stat_statements` | `duration`, `mean_exec_time` |
| Storage upload fails | `storage_logs` | `statusCode >= 400` |
| Realtime disconnects | `realtime_logs` | Connection/channel errors |
| Edge Function crashes | `function_logs` | Uncaught exceptions, stack traces |
| RLS blocking queries | `postgres_logs` (with pgAudit) | `permission denied`, policy violations |
| Database errors from Auth | `auth_logs` + `postgres_logs` | `Database error`, triggers on `auth.users` |

---

## Checklist

- [ ] Know which log source matches each Supabase service
- [ ] Use Logs Explorer with timestamp filters for targeted queries
- [ ] Enable pgAudit only when debugging, scoped narrowly
- [ ] Use `pg_stat_statements` for query performance analysis
- [ ] Enable Realtime logging only when debugging connections
- [ ] Set up Log Drains for production monitoring (Team/Enterprise)
- [ ] Use Metrics API + Grafana for dashboards and alerting
- [ ] Never log PII in `User-Agent` headers or custom logs

**Refs**:
- https://supabase.com/docs/guides/telemetry/logs
- https://supabase.com/docs/guides/functions/logging
- https://supabase.com/docs/guides/storage/debugging/logs
- https://supabase.com/docs/guides/telemetry/log-drains
- https://supabase.com/docs/guides/telemetry/metrics
- https://supabase.com/docs/guides/database/extensions/pg_stat_statements
