# Supabase Performance — RLS & Query Optimization

Every RLS policy = implicit `WHERE` per row. Bad policies: 1ms -> 178,000ms.

---

## 1. Wrap `auth.*()` in `(select ...)`

**Biggest single win.** Without `select`, Postgres re-evaluates per row. With `select`, it caches once per statement (`initPlan`).

```sql
-- BAD:  auth.uid() = user_id        (called per row)
-- GOOD: (select auth.uid()) = user_id  (cached once)
```

Only works when result doesn't depend on row data.

| Scenario | Before | After | Gain |
|----------|--------|-------|------|
| `auth.uid()` | 179ms | 9ms | 95% |
| `is_admin()` join | 11,000ms | 7ms | 99.9% |
| `has_role()` security definer | 178,000ms | 12ms | 99.99% |
| `any(user_teams())` | 173,000ms | 16ms | 99.99% |

**Real issues**: `goal_items`, `user_feedback`, `user_class_progress` — all re-evaluate `auth.<fn>()` per row. Fix: wrap in `(select ...)`.

---

## 2. Index RLS Columns

Any column in a policy condition must be indexed (unless PK).

```sql
create index idx_todos_user_id on todos using btree (user_id);
```

| Before | After | Gain |
|--------|-------|------|
| 171ms | <0.1ms | 99.9% |

---

## 3. Explicit Client Filters

RLS = implicit WHERE, but explicit filters help the query planner build better plans.

```ts
// BAD:  supabase.from('todos').select()
// GOOD: supabase.from('todos').select().eq('user_id', userId)
```

| Before | After | Gain |
|--------|-------|------|
| 171ms | 9ms | 94.7% |

---

## 4. Specify `TO` Role

Without `TO`, policy evaluates for all roles including `anon` — wasted cycles.

```sql
-- BAD:  create policy "x" on todos using (...)
-- GOOD: create policy "x" on todos to authenticated using (...)
```

| Before | After | Gain |
|--------|-------|------|
| 170ms | <0.1ms | 99.8% |

---

## 5. Avoid Joins in Policies

Don't join source to lookup table. Fetch filter set independently.

```sql
-- SLOW: joins to source table
using ( (select auth.uid()) in (
  select user_id from team_members where team_members.team_id = team_id ))

-- FAST: independent subquery
using ( team_id in (
  select team_id from team_members where user_id = (select auth.uid()) ))
```

| Before | After | Gain |
|--------|-------|------|
| 9,000ms | 20ms | 99.8% |

---

## 6. Security Definer for Complex Checks

Nested RLS (policy queries another RLS table) = compounding overhead. Use `security definer` in `private` schema.

```sql
create function private.has_role(r text) returns boolean
language plpgsql security definer set search_path = ''
as $$ begin
  return exists (select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = r);
end; $$;

-- In policy:
using ( (select private.has_role('admin')) );
```

---

## 7. Consolidate Permissive Policies

Multiple permissive policies = OR semantics. Postgres evaluates all N per row worst case.

**Fix**: Single policy per role/action.

---

## 8. Drop Duplicate Indexes

**Real issue**: `realtime_messages` has identical indexes `idx_realtime_messages_sender` and `idx_realtime_messages_sender_id`. Drop one.

```sql
drop index if exists idx_realtime_messages_sender;
```

---

## Optimal Policy Template

```sql
create policy "name" on public.table
for select to authenticated
using ( (select auth.uid()) = user_id );

create index idx_table_user_id on public.table using btree (user_id);
```

---

## 9. Trigger Performance

### AFTER Triggers Must RETURN NULL

AFTER trigger return values are ignored by PostgreSQL. Returning `NEW`/`OLD` is misleading.

```sql
-- BAD: misleading return
create function public.audit_trigger() returns trigger as $$
begin
  insert into audit_logs (...) values (...);
  return NEW;  -- ignored by Postgres for AFTER triggers
end; $$;

-- GOOD: clear intent
create function public.audit_trigger() returns trigger as $$
begin
  insert into audit_logs (...) values (...);
  return null;  -- AFTER trigger: return value ignored
end; $$;
```

### Never Use EXCEPTION Blocks for Control Flow

PL/pgSQL `EXCEPTION` blocks create a subtransaction per invocation. In hot-path triggers this destroys performance.

```sql
-- BAD: exception per row per trigger fire (creates subtransaction)
begin
  v_actor_id := NEW.user_id;  -- might not exist
exception when undefined_column then
  v_actor_id := NEW.id;
end;

-- GOOD: JSONB access returns NULL for missing keys (no exception)
v_actor_id := (to_jsonb(NEW) ->> 'user_id')::uuid;
-- Or use CASE on table name:
v_actor_id := case TG_TABLE_NAME
  when 'profiles' then NEW.id
  else (to_jsonb(NEW) ->> 'user_id')::uuid
end;
```

---

## Checklist

- [ ] All `auth.*()` wrapped in `(select ...)`
- [ ] Indexes on RLS columns
- [ ] Explicit `.eq()` filters in client queries
- [ ] `TO` role on every policy
- [ ] No joins in policies
- [ ] Complex lookups in `security definer` functions
- [ ] Permissive policies consolidated
- [ ] No duplicate indexes
- [ ] AFTER triggers `RETURN NULL`
- [ ] No EXCEPTION blocks in triggers — use JSONB access for optional columns

**Ref**: https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations
