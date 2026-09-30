# Supabase Realtime — Postgres Changes

---

## How It Works

Supabase Realtime uses **Postgres logical replication** under the hood. When a row is inserted, updated, or deleted, Postgres emits a change event through the `supabase_realtime` publication. The Realtime server picks it up, checks RLS policies for each subscriber, and pushes the event over WebSockets to authorized clients.

---

## How to Activate It (3 steps)

### 1. Enable RLS on your table

```sql
alter table "todos" enable row level security;

create policy "Allow anonymous access"
  on todos for select to anon using (true);
```

### 2. Add the table to the Realtime publication

Go to **Dashboard → Database → Publications → `supabase_realtime`** and toggle on your table. Or run:

```sql
alter publication supabase_realtime add table your_table_name;
```

### 3. Install & create the client

```bash
npm install @supabase/supabase-js
```

```ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient('https://<project>.supabase.co', '<anon_key>')
```

---

## Subscribing to Changes

### Listen to all changes on a schema

```ts
const channel = supabase
  .channel('schema-db-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
    console.log('Change received!', payload)
  })
  .subscribe()
```

### Listen to a specific table

```ts
const channel = supabase
  .channel('table-db-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
    console.log(payload)
  })
  .subscribe()
```

### Listen to specific events only

Event can be: `INSERT`, `UPDATE`, `DELETE`, or `*` (all).

```ts
// INSERTs only
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'todos' }, callback)
```

### Filter with conditions

```ts
// Only rows where id = 1
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'todos',
  filter: 'id=eq.1'
}, callback)
```

Supported filter operators:
- `eq` — equals (`id=eq.1`)
- `neq` — not equals
- `gt`, `gte`, `lt`, `lte` — comparisons
- `in` — in list (`name=in.(red, blue, yellow)`)

---

## Custom JWT / Auth Token

You can pass a custom JWT for authorization:

```ts
supabase.realtime.setAuth('fresh-token')
```

This is needed when refreshing tokens — you must manually pass them to the Realtime connection.

---

## Unsubscribing

```ts
supabase.removeChannel(channel)
```

---

## Key Limitations

1. **Delete events are NOT filterable** — you can't filter on column values for `DELETE` events (Postgres doesn't expose the old row data through the replication protocol in a filterable way).
2. **Table names with spaces don't work** with Realtime.
3. **Performance bottleneck** — Every change event is checked against RLS for each subscribed user. 100 subscribers + 1 insert = 100 reads. Changes are processed on a **single thread** to maintain order, so compute upgrades don't help much.
4. **Scaling advice** — For high throughput:
   - Use a separate public table **without RLS** and use filters instead.
   - Or use Realtime **server-side only** and re-stream via **Realtime Broadcast** to clients.

---

**Docs reference**: https://supabase.com/docs/guides/realtime/postgres-changes
