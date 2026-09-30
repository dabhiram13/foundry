# Inngest - Parallel Step Execution

## Basic Parallel Execution with Promise.all

Run multiple steps concurrently by **not** awaiting individual steps and collecting them with `Promise.all`:

```typescript
export const postPaymentFlow = inngest.createFunction(
  { id: "post-payment-flow" },
  { event: "stripe/charge.created" },
  async ({ event, step }) => {
    // Do NOT await these individually -- start them all, then await together
    const emailPromise = step.run("send-confirmation", async () => {
      return await sendConfirmationEmail(event.data.email);
    });

    const dbPromise = step.run("update-user", async () => {
      return await db.users.update({
        where: { id: event.data.userId },
        data: { lastPayment: new Date() },
      });
    });

    const analyticsPromise = step.run("track-payment", async () => {
      return await analytics.track("payment_completed", {
        userId: event.data.userId,
        amount: event.data.amount,
      });
    });

    // All three steps run in parallel
    const [emailResult, dbResult, analyticsResult] = await Promise.all([
      emailPromise,
      dbPromise,
      analyticsPromise,
    ]);

    return { emailResult, dbResult, analyticsResult };
  }
);
```

Inngest detects that the steps are not individually awaited and schedules them for parallel execution. Each step is still independently retried.

## Fan-Out: Dynamic Parallel Steps

Process a dynamic list of items in parallel:

```typescript
export const processChunks = inngest.createFunction(
  { id: "process-chunks" },
  { event: "data/uploaded" },
  async ({ event, step }) => {
    const chunks = await step.run("split-data", async () => {
      return await splitIntoChunks(event.data.fileUrl, 10);
    });

    // Create all step promises without awaiting
    const chunkPromises = chunks.map((chunk, i) =>
      step.run(`process-chunk-${i}`, async () => {
        return await processChunk(chunk);
      })
    );

    // Execute all in parallel
    const results = await Promise.all(chunkPromises);

    await step.run("aggregate", async () => {
      return await aggregateResults(results);
    });
  }
);
```

## Fan-Out via Events

For large-scale fan-out (hundreds/thousands of items), send events instead of creating steps. Each event triggers a separate function run with its own retries, concurrency, and lifecycle:

```typescript
// Orchestrator
export const orchestrator = inngest.createFunction(
  { id: "batch-orchestrator" },
  { event: "batch/start" },
  async ({ event, step }) => {
    const items = await step.run("get-items", async () => {
      return await getItemsToProcess(event.data.batchId);
    });

    // Fan out: one event per item
    await step.sendEvent(
      "dispatch-items",
      items.map((item) => ({
        name: "batch/process-item",
        data: { itemId: item.id, batchId: event.data.batchId },
      }))
    );
  }
);

// Worker (runs independently per item)
export const processItem = inngest.createFunction(
  {
    id: "batch-process-item",
    concurrency: { limit: 20 }, // Control parallelism across all items
    retries: 5,
  },
  { event: "batch/process-item" },
  async ({ event, step }) => {
    await step.run("process", async () => {
      return await doExpensiveWork(event.data.itemId);
    });
  }
);
```

## Fan-Out via step.invoke()

When you need the results of parallel sub-functions:

```typescript
export const mapReduce = inngest.createFunction(
  { id: "map-reduce" },
  { event: "report/generate" },
  async ({ event, step }) => {
    const regions = ["us-east", "us-west", "eu-west"];

    // Invoke sub-functions in parallel
    const reportPromises = regions.map((region) =>
      step.invoke(`generate-${region}`, {
        function: regionReportFn,
        data: { region, dateRange: event.data.dateRange },
        timeout: "5m",
      })
    );

    const reports = await Promise.all(reportPromises);

    // Reduce
    const finalReport = await step.run("merge-reports", async () => {
      return await mergeReports(reports);
    });

    return finalReport;
  }
);
```

Each invoked function has its own retry budget and concurrency. If one fails, it throws `NonRetriableError` in the invoking function.

## One Event, Multiple Functions (Implicit Fan-Out)

Multiple functions triggered by the same event run in parallel automatically:

```typescript
// All three run independently when "app/user.created" is sent
export const sendWelcome = inngest.createFunction(
  { id: "send-welcome" },
  { event: "app/user.created" },
  async ({ event, step }) => { /* ... */ }
);

export const setupDefaults = inngest.createFunction(
  { id: "setup-defaults" },
  { event: "app/user.created" },
  async ({ event, step }) => { /* ... */ }
);

export const syncCrm = inngest.createFunction(
  { id: "sync-crm" },
  { event: "app/user.created" },
  async ({ event, step }) => { /* ... */ }
);
```

## Pitfalls

- **Do not `await` before `Promise.all`**: `const result = await step.run(...)` followed by `Promise.all` is sequential, not parallel. Drop the `await` on individual steps.
- **Step IDs must be unique**: When creating steps in a loop, use dynamic IDs (`process-chunk-${i}`). Duplicate IDs cause undefined behavior.
- **Parallel steps share the function's retry budget**: Each parallel step independently retries per the function's `retries` config. 10 parallel steps with `retries: 4` means up to 50 total attempts.
- **Large fan-outs via steps hit limits**: Creating hundreds of parallel steps in a single function increases memory and serialization overhead. For >50 parallel operations, prefer event-based fan-out with `step.sendEvent()`.
- **`step.invoke()` failures are non-retriable**: If an invoked function fails permanently, the invoking step throws `NonRetriableError`. Wrap in try/catch if partial failure is acceptable.
- **Return value size**: All parallel step results are collected in memory. If each step returns large data, the aggregate can exceed serialization limits. Return only what you need.
