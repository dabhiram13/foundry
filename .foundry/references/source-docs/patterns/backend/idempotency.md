# Idempotency Pattern

External events (Stripe, Clerk, SES, generic webhooks) can arrive twice. Your handler MUST produce the same result on retry — no duplicate charges, no double emails, no drifted state.

## Two strategies

### A. `processed_events` table (explicit dedup)

```sql
CREATE TABLE IF NOT EXISTS public.processed_events (
  event_id text PRIMARY KEY,
  source text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_processed_events_cleanup
  ON public.processed_events (processed_at);
```

```ts
const admin = createAdminClient()

const { data: existing } = await admin
  .from('processed_events')
  .select('event_id')
  .eq('event_id', event.id)
  .maybeSingle()

if (existing) return { skipped: true }

// ... process (side effects OK here)

await admin
  .from('processed_events')
  .insert({ event_id: event.id, source: 'stripe' })
```

**Use when:** events have stable unique IDs, processing has side effects beyond DB writes (emails, external API calls, ledger entries).

### B. UPSERT on natural key

```ts
await admin
  .from('subscriptions')
  .upsert(
    {
      stripe_id: event.data.object.id,
      status: event.data.object.status,
      current_period_end: event.data.object.current_period_end,
    },
    { onConflict: 'stripe_id' }
  )
```

**Use when:** handler is pure DB state sync, the event maps to a single row, natural key exists. Simpler than strategy A when it applies.

## Rules

1. Pick ONE strategy per handler — don't mix.
2. Idempotency check happens BEFORE any side effect.
3. Webhook signature verification happens BEFORE idempotency check — never skip it.
4. For multi-step handlers, wrap each side effect in `step.run` — Inngest memoizes step results across retries.
5. Event ordering: if events can arrive out of order, compare a timestamp column on the row before overwriting — don't trust arrival order.
6. Add a retention cron for `processed_events` (delete rows older than 30d).

## Gotchas

- Stripe webhooks can arrive out-of-order. Compare `event.created` against the row's `updated_at` before overwriting state.
- Idempotency check inside `step.run` works across retries because Inngest memoizes step results — the dedup row is only inserted once even on worker retry.
- UPSERT strategy fails silently if the natural key constraint is missing. Always add `UNIQUE` on the natural key column.
- `processed_events` table itself needs a cleanup job — otherwise it grows forever.
