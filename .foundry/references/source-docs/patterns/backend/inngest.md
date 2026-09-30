# Inngest Patterns

Background jobs, cron, workflows, and queues. One file, everything you need.

---

## Setup

```typescript
// src/inngest/client.ts
import { Inngest } from "inngest"
export const inngest = new Inngest({ id: "my-app" })
```

```typescript
// src/app/api/inngest/route.ts
import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { myFunction } from "@/inngest/functions"
export const { GET, POST, PUT } = serve({ client: inngest, functions: [myFunction] })
```

All three methods required — GET for introspection, POST for execution, PUT for syncing.

Dev: `npx inngest-cli@latest dev` → dashboard at `http://localhost:8288`.
Prod: set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` in env.

---

## Quick Recipes

### Cron Job

```typescript
export const dailyCleanup = inngest.createFunction(
  { id: "daily-cleanup" },
  { cron: "0 0 * * *" }, // Midnight UTC
  async ({ step }) => {
    await step.run("clean-expired", async () => {
      const supabase = createAdminClient()
      const { error } = await supabase.from("sessions").delete().lt("expires_at", new Date().toISOString())
      if (error) throw error
    })
  }
)
```

Timezone: `{ cron: "TZ=America/New_York 0 9 * * *" }`. Without `TZ=`, runs in UTC.

Cron syntax: `minute hour day-of-month month day-of-week`. Common: `*/15 * * * *` (every 15min), `0 9 * * 1-5` (weekdays 9am), `0 0 1 * *` (monthly).

**Caveat**: Cron functions get NO event data. Don't destructure `event.data`.

### Event-Triggered (Manual)

```typescript
export const processOrder = inngest.createFunction(
  { id: "process-order" },
  { event: "shop/order.placed" },
  async ({ event, step }) => {
    await step.run("validate", async () => {
      return await validateOrder(event.data.orderId)
    })
    await step.run("charge", async () => {
      return await chargePayment(event.data.paymentMethodId)
    })
  }
)
```

**Trigger from code:**
```typescript
// Outside functions — use inngest.send()
await inngest.send({ name: "shop/order.placed", data: { orderId: "123" } })

// Inside functions — ALWAYS use step.sendEvent() (memoized, retried)
await step.sendEvent("notify", { name: "email/send", data: { to: "user@example.com" } })
```

### Multi-Trigger + Filter

```typescript
export const syncUser = inngest.createFunction(
  { id: "sync-user" },
  [{ event: "app/user.created" }, { event: "app/user.updated" }],
  async ({ event, step }) => { /* event.name tells which triggered */ }
)

// With CEL filter:
{ event: "shop/order.placed", if: "event.data.amount >= 10000" }
```

---

## Steps (Building Blocks)

Each step = separate HTTP request, independently retried, memoized. Your function is NOT running between steps.

| Step | What it does |
|------|-------------|
| `step.run("name", fn)` | Execute retriable code, return memoized result |
| `step.sleep("name", "24h")` | Pause (no compute consumed) |
| `step.sleepUntil("name", isoDate)` | Pause until specific datetime |
| `step.waitForEvent("name", opts)` | Pause until matching event or timeout |
| `step.sendEvent("name", events)` | Send events reliably (memoized) |
| `step.invoke("name", { function, data })` | Call another function, await result |

### step.waitForEvent

```typescript
const payment = await step.waitForEvent("wait-payment", {
  event: "shop/payment.completed",
  timeout: "30m",
  match: "data.orderId", // shorthand: match on this field
})
if (payment === null) { /* timeout */ } else { /* payment received */ }
```

Complex matching: `if: "event.data.userId == async.data.userId && async.data.plan == 'pro'"` (`event` = trigger, `async` = incoming).

### Parallel Steps

Don't await individual steps — collect with `Promise.all`:

```typescript
const [email, db, analytics] = await Promise.all([
  step.run("send-email", async () => sendEmail(data)),
  step.run("update-db", async () => updateDb(data)),
  step.run("track", async () => track(data)),
])
```

For large fan-out (>50 items), use `step.sendEvent()` instead of parallel steps.

---

## Supabase Access

Avoid calling oRPC from Inngest — it adds a round-trip through Vercel (`Inngest → Vercel → Supabase`). Instead, go direct to Supabase (`Inngest → Supabase`).

Two options:

### Option 1: Admin Client (direct queries)

```typescript
await step.run("create-profile", async () => {
  const supabase = createAdminClient() // Create INSIDE each step.run()
  const { error } = await supabase.from("profiles").insert({ id: userId, name })
  if (error) throw error
})
```

### Option 2: Supabase RPC (complex DB logic)

```sql
-- In a migration
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
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("process_order", { p_order_id: orderId })
  if (error) throw error
})
```

Use RPC when you need transactions, multiple writes, or complex logic that should run atomically in Postgres.

| Context | Client | Why |
|---------|--------|-----|
| oRPC procedure | `context.supabase` | User-scoped, RLS enforced |
| Server component | `createClient()` from server.ts | Cookie auth, RLS |
| Inngest function | `createAdminClient()` | No user session, direct DB |
| Inngest (complex) | `supabase.rpc()` | Atomic transactions, multi-write |

**Rules**: Create client inside each `step.run()`, never share across steps. Always `if (error) throw error`. Pass IDs in events, look up data in steps.

---

## Flow Control

| Feature | What | Excess | Lossy? |
|---------|------|--------|--------|
| `concurrency` | Parallel steps executing | Queued | No |
| `throttle` | Rate of new runs starting | Queued | No |
| `rateLimit` | Max runs per period | Skipped | Yes |
| `debounce` | Collapse rapid events | Only last runs | Yes |
| `batchEvents` | Group events into one run | Grouped | No |
| `priority` | Execution order in queue | Reordered | No |

### Common Patterns

```typescript
// Respect external API limits: 10 concurrent + 100/min
{ concurrency: { limit: 10 }, throttle: { limit: 100, period: "1m" } }

