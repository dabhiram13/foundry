# Step 6: Credit System

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Set up the credit-based usage system: DB tables, serverless functions, backend config, middleware, and frontend display.

## Architecture

- **Ledger pattern**: append-only journal (`credit_ledger`) + denormalized balance (`credit_balances`)
- **Lazy allocation**: no cron — allocate on first access per period
- **Hard block**: when depleted, `consume_credits` returns `success: false`
- **Auto-refund**: `withCredits()` middleware refunds on handler failure
- **DB enforcement**: `credit_allocations` is the entitlement list — a configured plan's row wins over whatever the caller passes

## Migration

Applied by `/setup supabase` Step 4.4 from `.foundry/migrations/02-billing.sql`. Building outside `/setup`: apply that file with the `apply_migration` MCP call — do not hand-write these objects, they already exist.

### Tables
- `credit_allocations` — plan → credit type → allocation mapping (PK: plan + credit_type)
- `credit_balances` — denormalized balance per user/type/period (unique: user_id + credit_type + period_start)
- `credit_ledger` — append-only audit trail (allocation, consumption, refund, bonus, reset)

### Functions
- `consume_credits(p_user_id, p_credit_type, p_cost, p_allocation, p_period)` — atomic debit with lazy allocation. The `credit_allocations` row for the user's plan wins; `p_allocation`/`p_period` (passed by `withCredits()` from `CREDIT_CONFIG`) are the fallback for a plan that has no row. Neither → `{ success: false, error: 'no_allocation' }`
- `refund_credits(p_user_id, p_credit_type, p_amount)` — reversal on failure

There is no `get_credit_balances` RPC. Balances are read straight from `credit_balances` under RLS by `webapp/lib/orpc/procedures/credits.ts`.

### RLS
- `credit_allocations` — readable by all authenticated users (config data)
- `credit_balances` — users read own rows only
- `credit_ledger` — users read own rows only

### Seed Data
- free: 0 generations/month
- starter: 10 generations/month
- pro: 50 generations/month
- lifetime: 999999 generations/month (unlimited)

`free` is not optional. `get_user_plan()` returns it for every user without a Stripe customer, and a missing row makes `consume_credits` return `error: 'no_allocation'` — a config failure — instead of a clean out-of-credits result. It is seeded at 0 because entitlement is fail-closed: raise it deliberately if the project grants free usage. The period is `month`, matching `webapp/lib/credits/config.ts`.

## Backend Files

| File | Purpose |
|------|---------|
| `webapp/lib/credits/config.ts` | `CREDIT_CONFIG` — labels, periods, allocations per plan |
| `webapp/lib/credits/with-credits.ts` | `withCredits()` — middleware factory for credit-gated procedures |

## oRPC Procedure

| File | Purpose |
|------|---------|
| `webapp/lib/orpc/procedures/credits.ts` | `getBalance` procedure + `creditsRouter` |
| `webapp/lib/orpc/procedures/protected.ts` | Add `credits: creditsRouter` to `protectedRouter` |

## Frontend

| File | Purpose |
|------|---------|
| `webapp/features/credits/hooks/use-credits.ts` | `useCredits()` — TanStack Query hook |
| `webapp/features/credits/hooks/index.ts` | Barrel export |
| `webapp/features/credits/index.ts` | Feature barrel export |
| `webapp/features/stripe/components/billing-page.tsx` | Credit balance section with progress bars |

## Usage Example

```typescript
// Any procedure that costs credits:
export const generateReport = protectedProcedure
  .use(withCredits({ type: 'generation', cost: 1 }))
  .handler(async ({ context }) => {
    // If this throws, credits are automatically refunded
  })
```

## Output

Credit system fully operational. `npx tsc --noEmit` passes.
