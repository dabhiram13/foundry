# Inngest - Replay, Debugging, Observability

## What Is Replay?

Replay allows you to re-run failed function runs in bulk. Instead of dead letter queues, Inngest stores the original events and function state, letting you fix your code and replay failures.

## How Replay Works

1. A function run fails after exhausting all retries
2. Inngest stores the full event payload and run history
3. You fix the bug in your code and deploy
4. From the Inngest dashboard, select failed runs and replay them
5. Inngest re-sends the original events, triggering new function runs with your fixed code

Replayed runs are brand new function runs -- they start from scratch, not from the failed step.

## Replay from the Dashboard

In the Inngest Cloud dashboard:

1. Navigate to **Functions** and select the failed function
2. Filter runs by status: **Failed**
3. Select individual runs or use **Bulk Replay** to replay all matching runs
4. Confirm replay -- new runs are created from the original events

## No Dead Letter Queues

Traditional queues move failed messages to a dead letter queue (DLQ) where they sit until manually processed. Inngest eliminates DLQs by:

- Storing all events permanently (within your plan's retention)
- Linking every function run to its triggering event
- Allowing replay at any time after a fix is deployed
- Preserving full run history (which steps succeeded, which failed, error messages)

## Observability Features

### Function Run Traces

Every function run has a detailed trace showing:
- Each step's status (completed, failed, retrying)
- Step input/output data
- Error messages and stack traces
- Timing information (when each step ran, how long it took)
- Retry attempts per step

### Logging

Use the `logger` object in your function handler:

```typescript
async ({ event, step, logger }) => {
  logger.info("Processing order", { orderId: event.data.orderId });

  await step.run("validate", async () => {
    logger.debug("Validating order data");
    // ...
  });

  logger.warn("Order took longer than expected");
};
```

Logger levels: `fatal`, `error`, `warn`, `info`, `debug`. Configure the level via `INNGEST_LOG_LEVEL`.

### Run ID

Each function run has a unique `runId` available in the handler:

```typescript
async ({ event, step, runId }) => {
  // Use runId for correlation in external logging systems
  await step.run("process", async () => {
    externalLogger.info("Processing", { inngestRunId: runId });
  });
};
```

## System Events for Monitoring

### inngest/function.failed

Emitted when a function exhausts all retries and fails permanently:

```typescript
export const alertOnFailure = inngest.createFunction(
  { id: "alert-on-failure" },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    await step.run("send-alert", async () => {
      await sendPagerDutyAlert({
        functionId: event.data.function_id,
        runId: event.data.run_id,
        error: event.data.error,
      });
    });
  }
);
```

### inngest/function.cancelled

Emitted when a function is cancelled (via `cancelOn` or timeouts):

```typescript
export const handleCancelled = inngest.createFunction(
  { id: "handle-cancelled" },
  { event: "inngest/function.cancelled" },
  async ({ event, step }) => {
    await step.run("cleanup", async () => {
      await cleanupResources(event.data.function_id);
    });
  }
);
```

## onFailure Handler (Per-Function)

Handle failures inline within the function definition:

```typescript
export const criticalFn = inngest.createFunction(
  {
    id: "critical-function",
    onFailure: async ({ error, event, step }) => {
      await step.run("notify-team", async () => {
        await slack.post("#alerts", {
          text: `Critical function failed: ${error.message}`,
          event: JSON.stringify(event.data),
        });
      });
    },
  },
  { event: "critical/event" },
  async ({ event, step }) => { /* ... */ }
);
```

The `onFailure` handler runs as a separate function with its own retries.

## Debugging Workflow

1. **Check the dashboard**: Find the failed run, inspect each step's status and error
2. **Read the error**: Stack traces are preserved per step. Look at which step failed and what the error message says
3. **Check retry history**: See how many attempts were made and what each attempt's error was
4. **Fix and deploy**: Push the fix to your production environment
5. **Replay**: Bulk-replay all affected runs from the dashboard
6. **Verify**: Monitor the replayed runs for success

## Pitfalls

- **Replay creates new runs**: Replayed events trigger entirely new function runs. If the original run partially succeeded and had side effects (e.g., sent an email in step 1), the replay will re-execute those steps. Ensure steps are idempotent.
- **Event retention**: Events are retained according to your plan's limits. Replay is only available while events are retained.
- **Code must be deployed before replay**: Replay triggers new runs against your currently deployed code. If you replay before deploying the fix, the runs will fail again.
- **onFailure also has retries**: If the `onFailure` handler itself fails, it retries with the default retry policy. An error in the failure handler does not prevent the original function from being marked as failed.
