# Step 3: oRPC Procedures + Hooks

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Wire Stripe operations to the frontend via oRPC procedures (calling Stripe SDK directly) and TanStack Query hooks.

## Read First

- `webapp/lib/orpc/procedures/stripe.ts` — existing procedures
- `webapp/features/stripe/hooks/` — existing hooks
- `references/how-it-works.md` — architecture overview

## Procedures — `webapp/lib/orpc/procedures/stripe.ts`

### Required Procedures

| Procedure | Calls | Input | Output |
|-----------|-------|-------|--------|
| `createCheckoutSession` | Stripe SDK directly | `{ priceId, mode, successUrl, cancelUrl, kitSlug?, tier? }` | `{ url }` |
| `upgradeSubscription` | Stripe SDK directly | `{ priceId }` | `{ success }` |
| `createPortalSession` | Stripe SDK directly | `{ returnUrl }` | `{ url }` |
| `getSubscription` | Supabase RPC `get_my_subscription` | — | `{ subscribed, subscription }` |
| `listProducts` | Supabase RPC `list_active_products` | — | `{ products }` |

### Pattern

Procedures call the Stripe SDK directly — no edge function middleman. oRPC middleware handles auth.

```typescript
export const upgradeSubscription = impl.upgradeSubscription
  .handler(async ({ context, input }) => {
    const stripe = getStripe()
    const customerId = await resolveCustomerId(context.supabase, context.user.id, context.user.email)

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId, status: 'active', limit: 1,
    })
    if (!subscriptions.data[0]) throw Errors.notFound('No active subscription')

    const itemId = subscriptions.data[0].items.data[0]?.id
    await stripe.subscriptions.update(subscriptions.data[0].id, {
      items: [{ id: itemId, price: input.priceId }],
      proration_behavior: 'create_prorations',
    })
    return { success: true }
  })
```

### Security (createCheckoutSession)

- `validateAppUrl()` — rejects `successUrl`/`cancelUrl` pointing to external domains
- Price + product validation — checks both are `active` before creating session
- Tier validation — verifies tier matches product metadata if both are provided
- Customer resolution: DB lookup first (instant), then create (no Stripe Search lag)

### Router

Add all procedures to `stripeRouter` and verify it's wired into `protectedRouter`.

## Hooks — `webapp/features/stripe/hooks/use-stripe-mutations.ts`

| Hook | Procedure | Type |
|------|-----------|------|
| `useCheckoutMutation()` | `createCheckoutSession` | mutation |
| `useUpgradeMutation()` | `upgradeSubscription` | mutation |
| `usePortalMutation()` | `createPortalSession` | mutation |
| `useSubscription()` | `getSubscription` | query |

### Barrel exports

Update `webapp/features/stripe/hooks/index.ts` and `webapp/features/stripe/index.ts` to export new hooks.

## Output

All procedures wired, all hooks exported. `npx tsc --noEmit` passes.
