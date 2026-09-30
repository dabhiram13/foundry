# Credit System Architecture

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Token-optimized reference. Read this before touching credit tables or functions.

## Data Model

```
credit_allocations (config, read-only for users)
  plan + credit_type -> allocation amount + period

credit_balances (denormalized, one row per user/type/period)
  user_id + credit_type + period_start -> balance, allocation, period

credit_ledger (append-only audit trail)
  user_id + credit_type + amount + type + description + period_start
```

### Tables

**credit_allocations** — config table. Maps plan to allocation per credit type.

| Column | Type | Notes |
|--------|------|-------|
| plan | text | PK with credit_type. Matches `get_user_plan()` output. |
| credit_type | text | e.g. `generation`, `api_call`, `export` |
| allocation | integer | Credits per period |
| period | text | `day`, `week`, or `month` |

RLS: SELECT for all authenticated (config data).

**credit_balances** — denormalized balance per user/type/period.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| credit_type | text | |
| balance | integer | Current remaining credits |
| allocation | integer | What was allocated at period start |
| period | text | `day`, `week`, `month` |
| period_start | timestamptz | Start of current period |
| created_at | timestamptz | |
| updated_at | timestamptz | |

UNIQUE: (user_id, credit_type, period_start). RLS: SELECT own rows only.

**credit_ledger** — append-only journal. Never delete rows.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| credit_type | text | |
| amount | integer | Positive=credit, negative=debit |
| type | text | `allocation`, `consumption`, `refund`, `bonus`, `reset` |
| description | text | Human-readable reason |
| metadata | jsonb | Optional context (procedure name, error, etc.) |
| period_start | timestamptz | Which period this entry belongs to |
| created_at | timestamptz | |

RLS: SELECT own rows only. No INSERT/UPDATE/DELETE for users.

## Functions

### consume_credits(p_user_id, p_credit_type, p_cost, p_allocation, p_period) -> jsonb

Atomic debit with lazy allocation. Called by `withCredits()` middleware, which passes the plan's
allocation and period from `CREDIT_CONFIG` (`webapp/lib/credits/config.ts`).

Flow:
1. Reject a non-positive `p_cost` (`error: 'bad_cost'`)
2. `get_user_plan(p_user_id)` — resolves plan live from Stripe (not JWT cache)
3. Look up `credit_allocations` for plan + credit_type -> allocation + period. That row wins.
   No row for the plan -> fall back to `p_allocation` / `p_period`. Neither -> `error: 'no_allocation'`,
   nothing granted. An unknown period unit -> `error: 'bad_period'`
4. Compute period start (`date_trunc(period, now())`)
5. `SELECT ... FOR UPDATE` on balance row (row-level lock)
6. If no row: INSERT (lazy allocation) + ledger entry type=`allocation`
7. Race condition guard: ON CONFLICT DO NOTHING + re-SELECT FOR UPDATE
8. Check balance >= cost. If insufficient: return `{ success: false, balance, needed }`
9. Debit: UPDATE balance, INSERT ledger type=`consumption`
10. Return `{ success: true, balance, allocation }`

Why resolve plan live (not from JWT)?
- JWT plan can be stale up to 1 hour
- Allocation happens at first consumption per period
- If user upgrades mid-period, next period gets correct allocation
- If user downgrades, current period keeps existing allocation (fair)

### refund_credits(p_user_id, p_credit_type, p_amount) -> jsonb

Reversal on handler failure. Called by `withCredits()` middleware catch block.

Finds the latest balance row for the user/type (no period guessing needed). Adds amount back to balance. Inserts ledger entry type=`refund`. Returns `{ success: false, error: 'no_balance_row' }` if no balance exists.

### get_user_plan(p_user_id) -> text

Defined in `02-billing.sql`. Hybrid: checks lifetime first, then subscriptions.

```
1. _stripe_resolve_customer_id(user_id) -> customer_id
2. IF NULL -> 'free'
3. Check stripe.checkout_sessions for lifetime purchase (metadata.tier='lifetime')
4. IF found -> 'lifetime'
5. Check stripe.subscriptions for active/trialing (highest tier wins)
6. IF found -> tier from product metadata
7. Default -> 'free'
```

Priority: lifetime > pro > starter > free

### Variant: Subscription-only get_user_plan

If your product has no one-time purchases, skip step 3-4. The default hybrid version handles this automatically (no matching checkout_sessions = no-op).

### Variant: One-time-only get_user_plan

Replace step 5 with a `purchases` table lookup:

```sql
-- purchases table: SELECT-only RLS, inserts via SECURITY DEFINER RPC
SELECT tier INTO v_tier FROM public.purchases
WHERE user_id = p_user_id
ORDER BY purchased_at DESC LIMIT 1;
```

See `steps/04-jwt-hook.md` for the full `purchases` table + `record_purchase()` RPC pattern.

## Middleware: withCredits()

```typescript
// webapp/lib/credits/with-credits.ts
export function withCredits(opts: { type: string; cost: number }) {
  return async (input, context, next) => {
    const result = await supabase.rpc('consume_credits', {
      p_user_id: context.user.id,
      p_credit_type: opts.type,
      p_cost: opts.cost,
      p_allocation: creditConfig.allocations[plan],
      p_period: creditConfig.period,
    })
    if (!result.data?.success) throw new CreditError(result.data)
    try {
      return await next(input, context)
    } catch (error) {
      // Auto-refund on failure
      await supabase.rpc('refund_credits', {
        p_user_id: context.user.id,
        p_credit_type: opts.type,
        p_amount: opts.cost,
      })  // finds latest period automatically
      throw error
    }
  }
}
```

Usage in oRPC:
```typescript
export const generateReport = protectedProcedure
  .use(withCredits({ type: 'generation', cost: 1 }))
  .handler(async ({ context }) => {
    // If this throws, credits are automatically refunded
  })
```

## Seed Data

Default allocations (customize per project):

| Plan | Credit Type | Allocation | Period |
|------|-------------|-----------|--------|
| free | generation | 0 | month |
| starter | generation | 10 | month |
| pro | generation | 50 | month |
| lifetime | generation | 999999 | month |

The `free` row is required: `get_user_plan()` returns `'free'` for every user without a Stripe
customer, and a missing row is a config error, not an empty balance. It is seeded at 0 because
entitlement is fail-closed — raise it deliberately if the project grants free usage.

Add rows to `credit_allocations` for new credit types or plans.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| First consumption of period | Lazy-allocates balance row + ledger entry |
| Two concurrent first-consumptions | ON CONFLICT DO NOTHING + re-SELECT FOR UPDATE (safe) |
| Plan upgrade mid-period | Current period keeps old allocation, next period gets new |
| Plan downgrade mid-period | Same — current period unaffected |
| Handler throws after debit | `withCredits()` calls `refund_credits` (auto-refund) |
| No allocation config for plan | Returns `{ success: false, error: 'no_allocation' }` |
| Balance insufficient | Returns `{ success: false, balance, needed }` — hard block |
| Lifetime plan (999999 credits) | Effectively unlimited, still tracked in ledger |

## Migration Files

| File | What |
|------|------|
| `02-billing.sql` | Tables, functions, seed data. Requires Stripe Sync Engine. |
| `03-subscriptions-security.sql` | JWT hook calls `get_user_plan()`, grants for `supabase_auth_admin`. |
