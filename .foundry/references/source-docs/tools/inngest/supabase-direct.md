# Inngest - Direct Supabase Access

## Why Not oRPC Inside Inngest?

Inngest runs on its own infrastructure. If an Inngest function calls oRPC, the request flow is:

```
Inngest -> Vercel (oRPC route) -> Supabase
```

This adds latency, costs, and a failure point. Instead, Inngest functions connect to Supabase directly:

```
Inngest -> Supabase (direct)
```

## The Admin Client

Use the service role client from `lib/supabase/admin.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

export const syncUserData = inngest.createFunction(
  { id: "sync-user-data" },
  { event: "app/user.created" },
  async ({ event, step }) => {
    await step.run("create-profile", async () => {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("profiles")
        .insert({ id: event.data.userId, name: event.data.name });
      if (error) throw error;
    });
  }
);
```

Key rules:
- Create a new client inside each `step.run()` — never share across steps
- The admin client bypasses RLS (service role key)
- Use Supabase RPC for complex operations: `supabase.rpc("my_function", { ... })`

## Supabase RPC from Inngest

For complex DB operations, create a Postgres function and call it via RPC:

```sql
-- In a Supabase migration
create or replace function process_order(p_order_id uuid)
returns void as $$
begin
  update orders set status = 'processing' where id = p_order_id;
  insert into order_events (order_id, event_type) values (p_order_id, 'processing_started');
end;
$$ language plpgsql security definer;
```

```typescript
await step.run("process-order", async () => {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("process_order", {
    p_order_id: event.data.orderId,
  });
  if (error) throw error;
});
```

## When to Use What

| Context | Client | Why |
|---------|--------|-----|
| oRPC procedure | `context.supabase` | User-scoped, RLS enforced |
| Server component | `createClient()` from server.ts | Cookie-based auth, RLS enforced |
| Inngest function | `createAdminClient()` | No user session, needs direct DB access |
| Supabase Edge Function | service role from env | Same as Inngest — trusted server context |

## Hard Rules

- **NEVER** import `createAdminClient` in client components or oRPC procedures
- **NEVER** call oRPC from Inngest functions — always go direct to Supabase
- **ALWAYS** create the client inside `step.run()`, not at function scope
- **ALWAYS** handle errors — `if (error) throw error` so Inngest retries the step
- Pass IDs in events, look up data in steps — don't embed large payloads in events
