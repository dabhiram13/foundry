# Inngest

Background jobs, cron, workflows, and queues for Next.js — no infrastructure to manage.

## Docs Index

| File | What it covers |
|------|---------------|
| [get-started.md](./get-started.md) | Install, configure, serve, verify |
| [api-keys-setup.md](./api-keys-setup.md) | Environment variables, dev server vs cloud, signing key rotation |
| [cron.md](./cron.md) | Scheduled functions with cron syntax and timezone handling |
| [manual-trigger.md](./manual-trigger.md) | Sending events to trigger functions from your code |
| [steps.md](./steps.md) | `step.run()`, `step.sleep()`, `step.waitForEvent()`, `step.sendEvent()`, `step.invoke()` |
| [retries.md](./retries.md) | Per-step automatic retries, custom limits, `NonRetriableError`, backoff |
| [long-running.md](./long-running.md) | Execution model, timeouts, step decomposition for long tasks |
| [cancellation.md](./cancellation.md) | Declarative cancellation via events, CEL expressions |
| [concurrency.md](./concurrency.md) | Concurrency, throttle, rate limit, debounce, batching, priority |
| [parallel.md](./parallel.md) | `Promise.all` with steps, dynamic fan-out patterns |
| [supabase-direct.md](./supabase-direct.md) | Admin client for direct Supabase access from Inngest (no oRPC round-trip) |
| [replay.md](./replay.md) | Replay failed functions from dashboard, observability, `onFailure` |

## Install

```bash
npm install inngest
```

## Create Client

```typescript
// src/inngest/client.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "my-app" });
```

## Serve (Next.js App Router)

```typescript
// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { myFunction } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [myFunction],
});
```

All three methods required — `GET` for introspection, `POST` for execution, `PUT` for syncing.

## Dev Server

```bash
npx inngest-cli@latest dev
```

Opens dashboard at `http://localhost:8288`. Auto-connects to your Next.js app in dev mode.

## Verify

1. `npm run dev` — start your app
2. `npx inngest-cli@latest dev` — start Inngest dev server
3. Open `http://localhost:8288` — your functions should appear

## Production

1. Get **Event Key** and **Signing Key** from [app.inngest.com](https://app.inngest.com)
2. Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in your hosting env
3. Deploy — auto-syncs on supported platforms (Vercel, etc.)

## Pitfalls

- **Missing `PUT` export** — syncing fails silently without it
- **`INNGEST_DEV=1` in production** — disables signature verification
- **Signing key rotation** — set `INNGEST_SIGNING_KEY_FALLBACK` to the old key during transition
