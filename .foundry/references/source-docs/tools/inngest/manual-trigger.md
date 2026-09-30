# Inngest - Manual Trigger (Sending Events)

## Define an Event-Triggered Function

```typescript
import { inngest } from "@/inngest/client";

export const processOrder = inngest.createFunction(
  { id: "process-order" },
  { event: "shop/order.placed" },
  async ({ event, step }) => {
    // event.data is typed based on your event schemas
    const orderId = event.data.orderId;

    await step.run("validate-order", async () => {
      return await validateOrder(orderId);
    });

    await step.run("charge-payment", async () => {
      return await chargePayment(event.data.paymentMethodId, event.data.amount);
    });

    return { success: true, orderId };
  }
);
```

## Sending Events

### From Server-Side Code (Outside Functions)

```typescript
import { inngest } from "@/inngest/client";

// Single event
await inngest.send({
  name: "shop/order.placed",
  data: {
    orderId: "order_123",
    paymentMethodId: "pm_456",
    amount: 9999,
  },
});

// Multiple events at once
await inngest.send([
  { name: "shop/order.placed", data: { orderId: "order_123", amount: 100 } },
  { name: "shop/order.placed", data: { orderId: "order_124", amount: 200 } },
]);
```

### From Inside a Function (Use step.sendEvent)

```typescript
// Always use step.sendEvent() inside functions for reliable delivery
await step.sendEvent("fan-out-events", [
  { name: "email/send", data: { to: "user@example.com", template: "welcome" } },
  { name: "analytics/track", data: { event: "user_signup", userId: "u_123" } },
]);
```

`step.sendEvent()` is a durable step -- it is memoized and retried. Using `inngest.send()` inside a function handler risks duplicate sends on retries because it is not tracked as a step.

### Return Value

```typescript
const { ids } = await inngest.send({
  name: "shop/order.placed",
  data: { orderId: "order_123" },
});
// ids: string[] -- array of event IDs for lookup in the Inngest dashboard
```

## Event Payload Shape

```typescript
{
  name: "shop/order.placed",    // Required: event name (string)
  data: {                       // Required: arbitrary JSON-serializable data
    orderId: "order_123",
    amount: 9999,
  },
  user: {                       // Optional: user context
    id: "user_456",
    email: "user@example.com",
  },
  ts: 1700000000000,            // Optional: timestamp in ms. Defaults to now.
  id: "evt_unique_id",          // Optional: unique event ID for dedup
}
```

## Filtering Events with `if`

```typescript
export const handlePaidOrders = inngest.createFunction(
  { id: "handle-paid-orders" },
  {
    event: "shop/order.placed",
    if: "event.data.amount >= 10000", // Only orders >= $100.00
  },
  async ({ event, step }) => {
    // Only triggered for high-value orders
  }
);
```

Expressions use the Common Expression Language (CEL). Access event fields via dot notation.

## Multiple Event Triggers

```typescript
export const syncUser = inngest.createFunction(
  { id: "sync-user-data" },
  [
    { event: "app/user.created" },
    { event: "app/user.updated" },
  ],
  async ({ event, step }) => {
    // event.name tells you which event triggered the run
    await step.run("sync", async () => {
      return await syncToExternalCRM(event.data.userId);
    });
  }
);
```

Up to 10 triggers (event and/or cron) per function.

## Fan-Out: One Event, Multiple Functions

Multiple functions can listen to the same event. When you send `"app/user.created"`, every function with that trigger runs independently:

```typescript
// Function A
export const sendWelcome = inngest.createFunction(
  { id: "send-welcome-email" },
  { event: "app/user.created" },
  async ({ event, step }) => { /* ... */ }
);

// Function B
export const setupAccount = inngest.createFunction(
  { id: "setup-default-account" },
  { event: "app/user.created" },
  async ({ event, step }) => { /* ... */ }
);
```

Both run when a single `"app/user.created"` event is sent. No coupling between functions.

## Pitfalls

- **`inngest.send()` vs `step.sendEvent()`**: Inside a function handler, always use `step.sendEvent()`. Using `inngest.send()` inside a handler is not a tracked step -- on retry, the event will be sent again.
- **Event payload size**: Events are stored by Inngest. Keep payloads lean -- pass IDs and look up data in steps rather than embedding large objects.
- **Serialization**: All event data must be JSON-serializable. Dates, Buffers, and class instances will not survive serialization.
- **Event key required in production**: `inngest.send()` fails silently or throws if `INNGEST_EVENT_KEY` is not set outside dev mode.
