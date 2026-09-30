# Step 8: Payment Emails

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Send transactional emails when billing events happen. A user upgrades and... they should hear about it.

## What This Step Creates

| What | Trigger | Where |
|------|---------|-------|
| Welcome to {Plan} email | After successful checkout/upgrade confirmation | Inngest function |
| Payment confirmed email | After checkout.session completed (new subscription) | Inngest function |
| Subscription upgraded email | After in-place upgrade completes | Inngest function |
| Email templates | React Email components | `emails/` directory |

## Read First

- `docs/tools/inngest/` — Inngest patterns (event-driven, step functions)
- `references/how-it-works.md` — subscription lifecycle, event flow
- `docs/built/auth.md` — existing email setup (if any)
- Existing email templates in `emails/` (if any)

## Architecture

Emails are triggered by Inngest functions that react to billing events. NOT from the oRPC procedures or confirm pages — those handle the user-facing flow. Emails are fire-and-forget side effects.

```
User upgrades
  → Confirm page verifies payment + refreshClaims()
  → Inngest event: "billing/subscription.created" or "billing/subscription.upgraded"
  → Inngest function picks up event
  → Sends email via React Email + Resend/Supabase SMTP
```

### Event Design

```typescript
// Events sent from confirm page or webhook handler
type BillingEvents = {
  'billing/subscription.created': {
    data: {
      userId: string
      email: string
      name: string
      plan: string          // 'starter', 'pro', etc.
      isLifetime: boolean   // one-time vs recurring
    }
  }
  'billing/subscription.upgraded': {
    data: {
      userId: string
      email: string
      name: string
      previousPlan: string
      newPlan: string
    }
  }
}
```

### Where to Send Events

The confirm page already verifies payment and calls `refreshClaims()`. After verification succeeds, send the Inngest event:

```typescript
// In the confirm page's oRPC procedure (after payment verified)
await inngest.send({
  name: 'billing/subscription.created',
  data: { userId, email, name, plan, isLifetime }
})
```

For in-place upgrades (no confirm page), send from the upgrade procedure:

```typescript
// In stripe.ts upgrade procedure (after subscriptions.update succeeds)
await inngest.send({
  name: 'billing/subscription.upgraded',
  data: { userId, email, name, previousPlan: oldPlan, newPlan }
})
```

## Email Templates

Use React Email. Keep them simple — no marketing fluff, just confirmation + value reinforcement.

### Welcome to {Plan}

Sent on: `billing/subscription.created`

Content:
- Subject: "You're on {Plan} — here's what's unlocked"
- Greeting with user's name
- What they just got access to (2-3 bullet points based on plan features)
- Link to the product (not billing page — they just paid, send them to USE the product)
- If lifetime: "You own this forever. No renewals, no surprises."

### Subscription Upgraded

Sent on: `billing/subscription.upgraded`

Content:
- Subject: "Upgraded to {NewPlan} — new features unlocked"
- What changed (previous plan → new plan)
- New features they just unlocked (delta between plans)
- Link to the product

## Inngest Functions

```typescript
// inngest/functions/billing-emails.ts

export const sendWelcomeEmail = inngest.createFunction(
  { id: 'billing-welcome-email' },
  { event: 'billing/subscription.created' },
  async ({ event, step }) => {
    await step.run('send-welcome', async () => {
      const { email, name, plan, isLifetime } = event.data
      // Render React Email template
      // Send via configured email provider
    })
  }
)

export const sendUpgradeEmail = inngest.createFunction(
  { id: 'billing-upgrade-email' },
  { event: 'billing/subscription.upgraded' },
  async ({ event, step }) => {
    await step.run('send-upgrade', async () => {
      const { email, name, previousPlan, newPlan } = event.data
      // Render React Email template
      // Send via configured email provider
    })
  }
)
```

Register both in `app/api/inngest/route.ts`.

## Adapt Per Project

The email content (plan features, product links) is project-specific. The agent reads `docs/project/product-overview.md` for:
- Plan names and their feature lists
- Product name for subject lines
- Main product URL to link to

## Quality Gate

```bash
cd webapp && npx tsc --noEmit
```

Must pass. Inngest functions must be registered. Email templates must render without errors.

## Output

- Inngest functions for `billing/subscription.created` and `billing/subscription.upgraded`
- React Email templates for welcome and upgrade emails
- Events sent from confirm procedure and upgrade procedure
- Functions registered in Inngest route
