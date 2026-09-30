# Step 9: Verify

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## 1. Quality Gates

```bash
cd webapp && npx tsc --noEmit   # zero errors
cd webapp && npx next lint .     # zero errors
cd webapp && npm run build       # clean build
```

## 2. Stripe Products Synced

```sql
SELECT p.name, pr.id AS price_id, pr.unit_amount, pr.type
FROM stripe.products p
JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
WHERE p.active = true
ORDER BY pr.unit_amount;
```

Expected: all tiers visible with correct prices and types.

## 3. Database Functions

```sql
SELECT proname FROM pg_proc WHERE proname IN (
  '_stripe_resolve_customer_id', 'get_user_plan',
  'get_my_subscription', 'list_active_products'
);
```

Expected: all four functions exist.

## 4. JWT Hook

```sql
SELECT prosrc FROM pg_proc WHERE proname = 'custom_access_token_hook';
```

Verify it calls `get_user_plan(v_user_id)` and injects the result as the `plan` claim.

## 5. Test Flows

### New subscription (no existing customer)
1. User on default plan clicks "Get Started" on lowest tier
2. Redirected to Stripe Checkout → pay with `4242 4242 4242 4242`
3. Redirected to `/protected/confirm?session_id=cs_xxx`
4. Confirm page polls oRPC procedure → verifies payment → upserts record
5. `refreshClaims()` fires → JWT plan updates → redirects to destination

### Upgrade (existing subscription)
1. User on lower tier clicks "Upgrade to {Higher Tier}"
2. No redirect — `upgradeSubscription` fires in-place via Stripe SDK
3. `refreshClaims()` → JWT plan shows new tier
4. Stripe Dashboard shows updated subscription (not a second one)

### One-time purchase
1. User clicks purchase button
2. Redirected to Stripe Checkout (mode: payment) → pay
3. Redirected to confirm page → polls → verifies → upserts purchase record
4. `refreshClaims()` → plan updates → redirects to destination

### Portal
1. Click "Manage billing, invoices & payment methods"
2. Stripe Portal opens → can update payment method, view invoices
3. Returns to billing page

### Downgrade prevention
1. Verify no clickable buttons exist on tiers below current plan
2. Lower tiers show "Included in your plan" (text, not a button)

## 6. Credit System

### Credit allocations seeded
```sql
SELECT * FROM public.credit_allocations ORDER BY plan;
```
Expected: free=0/month, starter=10/month, pro=50/month, lifetime=999999/month. A missing `free` row is a fail — every free user would get `error: 'no_allocation'`.

### consume_credits works
```sql
SELECT public.consume_credits('<test_user_id>', 'generation', 1, 10, 'month');
```
Expected: `{ "success": true, "balance": 9, "allocation": 10 }` — creates balance row + ledger entry. The last two arguments are what `withCredits()` passes from `CREDIT_CONFIG`; the seeded `credit_allocations` row wins over them when the plan has one.

### Hard block on depletion
Exhaust all credits, then attempt one more consume. Expected: `{ "success": false, "balance": 0, "needed": 1, "allocation": 10 }`.

### Refund works
```sql
SELECT public.refund_credits('<test_user_id>', 'generation', 1);
```
Expected: `{ "success": true, "balance": 1 }` — positive ledger entry.

### Period reset
New period (next day) creates fresh allocation automatically on first consume.

### Billing page credit display
- Progress bars show per credit type
- Unlimited plans show "Unlimited usage"
- Balance fraction visible (e.g., "8 / 10")

## 7. Plan Gating

### paidProcedure blocks free users
- Call a `paidProcedure` endpoint as a free user → expect 403 with "paid plan" message
- Call same endpoint as paid user → expect success

### usePlan() hook works
- Verify `<PlanProvider>` wraps the protected layout
- Free user: `usePlan()` returns `{ plan: 'free', isFree: true, isPaid: false }`
- Paid user: `usePlan()` returns `{ plan: '{tier}', isFree: false, isPaid: true }`

### Upgrade refreshes plan context
- After `refreshClaims()` + `router.refresh()`, `usePlan()` returns updated plan

## 8. Payment Emails

### Welcome email sends on new subscription
- Complete a test checkout → verify Inngest event `billing/subscription.created` fires
- Check Inngest dashboard or email provider for delivery

### Upgrade email sends on plan change
- Upgrade an existing subscription → verify `billing/subscription.upgraded` event fires
- Email contains previous and new plan names

## 9. Responsive

- 375px: plan cards stack vertically
- 768px+: 3 cards side by side
