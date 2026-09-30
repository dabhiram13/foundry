# Inngest - Retries

## Default Behavior

Every function and step is retried **4 times** by default (5 total attempts: 1 initial + 4 retries). Retries use exponential backoff with jitter.

## Configure Retry Count

```typescript
export const importData = inngest.createFunction(
  {
    id: "import-data",
    retries: 10, // 0 to 20. Each step gets 10 retries independently.
  },
  { event: "data/import.requested" },
  async ({ event, step }) => {
    await step.run("fetch-data", async () => {
      return await fetchFromApi(event.data.url);
    });
    await step.run("store-data", async () => {
      return await storeInDb(event.data.payload);
    });
  }
);
```

Setting `retries: 0` disables retries entirely -- the step runs once and fails on error.

## Per-Step Retry Independence

Each `step.run()` has its **own independent retry counter**. If your function has 3 steps and `retries: 4`:

- Step A can fail and retry up to 4 times (5 total attempts)
- Step B gets its own 4 retries, unaffected by Step A's failures
- Step C gets its own 4 retries
- Theoretical maximum attempts across all steps: 15 (5 x 3)

A step that exhausts all retries throws a `StepError`, which can be caught:

```typescript
import { StepError } from "inngest";

async ({ event, step }) => {
  try {
    await step.run("flaky-api-call", async () => {
      return await callFlakyApi();
    });
  } catch (err) {
    if (err instanceof StepError) {
      // Step exhausted all retries -- handle gracefully
      await step.run("notify-failure", async () => {
        await notifySlack(`API call failed after all retries: ${err.message}`);
      });
    }
  }
};
```

`StepError` handling requires SDK v3.12.0+.

## Access the Attempt Number

```typescript
async ({ event, step, attempt }) => {
  // attempt is zero-indexed: 0 = first attempt, 1 = first retry, etc.
  // Resets after each step completes successfully.
  if (attempt > 2) {
    // On 4th attempt, use a fallback strategy
    await step.run("fallback", async () => {
      return await useFallbackProvider();
    });
  }
};
```

## NonRetriableError

Throw `NonRetriableError` to immediately fail without retrying. Use when the error is permanent.

```typescript
import { NonRetriableError } from "inngest";

await step.run("validate-user", async () => {
  const user = await db.users.findUnique({ where: { id: event.data.userId } });
  if (!user) {
    throw new NonRetriableError("User not found", {
      cause: new Error(`userId: ${event.data.userId}`),
    });
  }
  return user;
});
```

`NonRetriableError` accepts an optional `cause` in the options object for chaining errors.

## RetryAfterError

Control exactly when the next retry happens. Overrides the default backoff schedule.

```typescript
import { RetryAfterError } from "inngest";

await step.run("call-rate-limited-api", async () => {
  const response = await fetch("https://api.example.com/data");
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    throw new RetryAfterError(
      "Rate limited by external API",
      retryAfter ? parseInt(retryAfter) * 1000 : "5m" // ms or time string
    );
  }
  return await response.json();
});
```

`RetryAfterError` accepts:
- `number` -- milliseconds to delay
- `string` -- time string (`"30m"`, `"3 hours"`, `"2.5d"`)
- `Date` -- specific datetime to retry at

## onFailure Handler

Runs only after all retries are exhausted and the function fails permanently.

```typescript
export const processPayment = inngest.createFunction(
  {
    id: "process-payment",
    retries: 5,
    onFailure: async ({ error, event, step }) => {
      // This runs as a separate function with its own retries
      await step.run("alert-on-failure", async () => {
        await sendPagerDutyAlert({
          message: `Payment processing failed: ${error.message}`,
          orderId: event.data.orderId,
        });
      });
      await step.run("refund-if-charged", async () => {
        await attemptRefund(event.data.orderId);
      });
    },
  },
  { event: "shop/payment.initiated" },
  async ({ event, step }) => {
    // Main function logic
  }
);
```

The `onFailure` handler itself is a separate function with its own retry policy.

## Default Backoff Schedule

Inngest uses exponential backoff with jitter. The approximate delays between retries:

| Attempt | Approximate Delay |
|---|---|
| 1st retry | ~10s |
| 2nd retry | ~1 min |
| 3rd retry | ~5 min |
| 4th retry | ~15 min |

Exact values vary due to jitter. Use `RetryAfterError` to override specific retries.

## Pitfalls

- **Idempotency is required**: Steps may partially execute before failing. A step that creates a record and then fails on a subsequent line will retry the creation. Use upserts, not inserts.
- **`retries` sets per-step, not per-function**: `retries: 4` does not mean 4 total retries for the entire function. Each step independently gets 4 retries.
- **NonRetriableError from step.invoke()**: If an invoked function fails after all retries, the invoking step receives a `NonRetriableError`. This prevents exponential retry amplification across function chains.
- **Side effects outside steps**: Code outside `step.run()` is re-executed on every invocation. Never put API calls or DB writes outside of a step.
- **Error cause chain**: Always pass the original error as `cause` in `NonRetriableError` for debugging: `new NonRetriableError("msg", { cause: originalError })`.
