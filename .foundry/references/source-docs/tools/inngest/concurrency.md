# Inngest - Concurrency, Throttling, Rate Limiting, Batching, Debouncing, Priority

## Quick Comparison

| Feature | What it controls | Excess runs | Lossy? |
|---|---|---|---|
| **Concurrency** | Number of steps executing simultaneously | Queued | No |
| **Throttle** | Rate of new function runs starting | Queued for later | No |
| **Rate Limit** | Max function runs per time period | Skipped/ignored | Yes |
| **Debounce** | Collapses rapid events into one run | Only last event runs | Yes (previous events) |
| **Batching** | Groups events into single run | Grouped | No |
| **Priority** | Execution order in queue | Reordered | No |

---

## Concurrency

Limits the number of **concurrently executing steps** across function runs.

```typescript
// Simple: one concurrent execution at a time
export const syncFn = inngest.createFunction(
  {
    id: "sync-external",
    concurrency: { limit: 1 },
  },
  { event: "sync/requested" },
  async ({ event, step }) => { /* ... */ }
);
```

### Keyed Concurrency

Separate concurrency limits per key value:

```typescript
export const perUserSync = inngest.createFunction(
  {
    id: "per-user-sync",
    concurrency: {
      limit: 1,
      key: "event.data.userId", // Each userId gets its own limit of 1
    },
  },
  { event: "sync/requested" },
  async ({ event, step }) => { /* ... */ }
);
```

### Scoped Concurrency (Account vs Function)

```typescript
export const aiSummary = inngest.createFunction(
  {
    id: "ai-summary",
    concurrency: [
      {
        scope: "account",  // Shared across ALL functions using this key
        key: '"openai"',   // Literal string -- note the quotes inside quotes
        limit: 10,         // Max 10 concurrent OpenAI calls across your account
      },
      {
        scope: "fn",       // Default. Only this function.
        key: "event.data.accountId",
        limit: 1,          // Max 1 concurrent run of THIS function per accountId
      },
    ],
  },
  { event: "ai/summary.requested" },
  async ({ event, step }) => { /* ... */ }
);
```

- `scope: "fn"` (default) -- limit applies only to this function
- `scope: "account"` -- limit applies across all functions sharing the same `key` string
- Up to 2 concurrency entries per function (one per scope)
- `step.sleep()` does **not** count toward concurrency limits

---

## Throttle

Limits the rate of **new function runs starting** over time. Excess runs are enqueued for later (non-lossy).

```typescript
export const aiGenerate = inngest.createFunction(
  {
    id: "ai-generate",
    throttle: {
      limit: 10,       // 10 runs...
      period: "1m",    // ...per minute
      burst: 3,        // Allow up to 3 to start simultaneously (default: 1)
      key: "event.data.userId", // Optional: per-user throttle
    },
  },
  { event: "ai/generation.requested" },
  async ({ event, step }) => { /* ... */ }
);
```

| Parameter | Required | Description |
|---|---|---|
| `limit` | Yes | Max runs to start per period |
| `period` | Yes | Time window (`"1s"` to `"7d"`) |
| `burst` | No | Max runs allowed to start in a single burst (default: 1) |
| `key` | No | CEL expression for per-key throttling |

**Throttle vs Concurrency**: Throttle limits how many new runs *start*. Concurrency limits how many steps *execute simultaneously*. Use throttle to respect external API rate limits. Use concurrency to limit parallel resource usage.

---

## Rate Limit

Hard limit on function runs per time period. Excess events are **skipped** (lossy).

```typescript
export const webhookHandler = inngest.createFunction(
  {
    id: "webhook-handler",
    rateLimit: {
      limit: 100,       // Max 100 runs...
      period: "1h",     // ...per hour
      key: "event.data.webhookId", // Optional: per-webhook limit
    },
  },
  { event: "webhook/received" },
  async ({ event, step }) => { /* ... */ }
);
```

| Parameter | Required | Description |
|---|---|---|
| `limit` | Yes | Max function runs per period |
| `period` | Yes | Time window (max `"24h"`) |
| `key` | No | CEL expression for per-key rate limiting |

Uses the Generic Cell Rate Algorithm (GCRA). Events exceeding the limit are stored by Inngest but do **not** trigger function runs.

**Rate Limit vs Throttle**: Rate limit *drops* excess runs. Throttle *queues* them. Use rate limit when you can afford to skip events. Use throttle when every event must eventually be processed.

---

## Debounce

Delays execution until events stop arriving. Only the **last event** in the period triggers the function.

