# Step 7: Billing Page

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Build the billing page with plan cards, upgrade-only flow, and conversion-focused design.

## Read First

- `docs/project/product-overview.md (pricing section)` — tiers, features, copy
- `docs/built/design-system.md` — card patterns, tokens
- Step 1 output — price IDs for each tier

## Design Principles

1. **No free tier shown.** Every user is on a paid plan.
2. **No downgrade buttons.** Lower tiers show "Included in your plan" — text only, no button.
3. **No cancel/unsubscribe on this page.** That's in Stripe Portal (small "Manage billing" link).
4. **Upgrade-only flow.** Users can only move up: Starter → Pro → Lifetime.
5. **Conversion-focused.** Highlight the recommended tier. Make lifetime irresistible.

## Page Architecture

**Server component:** `webapp/app/protected/billing/page.tsx`
- Reads JWT claims via `supabase.auth.getClaims()`
- Passes `currentPlan` string to the client component

**Client component:** `webapp/features/stripe/components/billing-page.tsx`
- Renders plan cards
- Handles checkout/upgrade mutations
- Refreshes JWT after successful payment

## Plan Card Data Structure

```typescript
interface Plan {
  id: string           // matches JWT claim value: 'starter', 'pro', 'lifetime'
  name: string         // display name
  price: string        // '$29'
  period: string       // '/month' or 'one-time'
  description: string
  stripePriceId: string
  mode: 'subscription' | 'payment'
  tier: number         // 0, 1, 2 — upgrade order
  features: string[]
  highlight?: boolean  // "Most popular" badge
}
```

## Button Logic

| User's plan | Lower tier card | Current tier card | Higher tier card |
|------------|----------------|-------------------|------------------|
| Any | "Included in your plan" (text) | "Current plan" (disabled btn) | Action button |

**Action button logic:**
- `currentTier === 0` (no subscription yet) → Checkout (redirect to Stripe)
- `currentTier > 0 && target.mode === 'subscription'` → Upgrade in-place (`useUpgradeMutation`)
- `target.mode === 'payment'` (lifetime) → Checkout with `mode: 'payment'`

After success:
1. `refreshClaims()` — force JWT refresh so `plan` claim updates
2. `router.refresh()` — re-render server component with new plan

## Pricing Psychology

From `marketing-psychology` skill:
- **Anchoring:** Show all 3 tiers. Lifetime at $199 makes $79/mo look reasonable.
- **Decoy effect:** Middle tier (Pro) is "Most popular" — obvious value.
- **Loss framing:** Lifetime = "Pay once. Access everything. Forever." — no ongoing cost anxiety.
- **Charm pricing:** $29, $79, $199 — not $30, $80, $200.

## Billing Management

Small link under the page title: "Manage billing, invoices & payment methods" → opens Stripe Portal.
This is where cancellation/downgrade lives. Not on the plan cards.

## Post-Payment: Confirm Page Pattern

After Stripe Checkout, **never redirect back to the billing page with a query param.** Use a dedicated confirm route:

1. `successUrl` points to `/protected/confirm?session_id={CHECKOUT_SESSION_ID}`
2. Confirm page polls an oRPC procedure every 2s (max 20 attempts / 40s)
3. Procedure calls Stripe API to verify `payment_status === 'paid'` + user ownership
4. On confirmation: upserts purchase record, calls `refreshClaims()`, then `router.replace('/destination')`

Each purchase type gets its own confirm route with a product-specific redirect destination. The confirm page component is reusable — just change the redirect and the confirm procedure.

See `references/how-it-works.md` for the full pattern and existing examples.

## Output

Billing page at `/protected/billing` with upgrade-only plan cards. `npx tsc --noEmit` passes.
