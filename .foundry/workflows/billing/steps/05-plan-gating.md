# Step 5: Plan Gating Infrastructure

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Create the server-side middleware and shared UI components that let any feature gate content by plan. This runs after JWT plan detection (Step 4) — the `plan` claim is already in the JWT.

## What This Step Creates

| Layer | What | Where |
|-------|------|-------|
| Context | `plan` field on `ORPCUser` | `lib/orpc/context.ts` |
| Middleware | Read plan from JWT claims | `lib/orpc/base.ts` (auth middleware) |
| Procedure | `paidProcedure` — hard block for free users | `lib/orpc/base.ts` |
| Pattern doc | 3 gating strategies with decision tree | `.foundry/references/source-docs/patterns/billing/plan-gating.md` |
| Component | `<UpgradeWall />` — full-page upgrade CTA | `features/_shared/components/upgrade-wall.tsx` |
| Component | `<UpgradeDialog />` — modal upgrade prompt | `features/_shared/components/upgrade-dialog.tsx` |
| Hook | `usePlan()` — global client-side plan access | `features/_shared/hooks/use-plan.ts` |
| Provider | `<PlanProvider>` — wraps protected layout | `features/_shared/providers/plan-provider.tsx` |
| Barrel | Export components + hook | `features/_shared/components/index.ts`, `features/_shared/hooks/index.ts` |

## Read First

- `lib/orpc/context.ts` — current ORPCUser interface
- `lib/orpc/base.ts` — current middleware chain and procedure exports
- `lib/auth/utils.ts` — existing `getPlan()` helper
- `.foundry/workflows/billing/steps/07-billing-page.md` — what the billing page is built from
- `docs/built/design-system.md` — tokens and card patterns

## 1. Add `plan` to ORPCUser

```typescript
// lib/orpc/context.ts
export type PlanType = 'free' | string  // 'free' is default, other values come from Stripe product names

export interface ORPCUser {
  id: string
  email?: string
  role: 'user' | 'admin'
  plan: PlanType  // NEW — from JWT claim, defaults to 'free'
}
```

## 2. Read plan in auth middleware

Update the auth middleware in `lib/orpc/base.ts` to extract the `plan` claim:

```typescript
const authMiddleware = base.middleware(async ({ context, next }) => {
  if (context.supabase) {
    const { data: claimsData } = await context.supabase.auth.getClaims()
    const claims = claimsData?.claims
    const sub = claims?.sub as string | undefined
    const email = claims?.email as string | undefined
    const isAdmin = claims?.is_admin === true
    const plan = typeof claims?.plan === 'string' ? claims.plan : 'free'  // NEW

    if (sub) {
      const orpcUser: ORPCUser = {
        id: sub,
        email,
        role: isAdmin ? 'admin' : 'user',
        plan,  // NEW
      }
      return next({ context: { user: orpcUser } })
    }
  }
  return next({})
})
```

## 3. Create `paidProcedure`

Add after `adminProcedure` in `lib/orpc/base.ts`:

```typescript
/**
 * PAID PROCEDURE
 * Requires any paid plan — free users get 403
 * Use for: write operations that free users cannot access at all (e.g. favorites.toggle)
 */
const requirePaidMiddleware = base
  .$context<{ user?: ORPCUser }>()
  .middleware(async ({ context, next }) => {
    if (!context.user) {
      throw Errors.unauthorized()
    }
    if (context.user.plan === 'free') {
      throw Errors.forbidden('Upgrade to a paid plan to access this feature')
    }
    return next()
  })

export const paidProcedure = protectedProcedure.use(requirePaidMiddleware)
```

## 4. Create Pattern Doc

Create `.foundry/references/source-docs/patterns/billing/plan-gating.md`:

```markdown
# Plan Gating Patterns

Plan lives in JWT claim (`context.user.plan`). Three strategies — pick by use case.

## Strategy A: Hard Block (`paidProcedure`)

**When:** Write operations that free users cannot access at all.
**How:** Use `paidProcedure` instead of `protectedProcedure`. Free users get 403.
**Example:** Favorites toggle, export data, create project.

```typescript
import { paidProcedure } from '@/lib/orpc/base'

export const toggleFavorite = paidProcedure
  .input(ToggleFavoriteSchema)
  .handler(async ({ context, input }) => {
    // Only paid users reach here
  })
```

Frontend catches the error and shows upgrade dialog:
```typescript
onError: (error) => {
  if (error.message?.includes('paid plan')) setShowUpgrade(true)
}
```

## Strategy B: Soft Gate (return `isFree` flag)

**When:** Read operations where free users see limited data (preview, teaser).
**How:** Use `protectedProcedure`. Check `context.user.plan` in handler. Return `isFree: true` + limited data.
**Example:** Feed shows 3 real items + 17 blurred, search limited to 20 results.

```typescript
export const listItems = protectedProcedure
  .input(ListSchema)
  .handler(async ({ context, input }) => {
    const isFree = context.user.plan === 'free'
    const effectiveLimit = isFree ? 3 : input.limit
    // ... fetch with effectiveLimit
    return { items, hasMore: isFree ? false : hasMore, isFree }
  })
