# Performance Testing & Pattern Enforcement

The perf-tester doesn't just measure — it enforces the frontend architecture patterns. Every page must be fast by design.

## The Target Architecture

Every page MUST follow this structure:

```
page.tsx (static shell → instant TTFB, zero data fetching)
  └── <Suspense fallback={<PixelPerfectSkeleton />}>
       └── <FeatureDataServer />  ← separate server component, cache + cacheLife
            └── client uses use() for streaming
```

If the built code doesn't match this → FIX IT using the patterns from `.foundry/references/source-docs/patterns/frontend/field-guide.md`.

## Audit Checklist

### 1. PPR Shell Analysis

```bash
npx next-browser ppr lock
npx next-browser goto $DEV_URL/protected/{feature}
npx next-browser preview "PPR shell — {feature}"
npx next-browser ppr unlock
```

**Check:**
- [ ] Shell is meaningful (headings, navigation, layout structure visible)
- [ ] Dynamic holes are minimal and scoped (only data-dependent sections)
- [ ] Static content (titles, labels, nav) renders without JS

**If shell is empty or minimal:** page.tsx has data fetching in it. Move to separate server components.

### 2. Data Fetching Audit

```bash
# Find data fetching in page.tsx files (WRONG — should be in separate components)
grep -rn 'getORPCCaller\|getPublicORPCCaller\|await.*caller\.' webapp/app/protected/{feature}/page.tsx
```

**Pattern violations to fix:**
- `await` in page.tsx → move data fetch to `{Feature}DataServer` component, wrap in Suspense
- `fetch()` in page.tsx → same — extract to server component
- Direct DB calls in page.tsx → extract to cached server function

**Correct pattern:**
```tsx
// page.tsx — static layout ONLY
export default function FeaturePage() {
  return (
    <>
      <h1>Feature</h1>
      <Suspense fallback={<FeatureCardSkeleton />}>
        <FeatureCardServer />   {/* data fetching happens HERE */}
      </Suspense>
    </>
  )
}

// FeatureCardServer.tsx — data + cache + Suspense
export function FeatureCardServer() {
  const dataPromise = getFeatureData()  // NOT awaited — streaming
  return (
    <Suspense fallback={<FeatureCardSkeleton />}>
      <FeatureCard dataPromise={dataPromise} />
    </Suspense>
  )
}
```

### 3. Cache Audit

```bash
# Every data-fetching server function must have cache directives
grep -rn "use cache" webapp/features/{feature}/
grep -rn "cacheLife\|cacheTag" webapp/features/{feature}/
```

**Check per data function:**
- [ ] Has `'use cache'` or `'use cache: private'` directive
- [ ] Has `cacheLife()` with appropriate profile (minutes/hours/days)
- [ ] Has `cacheTag()` for invalidation
- [ ] Uses correct caller: `getPublicORPCCaller()` for `'use cache'`, `getORPCCaller()` for `'use cache: private'`

**Cache tier reference:**

| Data type | Directive | Caller | cacheLife |
|-----------|-----------|--------|-----------|
| Same for all users | `'use cache'` | `getPublicORPCCaller()` | `'hours'` or `'days'` |
| Per-user, stale OK | `'use cache: private'` | `getORPCCaller()` | `'minutes'` |
| Must be fresh | No directive | `getORPCCaller()` | N/A |

### 4. Skeleton Audit

```bash
# Every Suspense must have a meaningful fallback
grep -rn "Suspense" webapp/app/protected/{feature}/ webapp/features/{feature}/
```

**Check:**
- [ ] Every `<Suspense>` has a `fallback=` prop (not empty `<>`)
- [ ] Skeleton matches the layout of the final component (same height, width, structure)
- [ ] No generic spinners — skeletons must be pixel-perfect to the content shape

**If skeleton is missing or generic:** Create a `{Component}Skeleton` that mirrors the real component's layout using `<Skeleton />` from shadcn/ui.

### 5. Client Boundary Audit

```bash
# 'use client' should be on lowest leaf, not high up
grep -rn "'use client'" webapp/features/{feature}/ webapp/app/protected/{feature}/
```

**Check:**
- [ ] `'use client'` is NOT on page.tsx or layout.tsx
- [ ] `'use client'` is on the lowest possible leaf component
- [ ] Server components don't import client components (except as children via Suspense)

### 6. Core Web Vitals

```bash
npx next-browser perf $DEV_URL/protected/{feature}
```

**Thresholds:**
| Metric | Good | Needs work | Fix |
|--------|------|------------|-----|
| TTFB | < 200ms | > 500ms | Check server function, add cache |
| LCP | < 1.5s | > 2.5s | Optimize largest element, check image loading |
| CLS | < 0.1 | > 0.25 | Add explicit dimensions, fix skeleton sizes |
| Hydration | < 100ms | > 200ms | Reduce client bundle, push 'use client' lower |

### 7. Hydration Timing

From the `perf` output, check React hydration timing. If > 100ms:
- Too much client-side JS
- Move logic to server components
- Push `'use client'` to lower leaves

## What Perf-Tester CAN Fix

| Issue | Fix approach | Pattern reference |
|-------|-------------|-------------------|
| Data fetching in page.tsx | Extract to server component + Suspense | field-guide.md Pattern 1 |
| Missing cache directives | Add `'use cache: private'` + cacheLife + cacheTag | field-guide.md Cache Tiers |
| Wrong cache tier | Switch caller + directive | field-guide.md Cache Tiers |
| Missing/generic skeleton | Create `{Component}Skeleton` matching final layout | field-guide.md Loading States |
| `'use client'` too high | Push down to lowest leaf | field-guide.md State Management |
| `invalidateQueries` for cache | Replace with `updateTag()` + `router.refresh()` | field-guide.md Mutations |
| `useQuery` without initialData | Use server component + `use()` pattern | field-guide.md Pattern 4 |
| `await` in server bridge | Create promise (no await), pass to client `use()` | field-guide.md Pattern 1 |

## What Perf-Tester CANNOT Touch

- Feature logic (what the feature does)
- UI design (how it looks)
- oRPC procedure implementation
- Database schema
- Component naming/file structure (unless moving for architectural reasons)

## Completion Report

```
## Performance Audit: {feature}

### Core Web Vitals
- TTFB: {X}ms
- LCP: {X}ms ({element})
- CLS: {X}
- Hydration: {X}ms

### Pattern Compliance
- PPR shell: {meaningful | empty — FIXED}
- Data fetching: {in server components | was in page.tsx — FIXED}
- Cache: {all functions cached | {N} missing — FIXED}
- Skeletons: {pixel-perfect | {N} generic — FIXED}
- Client boundary: {lowest leaf | was too high — FIXED}

### Changes Made
1. {file}: {what changed and why}
2. ...

### Remaining Issues (cannot fix — report to orchestrator)
- {issue}: {why it can't be fixed by perf-tester}
```
