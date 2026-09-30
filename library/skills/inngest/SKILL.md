---
name: inngest
description: >
  Inngest durable functions for TypeScript — setup, events, steps, durable functions, flow control,
  and middleware. Use for "inngest", "durable function", "background job", "event-driven workflow",
  "step.run", "step.sleep", "step.waitForEvent", "inngest cron", "concurrency limits", "throttling",
  "retry backoff", "inngest setup". All depth lives under `references/`.
---

# Inngest

Index. Load the reference that matches the task.

| Task | Reference |
|---|---|
| Install SDK, create client, serve endpoint, dev server | `references/inngest-setup/` |
| Event schema, payload format, naming, idempotency, fan-out | `references/inngest-events/` |
| `step.run` / `step.sleep` / `step.waitForEvent` / `step.sendEvent` / `step.invoke` / `step.ai` | `references/inngest-steps/` |
| Triggers (events, cron, invoke), memoization, cancellation, retries, observability | `references/inngest-durable-functions/` |
| Concurrency keys, throttling, rate limiting, debounce, priority, singleton, batching | `references/inngest-flow-control/` |
| Middleware lifecycle, DI, encryption, Sentry integration | `references/inngest-middleware/` |