```

Frontend branches on `isFree`:
```tsx
{isFree && <UpgradeWall feature="full library" />}
{!isFree && <RealContent data={data} />}
```

## Strategy C: Empty Response

**When:** Entire pages gated for free users (no preview, just upgrade CTA).
**How:** Same as B, but return empty data + `isFree: true`.
**Example:** Favorites page, analytics dashboard.

```typescript
if (context.user.plan === 'free') {
  return { items: [], nextCursor: null, hasMore: false, isFree: true }
}
```

Frontend shows full-page upgrade wall:
```tsx
if (isFree) return <UpgradeWall feature="favorites" />
```

## Decision Tree

```
Is it a write operation (create/update/delete)?
  YES → Strategy A (paidProcedure, hard block)
  NO → Does the free user see ANY content?
    YES → Strategy B (soft gate, limited data + isFree)
    NO → Strategy C (empty response + isFree, full-page UpgradeWall)
```

## Key Rules

1. **Server sends plan status as DATA, not errors** — `isFree` is a field, not an exception
2. **Frontend checks `isFree` BEFORE error handling** — free users never see error states
3. **Every gated UI leads to billing page** — never a dead end
4. **Use `<UpgradeWall />` for full-page gates, `<UpgradeDialog />` for inline actions**
```

## 5. Create `<UpgradeWall />`

`features/_shared/components/upgrade-wall.tsx`:

Full-page component for Strategy C. Shows when an entire page/section is gated.

Requirements:
- `'use client'`
- Props: `feature: string` (what the user is unlocking, e.g. "favorites", "analytics")
- Optional: `title`, `description` overrides
- Links to `/protected/billing`
- Uses semantic tokens only (`bg-muted`, `text-muted-foreground`, `bg-primary`, etc.)
- Has a clear visual hierarchy: icon/illustration + headline + description + CTA button
- Responsive: centered card on desktop, full-width on mobile
- Hover state on CTA button with transition
- NO banned AI slop patterns (no icon-in-colored-circle, no gradient orbs)

Design reference: Think "empty state with purpose" — not sad/apologetic, but aspirational. Show what they're missing and make upgrade feel like a reward, not a punishment.

## 6. Create `<UpgradeDialog />`

`features/_shared/components/upgrade-dialog.tsx`:

Modal dialog for Strategy A inline actions (e.g. clicking heart button as free user).

Requirements:
- `'use client'`
- Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `feature: string`
- Uses shadcn `<Dialog>` component
- Short copy: "Upgrade to unlock {feature}" + CTA button linking to billing
- Semantic tokens only
- Transition on open/close (shadcn Dialog handles this)

## 7. Create `usePlan()` hook + `<PlanProvider>`

The plan lives in JWT claims. Server components read it via `getClaims()`. But client components deep in the tree need plan access too — without prop-drilling or fetching from every procedure.

**`features/_shared/providers/plan-provider.tsx`:**

```typescript
'use client'

import { createContext, useContext } from 'react'

interface PlanContextValue {
  plan: string        // 'free', 'starter', 'pro', 'lifetime', etc.
  isFree: boolean     // convenience: plan === 'free'
  isPaid: boolean     // convenience: plan !== 'free'
}

const PlanContext = createContext<PlanContextValue>({
  plan: 'free',
  isFree: true,
  isPaid: false,
})

export function PlanProvider({
  plan,
  children,
}: {
  plan: string
  children: React.ReactNode
}) {
  return (
    <PlanContext.Provider value={{ plan, isFree: plan === 'free', isPaid: plan !== 'free' }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  return useContext(PlanContext)
}
```

**Wire into protected layout (`app/protected/layout.tsx`):**

The protected layout already reads claims server-side. Add:

```typescript
import { PlanProvider } from '@/features/_shared/providers/plan-provider'
import { getPlan } from '@/lib/auth/utils'

// Inside the layout component, after reading claims:
const plan = getPlan(claims)

return (
  <PlanProvider plan={plan}>
    {/* existing layout content */}
  </PlanProvider>
)
```

**Usage in any client component:**

```typescript
import { usePlan } from '@/features/_shared/providers/plan-provider'

function HeartButton() {
  const { isFree } = usePlan()
  if (isFree) {
    // show upgrade dialog instead of toggling
  }
}

function SidebarItem() {
  const { isPaid } = usePlan()
  // conditionally show/hide premium nav items
}
```

This gives every client component in the protected area instant plan access — zero API calls, zero prop drilling.

**Important:** `usePlan()` reads from the JWT at page load time. After a successful upgrade, `refreshClaims()` + `router.refresh()` re-renders the layout server component, which passes the new plan to PlanProvider, and all consumers re-render with the updated plan.

## 8. Export from barrel

Update `features/_shared/components/index.ts` to export both components.
Update `features/_shared/hooks/index.ts` to export `usePlan`.
Export `PlanProvider` from `features/_shared/providers/plan-provider.tsx`.

## Quality Gate

```bash
cd webapp && npx tsc --noEmit
```

Must pass. The new `plan` field on ORPCUser will propagate — fix any type errors.

## Output

- `context.user.plan` available in every protected procedure (server-side)
- `usePlan()` hook available in every client component under `/protected/` (client-side)
- `paidProcedure` ready for hard-block gating
- `<UpgradeWall />` and `<UpgradeDialog />` as shared infrastructure
- `<PlanProvider>` wired into protected layout
- Pattern doc at `.foundry/references/source-docs/patterns/billing/plan-gating.md`
- Feature agents use the right strategy based on the plan from `planner`
