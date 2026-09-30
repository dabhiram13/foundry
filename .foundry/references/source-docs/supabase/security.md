# Supabase Security — RLS, Keys & Hardening

## Golden Rule

**NEVER expose `service_role` key in client code.** It bypasses RLS entirely. Server-only.

| Key | Browser-safe? | Bypasses RLS? | Use case |
|-----|---------------|---------------|----------|
| `anon` | Yes | No | Public client access |
| `service_role` | **NEVER** | Yes | Server-side admin only |

---

## RLS — Mandatory on All Public Tables

```sql
alter table "your_table" enable row level security;
```

No RLS = full read/write access to anyone with the `anon` key.

**Real issue**: `public.fathom_integrations` exposed `access_token`, `refresh_token` without RLS.

---

## Overly Permissive Policies

`USING (true)` / `WITH CHECK (true)` on INSERT/UPDATE/DELETE = **RLS disabled**. Only acceptable on SELECT for intentional public reads.

| Issue | Table | Problem |
|-------|-------|---------|
| Unrestricted UPDATE | `realtime_notifications` | `USING (true) AND WITH CHECK (true)` — any authenticated user can update any row |
| Unrestricted ALL | `form_configs` | Same — full CRUD for all authenticated users |

**Fix pattern**: Scope to ownership.

```sql
create policy "scoped_update" on public.your_table for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );
```

---

## Function `search_path` — Always Set Explicitly

Mutable `search_path` = search path injection risk.

| Affected | Issue |
|----------|-------|
| `public.can_edit_delete_message` | Mutable search_path |
| `public.edit_message` | Mutable search_path |

**Fix**: `set search_path = ''` + fully qualify all references.

```sql
create or replace function public.your_function()
returns boolean language plpgsql security invoker
set search_path = ''
as $$ begin
  return exists (select 1 from public.messages where user_id = (select auth.uid()));
end; $$;
```

---

## JWT Claims in Policies

| Claim source | User-modifiable? | Safe for auth? |
|-------------|------------------|----------------|
| `raw_app_meta_data` | No | **Yes** — use this |
| `raw_user_meta_data` | Yes (`auth.update()`) | **No** — user can self-escalate |

```sql
-- GOOD: app_metadata
using ( (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' );
-- BAD: user_metadata (user-editable)
```

Handle null: `auth.uid()` returns `null` when unauthenticated. `null = user_id` is always `false`.

---

## Views Bypass RLS

Views run as `postgres` (security definer) by default.

**Fix** (Postgres 15+):
```sql
create view my_view with (security_invoker = true) as select * from my_table;
```

---

## Security Definer Functions

Run as creator role (`postgres` = `bypassrls`).

| Rule | Why |
|------|-----|
| Never in `public` schema | Exposed via API |
| Place in `private` schema | Not API-accessible |
| Always `set search_path = ''` | Prevent injection |

---

## Multiple Permissive Policies

Compose with **OR** — if *any* allows, access granted. Creates access control bugs + performance issues.

**Fix**: Consolidate per role/action into single policy.

---

## RLS Migration Patterns

### Idempotent Policies

Policies have no `IF NOT EXISTS`. Always drop before create:

```sql
-- Every CREATE POLICY must be preceded by this:
drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select to authenticated
  using ( (select auth.uid()) = user_id );
```

### Idempotent Triggers

```sql
-- Every CREATE TRIGGER must be preceded by this:
drop trigger if exists set_updated_at on public.items;
create trigger set_updated_at before update on public.items
  for each row execute function update_updated_at();
```

### ENABLE RLS in Every Migration

```sql
-- Immediately after CREATE TABLE:
create table if not exists public.items ( ... );
alter table public.items enable row level security;
```

### INSERT Policies Must Validate Identity

Tables with `created_by`, `actor_id`, or similar columns must enforce ownership on INSERT:

```sql
-- BAD: only checks membership
create policy "cards_insert_member" on public.board_cards
  for insert to authenticated
  with check ( (select is_workspace_member(workspace_id)) );

-- GOOD: also validates identity column
create policy "cards_insert_member" on public.board_cards
  for insert to authenticated
  with check (
    (select is_workspace_member(workspace_id))
    and created_by = (select auth.uid())
  );
```

### Admin Checks via SECURITY DEFINER Helper

Never query RLS-protected tables directly in policies. Policy expressions run as the current user — if `admins` has RLS, a direct EXISTS silently returns no rows.

```sql
-- BAD: direct lookup (fails if admins has RLS)
using ( exists (select 1 from public.admins where user_id = auth.uid()) );

-- GOOD: SECURITY DEFINER helper
create function public.is_admin()
returns boolean language plpgsql security definer
set search_path = '' as $$
begin
  return exists (
    select 1 from public.admins
    where user_id = (select auth.uid())
  );
end; $$;

grant execute on function public.is_admin() to authenticated;

-- In policy:
using ( (select public.is_admin()) );
```

---

## Security Definer Function Rules

1. **Always `SET search_path = ''`** + fully qualified table names
2. **GRANT EXECUTE to the correct role** — never blanket `TO authenticated`:

   ```sql
   -- User-facing function: grant to authenticated
   grant execute on function public.get_user_metrics(uuid) to authenticated;

   -- Server-only function (Inngest, cron, admin): grant to service_role ONLY
   grant execute on function public.cleanup_old_data(integer) to service_role;
   -- NEVER: grant execute on function public.cleanup_old_data(integer) to authenticated;
   ```

   **Rule**: If a SECURITY DEFINER function is called only by Inngest, cron, or admin workflows, it MUST NOT be granted to authenticated. Granting destructive/admin functions to authenticated = privilege escalation.

3. **Validate auth.uid()** if accepting a user_id parameter:

   **Server-only function** (Inngest, cron): Don't grant to authenticated — problem solved at the source.

   **User-facing function** (called by authenticated users via RPC):
   ```sql
   create function public.get_user_metrics(p_user_id uuid)
   returns ... language plpgsql security definer
   set search_path = '' as $$
   begin
     -- MUST be first statement:
     if p_user_id != (select auth.uid()) then
       raise exception 'unauthorized';
     end if;
     ...
   end; $$;
   ```

   **Dual-use function** (called by both users and service_role):
   ```sql
   -- service_role has auth.uid() = NULL, so allow NULL through
   if (select auth.uid()) is not null
     and p_user_id != (select auth.uid()) then
     raise exception 'unauthorized';
   end if;
   ```

   Prefer using `(select auth.uid())` directly instead of accepting a parameter.

---

## Checklist

- [ ] RLS on every exposed table
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in every migration
- [ ] `DROP POLICY IF EXISTS` before every `CREATE POLICY`
- [ ] `TO authenticated` (or explicit role) on every policy — never omit
- [ ] INSERT policies validate identity columns (`created_by = auth.uid()`)
- [ ] Admin checks use `is_admin()` SECURITY DEFINER helper
- [ ] No `USING(true)`/`WITH CHECK(true)` on INSERT/UPDATE/DELETE
- [ ] `search_path = ''` on all functions
- [ ] `GRANT EXECUTE` on all SECURITY DEFINER functions
- [ ] SECURITY DEFINER functions validate `auth.uid()` if accepting user_id param
- [ ] `service_role` never in client code
- [ ] Auth claims from `app_metadata` only
- [ ] Views use `security_invoker = true`
- [ ] Permissive policies consolidated

**Ref**: https://supabase.com/docs/guides/database/postgres/row-level-security
