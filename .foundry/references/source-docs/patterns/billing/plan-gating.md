# Plan Gating — A/B/C Decision Tree

How to gate features by paid plan. Pick ONE strategy per procedure and per page. Pinning the strategy in the brief's `## Contract` section is mandatory — design-evaluator grades against it.

## Infrastructure (already built — do NOT rebuild)

**Backend:**
- `paidProcedure` from `webapp/lib/orpc/base.ts` — extends `protectedProcedure`, throws 403 when `context.user.plan === 'free'`.
- `protectedProcedure` — authed but plan-agnostic. Use when the procedure needs to read the plan internally.
- Plan is available at `context.user.plan` inside any authed middleware.

**Frontend:**
- `usePlan()` hook from `features/_shared/providers/plan-provider.tsx` → `{ plan, isFree, isPaid }`. Available in every client component under `/protected/` (the layout wraps children in `PlanProvider`).
- `<UpgradeWall feature="…" />` from `features/_shared/components` — full-page CTA. Use for Strategy C gated pages.
- `<UpgradeDialog open={…} onOpenChange={…} feature="…" />` from `features/_shared/components` — modal. Use for Strategy A inline actions.

Never prop-drill plan. Never build your own upgrade components. Never call `getClaims()` in a client component — the provider already holds the plan.

## The three strategies

| Strategy | Procedure | Response | UI behavior | Use when |
|----------|-----------|----------|-------------|----------|
| **A — Hard block** | `paidProcedure` | 403 for free users | Client opens `<UpgradeDialog>` on the 403 path | Write actions free users must never perform: `favorites.toggle`, `posts.create`, `collections.add` |
| **B — Soft gate** | `protectedProcedure` + plan check inside | `{ items: [...], isFree: true, limit: N }` (partial data) | UI renders preview of what free gets, locked state on the rest | Read operations where free users see a taste: "first 3 items free, rest gated" |
| **C — Empty response** | `protectedProcedure` + plan check inside | `{ items: [], isFree: true }` (no data) | Page replaces content with `<UpgradeWall>` | Whole pages that are meaningless to free users: analytics dashboard, advanced search, history |

**Critical rule: free users NEVER see error states on gated features.** An error UI on a paywall tells the user "something broke" when the real message is "this is a paid feature." Always an upgrade path, never an error.

## Strategy A — Hard block (writes)

```ts
// lib/orpc/procedures/favorites/toggle.ts
import { paidProcedure } from '@/lib/orpc/base'
import { secureObject } from '@/lib/orpc/secure'
import { z } from 'zod'

export const toggleFavorite = paidProcedure
  .input(secureObject({ postId: z.string().uuid() }))
  .output(z.object({ success: z.literal(true), favorited: z.boolean() }))
  .handler(async ({ input, context }) => {
    // Only reached by paid users — middleware already blocked free users with 403
    ...
  })
```

Client side — the server action throws `ORPCError` with 403. Catch in the mutation handler and open the dialog:

```tsx
'use client'
import { useState } from 'react'
import { UpgradeDialog } from '@/features/_shared/components'
import { toggleFavoriteAction } from '@/features/favorites/actions'

export function FavoriteButton({ postId }: { postId: string }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  async function onClick() {
    const result = await toggleFavoriteAction({ postId })
    if (result?.serverError?.status === 403) {
      setUpgradeOpen(true)
      return
    }
    // success handling
  }

  return (
    <>
      <button onClick={onClick}>Favorite</button>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="favorites" />
    </>
  )
}
```

**Do NOT** check `usePlan()` before the click to hide the button — free users can see gated actions, they just cannot complete them. Showing the dialog is the marketing moment.

## Strategy B — Soft gate (reads with preview)

```ts
// lib/orpc/procedures/posts/list.ts
export const listPosts = protectedProcedure
  .input(z.object({ limit: z.number().default(10) }))
  .output(z.object({
    items: z.array(PostSchema),
    isFree: z.boolean(),
    limit: z.number(),
    totalCount: z.number(),
  }))
  .handler(async ({ input, context }) => {
    const isFree = context.user.plan === 'free'
    const effectiveLimit = isFree ? 3 : input.limit

    const { data, count } = await context.supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .limit(effectiveLimit)

    return {
      items: data ?? [],
      isFree,
      limit: effectiveLimit,
      totalCount: count ?? 0,
    }
  })
```

