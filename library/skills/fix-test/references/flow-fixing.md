# Flow Fixing Reference

Flow failures mean a user journey is broken. The user tried to do something (login, create, navigate) and it didn't work. These are the hardest fixes because they can span frontend + backend + routing.

The Next.js, oRPC, and `webapp/` names below are conditional examples. Use the target repository's
actual routes, commands, state library, and service boundaries.

## Diagnosis by symptom

### Page doesn't load / blank screen
- Check the page component: `webapp/app/protected/{feature}/page.tsx`
- Look for: missing `'use client'`, SSR errors, import failures
- Check the layout: is there an error boundary catching silently?
- Run `cd webapp && npx tsc --noEmit` to catch type errors

### Form submit does nothing
- Check the form's `action` or `onSubmit` handler
- Check the API route/procedure being called
- Verify the request body shape matches what the procedure expects
- Check: is the button actually type="submit"? Is there a missing `await`?

### Form submit → wrong redirect / stays on page
- Check the `redirect()` or `router.push()` after the mutation
- Check: is the mutation succeeding? (look at network tab info in the report)
- If 4xx/5xx: the bug is in the API, not the redirect

### Data not showing / stale data
- Check the data fetching: `useQuery`, server component fetch, or oRPC call
- Check: is the query key correct? Is revalidation happening after mutation?
- Look for: missing `revalidatePath()` or `revalidateTag()` after writes
- Check the oRPC procedure: is it returning the right data?

### Console errors / unhandled exceptions
- The report lists console errors — trace them to source
- Common: `TypeError: Cannot read properties of undefined` → missing null check
- Common: `Hydration mismatch` → server/client render difference
- Common: `Failed to fetch` → wrong API URL or CORS issue

### Test fails but the user flow works
- Inspect the Playwright trace before changing product code.
- Check for a stale accessible name, brittle CSS locator, shared test data, or fixed-time wait.
- Update the test only when the approved behavior is still correct; keep assertions user-visible.

## Where to look

The following is an illustrative Next.js/oRPC layout. Use it only when those paths exist; otherwise
locate the equivalent route, component, client state, and backend handler.

```
webapp/
├── app/protected/{feature}/
│   ├── page.tsx           ← server component, data fetching
│   └── {sub}/page.tsx     ← nested routes
├── features/{feature}/
│   ├── components/        ← client components, forms, interactions
│   └── hooks/             ← custom hooks, mutations
├── lib/orpc/
│   └── procedures/{feature}.ts  ← backend procedures
└── lib/orpc/router.ts     ← route registration
```

## Fix patterns

### Missing await
```typescript
// BROKEN: mutation fires but redirect happens before it completes
const handleSubmit = () => {
  createPost(data)    // missing await
  router.push('/posts')
}

// FIXED
const handleSubmit = async () => {
  await createPost(data)
  router.push('/posts')
}
```

### Wrong revalidation
```typescript
// BROKEN: data shows stale after create
export const createPost = async (input) => {
  await db.insert(posts).values(input)
  // missing revalidation
}

// FIXED
export const createPost = async (input) => {
  await db.insert(posts).values(input)
  revalidatePath('/protected/posts')
}
```

### Missing error state
```typescript
// BROKEN: form silently fails, user sees nothing
const { mutate } = useMutation(...)

// FIXED: show error to user
const { mutate, error } = useMutation(...)
// + render error state in JSX
```

## After fixing

When these files exist and match the stack, read them to follow the project's established approach:
- `.foundry/references/source-docs/patterns/frontend/architecture.md` — component structure, data flow
- `.foundry/references/source-docs/patterns/backend/orpc.md` — procedure patterns, error handling
- `.foundry/references/source-docs/patterns/frontend/form-pattern.md` — form submission patterns
