# Inngest - Steps

Steps are the building blocks of Inngest functions. Each step is an independently retried, memoized unit of work executed as a **separate HTTP request**.

## step.run()

Execute code as a retriable step. Returns a Promise resolving to the handler's return value.

```typescript
async ({ event, step }) => {
  const user = await step.run("fetch-user", async () => {
    return await db.users.findUnique({ where: { id: event.data.userId } });
  });

  // `user` is available here -- returned data is memoized
  const result = await step.run("send-email", async () => {
    return await sendEmail(user.email, "Welcome!");
  });

  return { emailId: result.id };
};
```

Key rules:
- Return values are serialized as JSON and memoized. On subsequent invocations, the step is skipped and the cached result is used.
- **One side effect per step.** If a step does two things (create + notify) and fails after the first, the retry will re-create.
- All non-deterministic code (DB calls, API calls, `Date.now()`, `Math.random()`) **must** be inside a `step.run()`.

## step.sleep()

Pause execution for a duration. No compute is consumed during sleep.

```typescript
await step.sleep("wait-before-reminder", "24 hours");
// Also accepts:
await step.sleep("short-delay", "30m");
await step.sleep("ms-delay", 5000);           // milliseconds
await step.sleep("temporal", Temporal.Duration.from({ hours: 1 })); // v3.33.0+
```

Maximum sleep: 1 year (7 days on free tier).

## step.sleepUntil()

Pause until a specific datetime.

```typescript
await step.sleepUntil("wait-for-scheduled-time", event.data.scheduledAt);
// Accepts any string parseable by `new Date()`, e.g. "2025-03-01T09:00:00Z"
```

**Pitfall**: Only use `sleepUntil` with dates that are static across function re-executions. Since the handler is re-invoked per step, a dynamic date like `new Date(Date.now() + 3600000)` will shift on every invocation. Use `step.sleep("1 hour")` instead for relative delays.

## step.waitForEvent()

Pause until a matching event is received, or timeout.

```typescript
const paymentEvent = await step.waitForEvent("wait-for-payment", {
  event: "shop/payment.completed",
  timeout: "30m",
  match: "data.orderId", // Match on event.data.orderId == async.data.orderId
});

if (paymentEvent === null) {
  // Timeout -- no matching event received within 30 minutes
  await step.run("cancel-order", async () => {
    return await cancelOrder(event.data.orderId);
  });
} else {
  // paymentEvent contains the full event payload
  await step.run("fulfill-order", async () => {
    return await fulfillOrder(paymentEvent.data.orderId);
  });
}
```

### Using `if` Instead of `match`

For complex matching logic using CEL expressions:

```typescript
const upgradeEvent = await step.waitForEvent("wait-for-upgrade", {
  event: "billing/plan.changed",
  timeout: "7d",
  if: "event.data.userId == async.data.userId && async.data.plan == 'pro'",
});
```

- `event` refers to the original triggering event
- `async` refers to the incoming event being waited for
- `match` and `if` are mutually exclusive

## step.sendEvent()

Send events reliably from within a function. Memoized and retried.

```typescript
// Single event
await step.sendEvent("notify-downstream", {
  name: "app/user.activated",
  data: { userId: event.data.userId },
});

// Multiple events
const { ids } = await step.sendEvent("fan-out-processing", [
  { name: "process/chunk", data: { chunkId: 1, batchId: "b_1" } },
  { name: "process/chunk", data: { chunkId: 2, batchId: "b_1" } },
  { name: "process/chunk", data: { chunkId: 3, batchId: "b_1" } },
]);
// ids: string[] -- event IDs for each sent event
```

## step.invoke()

Call another Inngest function and await its result. The invoked function runs as a separate function run with its own retries and configuration.

```typescript
import { processPaymentFn } from "@/inngest/functions";

const paymentResult = await step.invoke("charge-customer", {
  function: processPaymentFn,
  data: { customerId: event.data.customerId, amount: 4999 },
  timeout: "5m", // Optional. Default: 1 year.
});

// paymentResult contains the return value of processPaymentFn
```

### Reference Remote Functions

For functions in other apps, or to avoid importing heavy dependencies:

```typescript
import { referenceFunction } from "inngest";

const processPaymentRef = referenceFunction<typeof processPaymentFn>({
  functionId: "process-payment",
  appId: "payments-service", // Optional: for cross-app invocation
});

const result = await step.invoke("charge", {
  function: processPaymentRef,
  data: { amount: 100 },
});
```

### step.invoke() Error Behavior

- If the invoked function **fails** (exhausts retries): throws `NonRetriableError`
- If the invoked function **times out**: throws `NonRetriableError`
- If the invoked function is **not found**: throws `NonRetriableError`
- If the invoked function is **rate limited** or **debounced**: throws `NonRetriableError`

This prevents compounding retries (A invokes B invokes C -- on failure, C would run `retryCount^n` times otherwise).

## Check-After Pattern

Combine `step.sleep()` + `step.run()` to poll for a condition:

```typescript
async ({ event, step }) => {
  await step.run("start-export", async () => {
    return await startDataExport(event.data.exportId);
  });

  let status = "pending";
  let attempts = 0;

  while (status === "pending" && attempts < 10) {
    await step.sleep(`poll-wait-${attempts}`, "30s");
    status = await step.run(`check-status-${attempts}`, async () => {
      const result = await getExportStatus(event.data.exportId);
      return result.status;
    });
    attempts++;
  }

  if (status !== "completed") {
    throw new NonRetriableError(`Export did not complete after ${attempts} checks`);
  }
};
```

**Important**: Step IDs must be unique within a function. Use dynamic IDs (e.g., `check-status-${attempts}`) for steps inside loops. Inngest internally tracks a counter per unique step ID, so repeating the same ID in a loop works, but unique IDs improve debuggability.

## Pitfalls

- **Code outside steps runs on every invocation**: The function handler is re-executed for every step. Only code inside `step.run()` is memoized. Side effects outside steps will repeat.
- **Return values must be JSON-serializable**: `step.run()` serializes return values as JSON. Functions, class instances, `undefined` (in arrays), and circular references will fail.
- **One side effect per step**: If step A creates a DB record and sends an email, and the email fails, the retry re-creates the record. Split into two steps.
- **`await` is required**: All step methods return Promises. Forgetting `await` causes the step to not execute or complete in an undefined order.
- **Variable scoping**: Variables set inside `step.run()` closures are not accessible outside. Return the value from the step.
