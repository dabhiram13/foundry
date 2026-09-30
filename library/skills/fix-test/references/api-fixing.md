# API Fixing Reference

API failures mean a backend endpoint returned an unexpected response: wrong status code, missing validation, incorrect data shape, auth issues. Usually contained to a single procedure file.

## Diagnosis by symptom

### 401 Unauthorized
- Check: is the procedure behind the `protected` router?
- Check: is the auth middleware extracting the user correctly?
- Check: is the client sending credentials? (`storageState`, cookies, auth header)
- If testing via Playwright `request`: check that `storageState` is set in the test fixture

### 404 Not Found
- Check the route path: `/api/rpc/protected.{feature}.{action}`
- Check: is the procedure registered in the router? (`webapp/lib/orpc/router.ts`)
- Check: is the procedure exported from the right file?
- Common: typo in the procedure name or path segment

### 500 Internal Server Error
- Check the procedure's implementation
- Look for: unhandled promise rejection, missing null check on DB query, wrong column name
- Run the procedure's query manually against the DB to verify
- Check: does the procedure depend on a service/table that doesn't exist yet?

### 422 / Validation Error
- Check the input schema — does the request body match?
- The procedure's Zod/oRPC schema defines required fields
- Common: client sends `camelCase`, server expects `snake_case` (or vice versa)
- Common: client sends string, server expects number

### Wrong response shape
- Check what the procedure returns vs what the client expects
- Look at the oRPC procedure's output schema
- Common: procedure returns full object, client expects just an ID (or vice versa)

## Where to look

```
webapp/lib/orpc/
├── router.ts                    ← route tree, middleware chain
├── middleware/auth.ts           ← auth extraction, user context
└── procedures/
    └── {feature}.ts             ← the procedure implementation

webapp/lib/supabase/
├── client.ts                    ← browser client
├── server.ts                    ← server client (for server components)
└── middleware.ts                ← request-level auth
```

## Fix patterns

### Missing auth check
```typescript
// BROKEN: procedure accessible without auth
export const getSecretData = publicProcedure
  .handler(async () => { ... })

// FIXED: use protected procedure
export const getSecretData = protectedProcedure
  .handler(async ({ context }) => {
    const userId = context.user.id
    // ... fetch data scoped to user
  })
```

### Wrong input validation
```typescript
// BROKEN: accepts any string for email
.input(z.object({ email: z.string() }))

// FIXED: validate email format
.input(z.object({ email: z.string().email() }))
```

### Missing error handling on DB query
```typescript
// BROKEN: throws unhandled if record not found
const post = await db.query.posts.findFirst({
  where: eq(posts.id, input.id)
})
return post.title  // TypeError if null

// FIXED
const post = await db.query.posts.findFirst({
  where: eq(posts.id, input.id)
})
if (!post) throw new ORPCError('NOT_FOUND', 'Post not found')
return post.title
```

### Wrong response shape
```typescript
// BROKEN: client expects { id, title } but gets full object with relations
.handler(async ({ input }) => {
  return await db.query.posts.findFirst({
    where: eq(posts.id, input.id),
    with: { author: true, comments: true }  // too much data
  })
})

// FIXED: return only what the client needs (check the output schema)
.handler(async ({ input }) => {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, input.id),
    columns: { id: true, title: true, content: true }
  })
  if (!post) throw new ORPCError('NOT_FOUND')
  return post
})
```

## After fixing

Check that your fix follows:
- `.foundry/references/source-docs/patterns/backend/orpc.md` — procedure patterns, middleware, error handling
- `.foundry/references/source-docs/patterns/testing/api-contracts.md` — how API tests validate endpoints
