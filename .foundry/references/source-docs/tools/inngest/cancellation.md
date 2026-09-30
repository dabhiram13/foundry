# Inngest - Cancellation

## Cancel on Events

Cancel a running or sleeping function when a specific event is received.

```typescript
import { inngest } from "@/inngest/client";

export const scheduleReminder = inngest.createFunction(
  {
    id: "schedule-reminder",
    cancelOn: [
      {
        event: "tasks/reminder.deleted",
        if: "async.data.reminderId == event.data.reminderId",
      },
    ],
  },
  { event: "tasks/reminder.created" },
  async ({ event, step }) => {
    await step.sleepUntil("wait-for-time", event.data.remindAt);
    await step.run("send-reminder", async () => {
      await pushNotificationService.push(event.data.userId, event.data.body);
    });
  }
);
```

How it works:
1. Function is triggered by `"tasks/reminder.created"`
2. A cancellation listener is created for `"tasks/reminder.deleted"`
3. The `if` expression matches the triggering event (`event`) against the cancellation event (`async`)
4. If a matching cancellation event arrives while the function is sleeping or between steps, the function is cancelled

## Expression Syntax

- `event` -- the original triggering event
- `async` -- the cancellation event
- Uses Common Expression Language (CEL)

```typescript
cancelOn: [
  {
    event: "order/cancelled",
    // Match on orderId AND ensure the canceller has permission
    if: "async.data.orderId == event.data.orderId && async.data.role == 'admin'",
  },
],
```

## Multiple Cancellation Events

Up to 5 cancellation event configurations per function:

```typescript
cancelOn: [
  {
    event: "subscription/cancelled",
    if: "async.data.userId == event.data.userId",
  },
  {
    event: "subscription/upgraded",
    if: "async.data.userId == event.data.userId",
  },
  {
    event: "admin/force-cancel",
    if: "async.data.targetUserId == event.data.userId",
  },
],
```

## Cancellation with Timeout

Only listen for the cancellation event during a window:

```typescript
cancelOn: [
  {
    event: "order/cancelled",
    if: "async.data.orderId == event.data.orderId",
    timeout: "1h", // Only cancellable for the first hour
  },
],
```

After the timeout, the cancellation listener is removed and the function cannot be cancelled by this event.

## Timeout-Based Cancellation

Cancel functions that take too long to start or finish, without needing a cancellation event:

```typescript
export const timeBoundedFn = inngest.createFunction(
  {
    id: "time-bounded",
    timeouts: {
      start: "10s",   // Cancel if not started within 10s of being queued
      finish: "30s",  // Cancel if not finished within 30s of starting
    },
  },
  { event: "task/run" },
  async ({ event, step }) => {
    // ...
  }
);
```

| Property | What it limits | Timer starts |
|---|---|---|
| `timeouts.start` | Time spent queued before first step | When run is enqueued |
| `timeouts.finish` | Total execution time after starting | When first step attempt begins |

## System Event on Cancellation

Cancelled functions emit an `inngest/function.cancelled` system event. You can listen for this to handle cleanup:

```typescript
export const handleCancellation = inngest.createFunction(
  { id: "handle-cancellation" },
  { event: "inngest/function.cancelled" },
  async ({ event, step }) => {
    await step.run("cleanup", async () => {
      // event.data contains details about the cancelled function
      await cleanupResources(event.data.function_id, event.data.run_id);
    });
  }
);
```

## Bulk Cancellation via API

Cancel multiple function runs via the REST API:

```
POST /v1/cancellations
{
  "app_id": "my-app",
  "function_id": "schedule-reminder",
  "started_after": "2025-01-01T00:00:00Z",
  "started_before": "2025-01-31T23:59:59Z"
}
```

## Pitfalls

- **Cancellation happens between steps, not mid-step**: A step that is actively executing will complete (or fail/retry). The function is cancelled at the next step boundary or during a sleep.
- **Step duration is unaffected by `timeouts.finish`**: A single step running for 10 minutes will not be cut short by a 5-minute finish timeout. The cancellation fires after the step completes.
- **Concurrency can delay timeout evaluation**: If a function is waiting for a concurrency slot, `timeouts.start` may take longer than expected to trigger cancellation.
- **Batching is incompatible with cancellation events**: Functions using `batchEvents` cannot use `cancelOn`.
- **Max 5 cancellation events**: You can define at most 5 entries in the `cancelOn` array.
- **Cancelled runs are final**: Once cancelled, a function run cannot be restarted. You would need to send the triggering event again.
