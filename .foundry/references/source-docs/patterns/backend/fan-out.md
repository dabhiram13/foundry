# Fan-out Pattern

When a feature loops over user-provided items that each make external API calls or heavy work, use fan-out: one orchestrator function emits N events, N workers process 1 item each with a concurrency cap.

## When to use

| Situation | Fan-out? |
|---|---|
| Loop of 5+ items with external API calls | YES |
| Any loop where per-item processing >2s | YES |
| Loop that could exceed 60s total wall time | YES |
| Simple DB batch update, no external calls | NO — batch SQL |
| Single item processing | NO — direct `step.run` |

## Template

```ts
// Orchestrator — emits one event per item
export const processOrchestrator = inngest.createFunction(
  { id: 'process-orchestrator' },
  { event: 'user/request.process' },
  async ({ event, step }) => {
    const events = event.data.items.map((item) => ({
      name: 'user/item.process',
      data: { userId: event.data.userId, item },
    }))
    await step.sendEvent('fan-out', events)
  }
)

// Worker — processes one item, concurrency-limited per user
export const processWorker = inngest.createFunction(
  {
    id: 'process-worker',
    concurrency: { limit: 10, key: 'event.data.userId' },
  },
  { event: 'user/item.process' },
  async ({ event, step }) => {
    // ... process single item in <60s, persist result in DB
  }
)
```

## Rules

1. Worker MUST complete in <60s at max scale — do the scale math first.
2. Concurrency `key` scoped per user, never global (global = one slow user blocks everyone).
3. External API calls inside the worker, never the orchestrator.
4. Persist results in the worker — never return data through the event chain.
5. Use `step.sendEvent(...)` with an array, not multiple `inngest.send` calls.
6. Data that expires (CDN URLs, temp tokens) must be downloaded to Storage during the worker run.

## Scale math (required in backend-brief)

`{N items} × {M API calls each}` = total calls. At `{X ms/call}` = wall time per worker. If >50s, split further or batch calls. Document the math in `decisions.md`.

## Gotchas

- Concurrency without a `key` = global cap — almost always wrong for per-user workloads.
- Returning data from worker back to orchestrator is an anti-pattern. Worker writes to DB, caller polls or subscribes.
- Orchestrator should be idempotent — if the same event arrives twice, it should emit the same N events and the workers dedupe downstream.
