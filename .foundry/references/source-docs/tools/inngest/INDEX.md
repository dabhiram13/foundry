# Inngest — Index

> Planner: read this to select files for the Reference Manifest.

| File | Contains | Select when | Agent |
|------|----------|-------------|-------|
| `get-started.md` | Install, configure, serve, verify | Feature needs background jobs (first setup) | Backend |
| `api-keys-setup.md` | Env variables, dev vs cloud, signing key rotation | Feature needs background jobs (first setup) | Backend |
| `cron.md` | Scheduled functions, cron syntax, timezone handling | Feature has scheduled/recurring tasks | Backend |
| `manual-trigger.md` | Sending events from code to trigger functions | Feature triggers background jobs from procedures | Backend |
| `steps.md` | step.run, step.sleep, step.waitForEvent, step.sendEvent, step.invoke | Feature has multi-step background workflows | Backend |
| `retries.md` | Automatic retries, NonRetriableError, custom backoff | Feature has fallible background tasks | Backend |
| `long-running.md` | Execution model, timeouts, step decomposition | Feature has long-running background tasks | Backend |
| `cancellation.md` | Declarative cancellation via events, CEL expressions | Feature needs cancellable background jobs | Backend |
| `concurrency.md` | Concurrency limits, throttle, rate limit, debounce, batching, priority | Feature has high-throughput background processing | Backend |
| `parallel.md` | Promise.all with steps, dynamic fan-out patterns | Feature has parallel background work | Backend |
| `supabase-direct.md` | Admin client, direct DB access, RPC from Inngest, when-to-use-what | Feature has Inngest functions that need DB access | Backend |
| `replay.md` | Replay failed functions, observability, onFailure handler | Optional — debugging reference | Backend |
