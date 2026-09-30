# Supabase Postgres Best Practices — Index

> Planner: read this to select files for the Reference Manifest. Extracted from the parent SKILL.md.
> Only assign files that match the feature's characteristics. Do NOT assign all files.

## Query Performance (CRITICAL)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `query-missing-indexes.md` | Index WHERE/JOIN columns to avoid table scans | Feature has list/filter/search queries | Database Architect |
| `query-index-types.md` | B-tree, GIN, GiST, BRIN, Hash selection guide | Feature has non-standard data types (JSONB, arrays, geo) | Database Architect |
| `query-composite-indexes.md` | Multi-column indexes for compound filters | Feature filters on 2+ columns together | Database Architect |
| `query-partial-indexes.md` | Partial indexes with WHERE clause | Feature has soft-delete or status-filtered queries | Database Architect |
| `query-covering-indexes.md` | INCLUDE columns for index-only scans | Feature has high-read queries needing specific columns | Database Architect |

## Connection Management (CRITICAL)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `conn-pooling.md` | PgBouncer/Supavisor connection pooling | Feature has high concurrency or connection issues | Database Architect |
| `conn-limits.md` | Max connection limits by RAM | Optional — infrastructure reference | Database Architect |
| `conn-idle-timeout.md` | Idle timeout configuration | Optional — infrastructure reference | Database Architect |
| `conn-prepared-statements.md` | Prepared statement conflicts with pooling | Feature uses transaction-mode pooling | Database Architect |

## Security & RLS (CRITICAL)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `security-rls-basics.md` | Enable RLS, policy patterns, SECURITY DEFINER helpers | Feature has new tables (always) | Database Architect |
| `security-rls-performance.md` | RLS optimization, subquery caching, auth.uid() wrapping | Feature has complex RLS or joins through RLS tables | Database Architect |
| `security-privileges.md` | Least-privilege roles, never superuser in app | Optional — security hardening | Database Architect |

## Schema Design (HIGH)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `schema-primary-keys.md` | UUID vs identity vs serial PKs | Feature has new tables (always) | Database Architect |
| `schema-foreign-key-indexes.md` | Index all FK columns (Postgres doesn't auto-index) | Feature has foreign keys (always) | Database Architect |
| `schema-data-types.md` | Appropriate data types (text+CHECK vs varchar, timestamptz, etc.) | Feature has non-trivial column types | Database Architect |
| `schema-constraints.md` | NOT NULL, CHECK, safe constraint additions | Feature has new tables or columns | Database Architect |
| `schema-lowercase-identifiers.md` | Lowercase naming to avoid case bugs | Optional — naming reference | Database Architect |
| `schema-partitioning.md` | Table partitioning for time-series/logs | Feature has high-volume append-only data | Database Architect |

## Concurrency & Locking (MEDIUM-HIGH)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `lock-short-transactions.md` | Short transactions for reduced contention | Feature has concurrent writes to same rows | Database Architect |
| `lock-deadlock-prevention.md` | Consistent lock ordering | Feature has multi-table transactions | Database Architect |
| `lock-skip-locked.md` | SKIP LOCKED for worker queues | Feature has job queue or task processing | Database Architect |
| `lock-advisory.md` | Advisory locks for app-level coordination | Feature needs distributed locking | Database Architect |

## Data Access Patterns (MEDIUM)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `data-n-plus-one.md` | Batch lookups with JOINs or arrays | Feature has list views with related data | Database Architect, oRPC Expert |
| `data-pagination.md` | Cursor/keyset pagination over OFFSET | Feature has paginated lists | Database Architect, oRPC Expert |
| `data-batch-inserts.md` | Batch INSERT / COPY for bulk loading | Feature has bulk data import | Database Architect, oRPC Expert |
| `data-upsert.md` | INSERT ON CONFLICT for atomic upserts | Feature has idempotent writes | Database Architect, oRPC Expert |

## Advanced Features (LOW)

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `advanced-jsonb-indexing.md` | GIN indexes on JSONB columns | Feature stores/queries JSONB data | Database Architect |
| `advanced-full-text-search.md` | tsvector + GIN for full-text search | Feature has text search | Database Architect |
