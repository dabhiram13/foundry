# Page Fixing Reference

Page failures mean a page doesn't render correctly: blank screen, error boundary, console errors, missing content, broken layout. Usually simpler than flow fixes — contained to one page component.

The Next.js, Tailwind, and `webapp/` names below are conditional examples. Use the target
repository's actual framework, build command, route layout, and styling system.

## Diagnosis by symptom

### Blank page / error boundary
- Check `webapp/app/protected/{route}/page.tsx`
- Run `cd webapp && npx tsc --noEmit` — type errors break SSR
- Check: does the page import a client component that throws during render?
- Check: does the server component's data fetch throw? Missing error handling?
- Look for: `'use client'` on a component that uses server-only APIs (cookies, headers)

### Console errors (JS runtime)
- `TypeError: Cannot read properties of undefined` → data not loaded yet, missing optional chaining
- `Hydration mismatch` → server renders X, client renders Y (often: date formatting, random IDs, browser-only APIs)
- `ChunkLoadError` → build artifact missing, try `cd webapp && npm run build`

### Missing content / wrong content
- Check the data source: is the query returning data?
- Check the component props: is data being passed correctly?
- Check conditional rendering: is a loading/empty state incorrectly showing?

### Broken layout / overflow
- Check for missing responsive classes
- Check: is a container missing `overflow-hidden` or `max-w-*`?
- This is often CSS-only — check the Tailwind classes on the page wrapper

### Page title not set
- Check `metadata` export in page.tsx or layout.tsx
- For dynamic titles: check `generateMetadata` function

### Locator or readiness failure
- Inspect the trace to see the accessible name and state at the failing action.
- Prefer role/label/text locators and web-first assertions.
- Wait for the state that proves readiness; do not add `networkidle` or a fixed timeout.

## Where to look

The following is an illustrative Next.js layout. Use it only when those paths exist; otherwise
locate the equivalent route, layout, loading state, error boundary, and component directory.

```
webapp/app/protected/{route}/
├── page.tsx        ← the page component (server by default)
├── layout.tsx      ← wrapping layout
├── loading.tsx     ← suspense fallback
└── error.tsx       ← error boundary

webapp/features/{feature}/components/
├── {Component}.tsx ← client components used by the page
```

## Fix patterns

### Missing null check on data
```typescript
// BROKEN: crashes if query returns undefined
const post = await getPost(id)
return <h1>{post.title}</h1>  // TypeError if post is null

// FIXED
const post = await getPost(id)
if (!post) notFound()
return <h1>{post.title}</h1>
```

### Hydration mismatch from dates
```typescript
// BROKEN: server formats in UTC, client in local timezone
<span>{new Date(createdAt).toLocaleDateString()}</span>

// FIXED: use consistent formatting or suppress hydration warning
<time dateTime={createdAt} suppressHydrationWarning>
  {new Date(createdAt).toLocaleDateString()}
</time>
```

### Missing loading state
```typescript
// BROKEN: component assumes data exists immediately
export default function PostPage({ params }) {
  const post = use(getPost(params.id))  // suspends, but no loading.tsx
  return <PostDetail post={post} />
}

// FIXED: add loading.tsx alongside page.tsx
// webapp/app/protected/posts/[id]/loading.tsx
export default function Loading() {
  return <PostDetailSkeleton />
}
```

## After fixing

When these files exist and match the stack, check that your fix follows:
- `.foundry/references/source-docs/patterns/frontend/page-pattern.md` — page component structure
- `.foundry/references/source-docs/patterns/frontend/loading-states-pattern.md` — loading/error handling
- `.foundry/references/source-docs/patterns/frontend/component-pattern.md` — component conventions
