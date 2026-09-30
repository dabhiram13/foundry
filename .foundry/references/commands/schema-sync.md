<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: schema-sync
description: Regenerate db-schema.md from the live Supabase database — tables, columns, RLS, relationships.
---

# /schema-sync — Regenerate db-schema.md from live database

You are regenerating `db-schema.md` from the live Supabase database. This is the single source of truth for the schema.

## What to include

Only 3 things: **table schemas + RLS policies + indexes**. Nothing else.

## Steps

### 1. Get all public tables with columns

Use `mcp__supabase__list_tables` with `verbose: true` on the `public` schema:

```
project_id: YOUR_SUPABASE_PROJECT_REF
schemas: ["public"]
verbose: true
```

### 2. Get all enums

```sql
SELECT t.typname AS enum_name,
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;
```

### 3. Get RLS policies

```sql
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
```

### 4. Get indexes

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;
```

### 5. Get public functions (signatures only)

```sql
SELECT p.proname AS name,
       pg_get_function_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS returns,
       CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
       CASE WHEN p.provolatile = 'i' THEN 'IMMUTABLE' WHEN p.provolatile = 's' THEN 'STABLE' ELSE 'VOLATILE' END AS volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;
```

### 6. Get foreign key relationships

```sql
SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_schema || '.' || ccu.table_name AS to_table,
    ccu.column_name AS to_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

### 7. Write db-schema.md

Use this exact format:

```markdown
# Database Schema

Generated from Supabase project `YOUR_SUPABASE_PROJECT_REF` via /schema-sync.

Last synced: {YYYY-MM-DD}

## Enums

| Name | Values |
|------|--------|
| `{enum}` | {val1}, {val2}, ... |

## Public Tables

### {table_name}

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `{col}` | {type} | {yes/no} | {default or -} | {PK, FK -> table.col, UNIQUE, etc.} |

**RLS Policies:**
| Policy | Command | Roles | Using | With Check |
|--------|---------|-------|-------|------------|
| {name} | {SELECT/INSERT/...} | {roles} | {qual} | {with_check or -} |

**Indexes:**
| Index | Definition |
|-------|------------|
| {name} | {indexdef} |

---

(repeat for each table)

## Public Functions

| Function | Args | Returns | Security | Volatility |
|----------|------|---------|----------|------------|
| `{name}` | {args} | {returns} | {DEFINER/INVOKER} | {STABLE/VOLATILE/...} |

## Relationships

```
{from_table}.{from_col} -> {to_table}.{to_col}
```
```

### Rules

- Run ALL 6 queries in parallel (they're independent)
- Tables with zero non-pkey indexes: omit the Indexes section for that table
- Tables with zero RLS policies: write `**RLS:** None (DANGER — no row-level security)`
- Keep column defaults concise: `gen_random_uuid()` not `public.gen_random_uuid()`
- Strip `public.` prefix from types
- Write the file to `/path/to/your/project/db-schema.md`
- Remove the `.schema-dirty` marker if it exists: `rm -f .foundry/.schema-dirty`
- After writing, report: table count, total RLS policies, total indexes, any tables missing RLS