Frontend receives `isFree` in the response. Connector passes it to the designer component. Designer renders preview + locked state:

```tsx
export function PostList({ items, isFree, totalCount }: PostListProps) {
  return (
    <ul>
      {items.map((p) => <PostCard key={p.id} post={p} />)}
      {isFree && totalCount > items.length && (
        <LockedPreviewCard count={totalCount - items.length} />
      )}
    </ul>
  )
}
```

**Rule:** the server returns the data it wants free users to see, plus a flag. The client never decides what to hide — that's a leak.

## Strategy C — Empty response (whole-page gate)

```ts
// lib/orpc/procedures/analytics/overview.ts
export const analyticsOverview = protectedProcedure
  .output(z.object({
    stats: AnalyticsStatsSchema.nullable(),
    isFree: z.boolean(),
  }))
  .handler(async ({ context }) => {
    if (context.user.plan === 'free') {
      return { stats: null, isFree: true }
    }
    const stats = await loadStats(context.user.id)
    return { stats, isFree: false }
  })
```

Page component swaps the whole body on `isFree`:

```tsx
export default async function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  )
}

async function AnalyticsContent() {
  const { stats, isFree } = await caller.analytics.overview()

  if (isFree) {
    return <UpgradeWall feature="analytics" />
  }

  return <AnalyticsDashboard stats={stats!} />
}
```

**Rule:** the UpgradeWall replaces content, not an error. If the procedure genuinely fails (network, DB), that's a separate Suspense/ErrorBoundary path — NOT the free-user path.

## Decision tree (pick the right strategy)

```
Is this a write operation (create / update / delete / toggle)?
  YES → Strategy A (paidProcedure, catch 403 → UpgradeDialog)
  NO ↓

Does the feature show meaningful content to free users (preview, sample, first N)?
  YES → Strategy B (protectedProcedure + isFree flag + preview)
  NO ↓

The feature is entirely paid. Is this a whole page (or top-level section)?
  YES → Strategy C (protectedProcedure returns empty + isFree → UpgradeWall)
  NO  → Strategy A is usually right (inline action, open dialog on intent)
```

## What the planner must pin in the brief

The planner, per gated procedure, in backend-brief `## Contract`:
```
favorites.toggle — Strategy A (paidProcedure, 403 on free)
posts.list      — Strategy B (isFree + limit 3 for free)
analytics.overview — Strategy C (empty + isFree)
```

The planner, per gated page/component, in frontend-brief `## Contract`:
```
/favorites (page) — Strategy A inline actions, <UpgradeDialog> on 403
/analytics (page) — Strategy C, <UpgradeWall feature="analytics" /> on isFree
```

Backend-evaluator checks each procedure matches the pinned strategy. Design-evaluator checks each page/component matches. Missing or diverging = FAIL.

## The judgment

The rules behind the three strategies — server decides, client renders; an absent claim is a denied claim; a paywall is an offer, never an error — are `.foundry/philosophy/entitlement.md`. Dialog vs wall is not a taste call: inline action → dialog, whole page → wall.

## Common mistakes

| Mistake | Why it breaks | Fix |
|---------|---------------|-----|
| Hide gated buttons with `usePlan()` | Free users lose the marketing moment; no path to upgrade | Show button, open dialog on click |
| Use `paidProcedure` for reads with preview | 403 kills the preview experience | Use `protectedProcedure` + `isFree` |
| Return error for free users | Looks like a bug, not a paywall | Return `{ isFree: true }` + empty data |
| Forget `isFree` in output schema | Frontend has no signal to render lock state | Add to Zod schema and return from every plan-gated handler |
| Decide plan client-side before the request | Race between provider and response; plan changes during session don't propagate | Server is source of truth, always |
| Wrap `<UpgradeWall>` in `<ErrorBoundary>` | Free users see retry UI on a paywall | `<UpgradeWall>` replaces content, not error boundary |
