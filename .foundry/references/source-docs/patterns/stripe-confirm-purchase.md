# Pattern: Stripe Post-Checkout Confirm Flow

## The Problem

After Stripe Checkout, the user gets redirected back to your app. But:
- The purchase record doesn't exist yet in your DB
- Webhooks take 5-30 seconds to arrive
- Stripe Sync Engine has a small delay too
- If you redirect to a protected page, it checks access → finds nothing → bounces the user

**Result:** User pays, gets redirected, sees "you don't have access." Terrible UX.

## The Solution: 3 Layers

### Layer 1: Confirm Endpoint (instant, user-facing)

A server endpoint that takes the Stripe `session_id`, calls Stripe's API directly, and creates the purchase record on the spot.

```ts
// Pseudocode — works with oRPC, tRPC, Next.js API routes, etc.
async function confirmPurchase(sessionId: string, userId: string) {
  // 1. Retrieve from Stripe (instant API call, no webhook needed)
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  // 2. Verify payment + ownership
  if (session.payment_status !== 'paid') return { status: 'pending' }
  if (session.metadata.user_id !== userId) throw new Error('Forbidden')

  // 3. Create purchase record (upsert = idempotent)
  await db.purchases.upsert({
    user_id: session.metadata.user_id,
    product_slug: session.metadata.product_slug,
    tier: session.metadata.tier,
    stripe_session_id: session.id,
  })

  return { status: 'confirmed' }
}
```

**Why it works:** You're calling `stripe.checkout.sessions.retrieve()` which reads Stripe's source of truth directly. No webhook delay. No sync delay.

### Layer 2: Confirm Page (polls until confirmed)

A client page at `/confirm?session_id=cs_xxx` that polls the confirm endpoint.

```
User sees:
  ⏳ "Confirming your purchase..." (polling every 2s)
  ✅ "Purchase confirmed!" (brief flash)
  → Auto-redirect to product page
```

```tsx
// /app/product/[slug]/confirm/page.tsx
useEffect(() => {
  const poll = async () => {
    const result = await confirmPurchase({ sessionId })
    if (result.status === 'confirmed') {
      setStatus('confirmed')
      setTimeout(() => router.replace(`/product/${slug}`), 1200)
      return
    }
    // Still pending — retry (max 20 attempts = 40 seconds)
    if (attempts < 20) setTimeout(poll, 2000)
    else setStatus('error')
  }
  poll()
}, [sessionId])
```

**Key details:**
- Poll every 2 seconds (not too aggressive, not too slow)
- Max 20 attempts (40 seconds covers even slow Stripe processing)
- Show clear loading → success → redirect states
- Error state with "back to product" link as fallback

### Layer 3: DB Trigger (safety net, background)

A Postgres trigger on the Stripe Sync table that auto-creates purchase records. This catches any case where the user closes the tab before the confirm page finishes.

```sql
CREATE FUNCTION handle_checkout_session_paid() RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_product_slug text;
  v_tier text;
BEGIN
  IF NEW.payment_status != 'paid' THEN RETURN NEW; END IF;

  v_user_id := (NEW.metadata->>'user_id')::uuid;
  v_product_slug := NEW.metadata->>'product_slug';
  v_tier := NEW.metadata->>'tier';

  -- Skip if metadata is incomplete
  IF v_user_id IS NULL OR v_product_slug IS NULL OR v_tier IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert — idempotent, safe to run alongside confirm endpoint
  INSERT INTO public.purchases (user_id, product_slug, tier, stripe_session_id)
  VALUES (v_user_id, v_product_slug, v_tier, NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_checkout_paid
  AFTER INSERT OR UPDATE ON stripe.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION handle_checkout_session_paid();
```

## Why 3 Layers?

| Layer | Speed | Reliability | Handles |
|-------|-------|-------------|---------|
| Confirm endpoint | Instant (~1s) | High | Happy path — user stays on page |
| Confirm page (polling) | 2-4s | High | Gives user visual feedback |
| DB trigger | 5-30s | Very high | User closed tab, network issues, confirm page failed |

Any single layer can fail. All three together = bulletproof.

## The Success URL Trick

Stripe supports a `{CHECKOUT_SESSION_ID}` template variable in the success URL:

```ts
const session = await stripe.checkout.sessions.create({
  // ...
  success_url: `${origin}/product/${slug}/confirm?session_id={CHECKOUT_SESSION_ID}`,
})
```

Stripe replaces `{CHECKOUT_SESSION_ID}` with the real session ID (e.g. `cs_live_xxx`) when redirecting. Your confirm page reads it from the URL params.

## The Metadata Convention

**Always include everything you need in the Stripe session metadata.** Both the confirm endpoint and the DB trigger read from it.

```ts
metadata: {
  user_id: user.id,        // WHO bought it
  product_slug: 'my-kit',  // WHAT they bought
  tier: 'builder',         // WHICH tier
}
```

This is the single source of truth that links Stripe's world back to your app.

## Idempotency is Everything

Both the confirm endpoint and the DB trigger can create the same record. This is by design. Use:
- **Unique constraint** on `(user_id, product_slug, tier)`
- **Upsert / ON CONFLICT** in both the endpoint and the trigger

The user can refresh the confirm page 50 times. The trigger can fire multiple times. Doesn't matter — same result every time.

## Checklist

- [ ] Stripe session metadata includes `user_id`, product identifier, tier
- [ ] Success URL uses `{CHECKOUT_SESSION_ID}` template
- [ ] Confirm endpoint: retrieves session from Stripe API, verifies payment + ownership, upserts record
- [ ] Confirm page: polls confirm endpoint every 2s, shows loading → success → redirect
- [ ] DB trigger on `stripe.checkout_sessions` as safety net
- [ ] Unique constraint on purchases table
- [ ] RLS policies: INSERT + UPDATE + SELECT for authenticated users (own rows)