// Per-user: 1 concurrent per user
{ concurrency: { limit: 1, key: "event.data.userId" } }

// Account-wide shared limit (note inner quotes for literal key)
{ concurrency: { scope: "account", key: '"openai"', limit: 10 } }

// Debounce: wait 5min after last event, force after 1h
{ debounce: { period: "5m", key: "event.data.userId", timeout: "1h" } }

// Batch: group up to 100 events, wait max 10s
{ batchEvents: { maxSize: 100, timeout: "10s" } }
// Handler receives `events` array instead of `event`
```

**Throttle vs rate limit**: throttle queues excess (lossless), rate limit drops them (lossy).

---

## Retries

Default: 4 retries per step (5 total attempts). Exponential backoff (~10s, ~1min, ~5min, ~15min).

```typescript
{ id: "my-fn", retries: 10 } // 0-20, per-step independently

// Skip retries for permanent errors:
import { NonRetriableError } from "inngest"
throw new NonRetriableError("User not found", { cause: originalError })

// Control retry timing:
import { RetryAfterError } from "inngest"
throw new RetryAfterError("Rate limited", "5m")
```

### onFailure (after all retries exhausted)

```typescript
inngest.createFunction({
  id: "critical-fn",
  onFailure: async ({ error, event, step }) => {
    await step.run("alert", async () => { await sendAlert(error.message) })
  },
}, ...)
```

---

## Cancellation

```typescript
inngest.createFunction({
  id: "schedule-reminder",
  cancelOn: [{
    event: "tasks/reminder.deleted",
    if: "async.data.reminderId == event.data.reminderId",
  }],
}, { event: "tasks/reminder.created" }, async ({ event, step }) => {
  await step.sleepUntil("wait", event.data.remindAt)
  await step.run("send", async () => { /* ... */ })
})
```

Cancellation happens between steps, not mid-step. Max 5 `cancelOn` entries.

Timeout-based: `{ timeouts: { start: "30s", finish: "10m" } }`.

---

## Hard Rules

1. **One side effect per step** — if step does create + notify and fails after create, retry re-creates
2. **All non-deterministic code inside `step.run()`** — DB calls, API calls, `Date.now()`, `Math.random()`
3. **Return values must be JSON-serializable** — no functions, class instances, circular refs
4. **Code outside steps runs on every invocation** — handler re-executes per step, only step results are memoized
5. **`step.sendEvent()` inside functions, `inngest.send()` outside** — prevents duplicate sends on retry
6. **Create admin client inside each `step.run()`** — never share across steps
7. **Avoid calling oRPC from Inngest** — prefer direct Supabase access or `supabase.rpc()` to skip the Vercel round-trip
8. **Step IDs must be unique** — use dynamic IDs in loops: `step-${i}`
9. **`await` is required on all step methods** — forgetting it causes undefined behavior
10. **Pass IDs in events, look up data in steps** — keep event payloads lean
11. **Every function MUST have explicit `retries` config** — never rely on the default (4). Be intentional.
12. **Every function MUST have an `onFailure` handler** — at minimum log the error with function ID and event data. Silent failure = invisible data rot.
13. **Inngest is for workflows, not fire-and-forget** — simple one-shot side effects (send email, post webhook) use Supabase Edge Functions or direct API calls. Inngest adds value when you need: multi-step, cron, cancellation, retry logic, concurrency control, or sleepUntil.
14. **Concurrency config MUST be an array** — `concurrency: [{ limit: N, key: '...' }]`, not `concurrency: { limit: N }`. Inngest v3 requires the array format.
15. **Multiple functions in one file: single import block** — when defining multiple functions in one file, imports appear ONCE at the top. Never concatenate two function files.
16. **cancelOn for deletable entity processors** — any executor/processor for a user-deletable entity MUST include `cancelOn` with the deletion event.
17. **Loop state MUST come from step return values** — Inngest re-executes the handler per step. Only `step.run()` return values are memoized. Closure variables (counters, arrays) reset on re-execution. Track cumulative state in DB or prior step results.
18. **onFailure event shape** — the original triggering event lives at `event.data.event.data`. Extract explicitly — do not guess the nesting.