```typescript
export const syncContacts = inngest.createFunction(
  {
    id: "sync-contacts",
    debounce: {
      period: "5m",     // Wait 5 min after last event
      key: "event.data.userId", // Optional: per-user debounce
      timeout: "1h",    // Optional: max debounce window (force-run after 1h)
    },
  },
  { event: "contacts/updated" },
  async ({ event, step }) => {
    // event is the LAST event received in the debounce window
    await step.run("sync", async () => {
      return await syncContactsForUser(event.data.userId);
    });
  }
);
```

| Parameter | Required | Description |
|---|---|---|
| `period` | Yes | Delay before execution. Reset on each new event. Min `"1s"`, max `"7d"`. |
| `key` | No | CEL expression for per-key debounce |
| `timeout` | No | Max total delay. Function runs after this even if events keep arriving. |

**Debounce does not work with batched functions.**

---

## Batching

Group multiple events into a single function run. The function receives an `events` array.

```typescript
export const batchInsert = inngest.createFunction(
  {
    id: "batch-insert",
    batchEvents: {
      maxSize: 100,     // Max events per batch
      timeout: "10s",   // Max wait time to fill a batch
      key: "event.data.tableId", // Optional: batch by table
    },
  },
  { event: "db/row.created" },
  async ({ events, step }) => {
    // events is an array of all events in this batch
    await step.run("bulk-insert", async () => {
      const rows = events.map((e) => e.data.row);
      return await db.insert(rows);
    });
  }
);
```

| Parameter | Required | Description |
|---|---|---|
| `maxSize` | Yes | Max events in a single batch |
| `timeout` | Yes | Max time to wait for a full batch before executing |
| `key` | No | CEL expression to batch events by key |
| `if` | No | Boolean CEL expression -- only batch events where this is true |

### Conditional Batching

```typescript
batchEvents: {
  maxSize: 50,
  timeout: "5s",
  if: "event.data.priority == 'low'", // Only batch low-priority events
},
```

Events where the expression evaluates to `false` (or cannot be evaluated) are executed immediately without batching.

### System Safety

Inngest enforces a **10 MiB** limit per batch. If total event payload exceeds this, the batch starts early.

### Incompatible Features

Batching **cannot** be combined with: `idempotency`, `rateLimit`, `cancelOn`, or `priority`.

Batching **can** be combined with simple `concurrency` limits (but keyed concurrency is ignored when batching is enabled).

---

## Priority

Dynamically reorder function runs in the queue. Use with concurrency or throttle for meaningful effect.

```typescript
export const processJob = inngest.createFunction(
  {
    id: "process-job",
    concurrency: { limit: 5 },
    priority: {
      // CEL expression returning seconds (positive = higher priority)
      run: "event.data.plan == 'enterprise' ? 600 : event.data.plan == 'pro' ? 120 : -120",
    },
  },
  { event: "job/submitted" },
  async ({ event, step }) => { /* ... */ }
);
```

| Factor | Effect |
|---|---|
| Positive (e.g., `600`) | Runs ahead of jobs queued up to 600 seconds ago |
| `0` (default) | Normal priority |
| Negative (e.g., `-120`) | Delayed by 120 seconds relative to other jobs |

- Range: `-600` to `600` seconds
- **Not compatible with batching**
- Most useful when combined with throughput-limiting features (concurrency, throttle) -- without them, jobs rarely wait in queue

---

## Idempotency

Prevent duplicate events from triggering a function more than once in 24 hours:

```typescript
export const processOnce = inngest.createFunction(
  {
    id: "process-once",
    idempotency: "event.data.transactionId",
  },
  { event: "payment/received" },
  async ({ event, step }) => { /* ... */ }
);
```

Equivalent to `rateLimit` with `key`, `limit: 1`, `period: "24hr"`.

---

## Combining Controls

Common production patterns:

```typescript
// API-respecting function: 10 concurrent + throttle to 100/min
{
  id: "call-external-api",
  concurrency: { limit: 10 },
  throttle: { limit: 100, period: "1m" },
}

// Per-user fair scheduling with priority
{
  id: "generate-report",
  concurrency: { limit: 5, key: "event.data.orgId" },
  priority: { run: "event.data.isPaid ? 300 : 0" },
}
```

## Pitfalls

- **Throttle `period` max is 7 days**; rate limit `period` max is 24 hours.
- **Rate limit is lossy**: If every event must be processed, use throttle instead.
- **Debounce uses the last event**: All intermediate events are discarded. If you need all events, use batching.
- **Batching + keyed concurrency is broken**: The concurrency `key` is silently ignored when batching is enabled. Only the `limit` applies.
- **Priority without backlog is meaningless**: If there is no queue backlog (no concurrency/throttle limits), priority has no observable effect.
- **Account-scoped concurrency key must be a literal string**: `key: '"openai"'` (note the inner quotes). Using `key: "openai"` would look for `event.openai` in the event data.
