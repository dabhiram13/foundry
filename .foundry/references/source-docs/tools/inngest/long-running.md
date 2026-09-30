# Inngest - Long-Running Tasks

## The Execution Model

Inngest functions do **not** run as a single continuous process. Each step is a separate HTTP request to your server. Between steps, your function is not running -- Inngest orchestrates when to call your server next.

This means:
- A function with `step.sleep("wait", "7 days")` does not occupy a server for 7 days
- No compute is consumed between steps
- Serverless function timeouts (e.g., Vercel 10s/60s) only apply to individual steps, not the entire function
- A function can span minutes, hours, days, or up to a year

## Breaking Work Into Steps

The key to long-running work is decomposing it into steps that each complete within your platform's request timeout.

```typescript
export const processLargeDataset = inngest.createFunction(
  { id: "process-large-dataset" },
  { event: "data/dataset.uploaded" },
  async ({ event, step }) => {
    // Step 1: Get chunk list (must complete within platform timeout)
    const chunks = await step.run("get-chunks", async () => {
      return await splitDatasetIntoChunks(event.data.datasetId, 100);
    });

    // Step 2+: Process each chunk as its own step
    for (let i = 0; i < chunks.length; i++) {
      await step.run(`process-chunk-${i}`, async () => {
        return await processChunk(chunks[i]);
      });
    }

    // Final step: Aggregate results
    await step.run("finalize", async () => {
      return await finalizeDataset(event.data.datasetId);
    });
  }
);
```

Each `step.run()` is a separate request. If chunk 47 fails, only chunk 47 retries -- chunks 0-46 are memoized.

## Timeouts

Configure timeouts to prevent runaway functions:

```typescript
export const boundedTask = inngest.createFunction(
  {
    id: "bounded-task",
    timeouts: {
      start: "30s",   // Cancel if queued for more than 30s before first step starts
      finish: "10m",  // Cancel if total execution exceeds 10 min after starting
    },
  },
  { event: "task/run" },
  async ({ event, step }) => {
    // ...
  }
);
```

| Timeout | Controls | Starts When |
|---|---|---|
| `timeouts.start` | Max time in queue before first step | Event received / function enqueued |
| `timeouts.finish` | Max total execution time | First step begins executing |

**Limitations**:
- `timeouts.finish` does not kill a step mid-execution. It cancels the function between steps (after a step completes or during sleep).
- Concurrency delays can extend actual time beyond the timeout before cancellation fires.

## Delegating to Sub-Functions

For truly large workloads, use `step.invoke()` to delegate to child functions with their own configuration:

```typescript
export const orchestrator = inngest.createFunction(
  { id: "orchestrator", retries: 2 },
  { event: "pipeline/start" },
  async ({ event, step }) => {
    const manifest = await step.run("build-manifest", async () => {
      return await buildProcessingManifest(event.data.pipelineId);
    });

    // Each item is processed by a separate function with its own retries/concurrency
    for (const item of manifest.items) {
      await step.invoke(`process-${item.id}`, {
        function: processItemFn,
        data: { itemId: item.id },
        timeout: "5m",
      });
    }
  }
);

export const processItemFn = inngest.createFunction(
  {
    id: "process-item",
    retries: 5,
    concurrency: { limit: 10 }, // Independent concurrency control
  },
  { event: "pipeline/process-item" },
  async ({ event, step }) => {
    // Heavy processing with its own retry budget
  }
);
```

## Sleeps and Delays

Use `step.sleep()` for delays -- your function is not running during sleep:

```typescript
await step.run("send-welcome", async () => {
  await sendWelcomeEmail(event.data.userId);
});

// No compute used for 3 days
await step.sleep("wait-for-engagement", "3 days");

await step.run("check-engagement", async () => {
  const engaged = await checkUserEngagement(event.data.userId);
  if (!engaged) {
    await sendFollowUpEmail(event.data.userId);
  }
});
```

## Pitfalls

- **Platform timeouts apply per step, not per function**: On Vercel Hobby (10s limit), each `step.run()` must complete in 10s. The function itself can span days.
- **Step data accumulates**: Every step's return value is stored in the function run state. Returning large objects from many steps can cause memory issues. Return only what subsequent steps need.
- **Loops re-execute from the start**: The handler re-runs for each step. In a 1000-iteration loop, the handler iterates 1000 times on the final step -- but memoized steps return instantly. Still, avoid extremely large loops (>1000 steps). Use fan-out with `step.sendEvent()` or `step.invoke()` instead.
- **No in-memory state between steps**: Variables not returned from a step are lost. Each step starts with a fresh execution context.
- **`timeouts.finish` does not abort steps**: If a single step takes 10 minutes and your timeout is 5 minutes, the step will complete (or timeout per your platform), and the function cancels on the next step boundary.
