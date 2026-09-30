# Inngest - Cron (Scheduled Functions)

## Basic Cron Trigger

```typescript
import { inngest } from "@/inngest/client";

export const dailyCleanup = inngest.createFunction(
  { id: "daily-cleanup" },
  { cron: "0 0 * * *" }, // Midnight UTC daily
  async ({ step }) => {
    // Note: cron-triggered functions do NOT receive an `event` argument
    // with user data. The event object exists but contains only metadata.
    await step.run("clean-expired-sessions", async () => {
      return await db.sessions.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    });
  }
);
```

## Schedule Syntax

Standard 5-field unix-cron:

```
*  *  *  *  *
|  |  |  |  |
|  |  |  |  +-- Day of week (0-7, Sun=0 or 7)
|  |  |  +---- Month (1-12)
|  |  +------- Day of month (1-31)
|  +---------- Hour (0-23)
+------------- Minute (0-59)
```

| Pattern | Meaning |
|---|---|
| `0 0 * * *` | Daily at midnight |
| `*/15 * * * *` | Every 15 minutes |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `0 0 1 * *` | First day of every month |

## Timezone Handling

Prefix the cron expression with `TZ=`:

```typescript
export const dailyDigest = inngest.createFunction(
  { id: "daily-digest" },
  { cron: "TZ=America/New_York 0 9 * * *" }, // 9 AM Eastern
  async ({ step }) => {
    await step.run("send-digest", async () => {
      return await sendDigestEmails();
    });
  }
);
```

Without a `TZ=` prefix, schedules run in **UTC**.

## Multiple Triggers

A single function can have up to 10 triggers, including multiple crons:

```typescript
export const frequentSync = inngest.createFunction(
  { id: "multi-schedule-sync" },
  [
    { cron: "TZ=America/New_York 0 9 * * *" },
    { cron: "TZ=America/New_York 0 17 * * *" },
  ],
  async ({ step }) => {
    await step.run("sync-data", async () => {
      return await syncExternalData();
    });
  }
);
```

Duplicate cron schedules for the same function are deduplicated by Inngest.

## Cron with Steps

Cron functions support all step methods:

```typescript
export const weeklyReport = inngest.createFunction(
  { id: "weekly-report", retries: 3 },
  { cron: "0 8 * * 1" }, // Monday 8 AM UTC
  async ({ step }) => {
    const data = await step.run("gather-metrics", async () => {
      return await gatherWeeklyMetrics();
    });

    const report = await step.run("generate-report", async () => {
      return await generateReport(data);
    });

    await step.run("send-report", async () => {
      await sendSlackMessage("#reports", report);
    });
  }
);
```

## Pitfalls

- **No event data**: Cron-triggered functions receive a minimal event object with no user-defined `data`. Do not destructure `event.data` expecting custom fields.
- **Timezone DST**: When using `TZ=`, Inngest respects daylight saving time transitions. A `0 2 * * *` cron in `America/New_York` may skip or double-fire during DST changes -- plan accordingly for time-sensitive operations.
- **Minimum interval**: The smallest cron interval is every minute (`* * * * *`). For sub-minute scheduling, use event-driven triggers with throttle/debounce instead.
- **Cold starts**: On serverless platforms, cron functions are subject to cold start latency. They are not guaranteed to execute at the exact second of the schedule.
