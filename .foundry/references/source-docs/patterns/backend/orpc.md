# oRPC Patterns

Contract-first API layer. Everything an AI agent needs to add an API backend feature.

---

## 1. Secure Schemas

All user input uses secure Zod schemas. Defined in `lib/orpc/schemas.ts`.

```typescript
import {
  SecureShortText,    // string, trim, max 100
  SecureMediumText,   // string, trim, max 500
  SecureLongText,     // string, trim, max 5000
  SecureEmail,        // string, trim, max 254, email, lowercase
  SecurePassword,     // string, min 8, max 128
  SecureUrl,          // string, trim, max 2048, url
  SecureImageUrl,     // string, trim, max 2048, url, http/https only
  SecureId,           // string, uuid
  SecureOptionalId,   // string, uuid, optional
  secureObject,       // z.object().strict() wrapper
  PaginationSchema,   // { page, limit } with safe bounds
  SearchSchema,       // { query } trimmed, max 200
  BooleanParam,       // coerce boolean from string
} from '../schemas'
```

**Rules:** NEVER use raw `z.string()` for user input. Enums: `z.enum(['a', 'b'])`. Output schemas use plain `z.object()` (no `.strict()`). **Clarification:** `secureObject()` / `.strict()` is for MUTATION inputs only. GET/query inputs use plain `z.object()` — even if they contain SecureId fields. The distinction is mass assignment prevention on writes, not input validation on reads.

---

## 2. Contract (API Shape)

Contracts define the API shape. Procedures implement them. TypeScript enforces the match.

```
lib/orpc/contracts/
  {feature}.contract.ts   # one per domain
  index.ts                # root barrel
```

```typescript
// lib/orpc/contracts/{feature}.contract.ts
import { oc } from '@orpc/contract'
import { z } from 'zod'
import { SecureShortText, SecureId } from '../schemas'

const feature = oc
  .route({ tags: ['{feature}'] })
  .errors({ UNAUTHORIZED: {}, NOT_FOUND: {}, BAD_REQUEST: {} })

const list = feature
  .route({ method: 'GET', path: '/protected/{feature}' })
  .input(z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
  }))
  .output(z.object({
    items: z.array(ItemSchema),
    page: z.number(),
    hasMore: z.boolean(),
    totalCount: z.number(),
  }))

const create = feature
  .route({ method: 'POST', path: '/protected/{feature}', successStatus: 201 })
  .input(z.object({
    title: SecureShortText.min(1, 'Title is required'),
  }).strict())
  .output(z.object({ success: z.boolean(), id: z.string() }))

const getById = feature
  .route({ method: 'GET', path: '/protected/{feature}/{id}' })
  .input(z.object({ id: SecureId }).strict())
  .output(ItemSchema)

const remove = feature
  .route({ method: 'DELETE', path: '/protected/{feature}/{id}' })
  .input(z.object({ id: SecureId }).strict())
  .output(z.object({ success: z.boolean() }))

export default { list, create, getById, remove }
```

**Rules:**
1. Every procedure MUST have `.output()` — needed for OpenAPI spec
2. Use `.strict()` on input objects — prevents mass assignment
3. Use secure schemas — never raw `z.string()`
4. Output schemas use camelCase field names (`createdAt`, `resourceType`) — DB returns snake_case, map in the query or select alias
4. REST methods: GET reads, POST creates/actions, DELETE deletes
5. Paths: `/public/` unauthenticated, `/protected/` authenticated, `/auth/` auth
6. Tags group procedures in OpenAPI — one tag per domain
7. Declare `.errors()` on the base — shared across all procedures

---

## 3. Procedure (Handler)

Procedures implement contracts. The contract defines the shape, the procedure provides the handler.

```typescript
// lib/orpc/procedures/{feature}.ts
import { implement } from '@orpc/server'
import featureContract from '../contracts/{feature}.contract'
import { Errors } from '../errors'
import type { AuthedContext } from '../context'

const impl = implement(featureContract).$context<AuthedContext>()

const list = impl.list
  .handler(async ({ context, input }) => {
    const { data, error } = await context.supabase
      .from('{table}')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw Errors.internal(error.message)
    return { items: data ?? [], page: input.page, hasMore, totalCount }
  })

const create = impl.create
  .handler(async ({ context, input }) => {
    const { data, error } = await context.supabase
      .from('{table}')
      .insert({ title: input.title, user_id: context.user.id })
      .select('id')
      .single()

    if (error) throw Errors.internal(error.message)
    return { success: true, id: data.id }
  })

export const featureRouter = { list, create }
```

**Context types:**

| Type | Use for | `supabase` | `user` |
|------|---------|-----------|--------|
| `ResolvedContext` | Public procedures | guaranteed | optional |
| `AuthedContext` | Protected procedures | guaranteed | guaranteed |

With `AuthedContext`, no need for `if (!context.user)` guards — TypeScript guarantees it. Note: `context.user` includes `id`, `email`, `role`, and `plan` (from JWT claims).

**Error handling:**
```typescript
import { Errors } from '../errors'

throw Errors.unauthorized()              // 401
throw Errors.forbidden('Not allowed')    // 403
throw Errors.notFound('Item not found')  // 404
throw Errors.badRequest('Invalid input') // 400
throw Errors.internal(error.message)     // 500
throw Errors.rateLimited(60)             // 429
```

**Key patterns:**
1. `implement(contract).$context<AuthedContext>()` — creates typed implementation. NOTE: Some codebases use `protectedProcedure.route().input().handler()` instead. Check existing procedures to determine which pattern is in use. Do not mix patterns.
2. `impl.{name}.handler(...)` — TypeScript enforces input/output match
3. `context.supabase` for all DB queries — always available
4. `context.user.id` for user scoping — no null check with `AuthedContext`
5. Return shapes must match the contract's `.output()` exactly
6. Helpers/types go in the same file — no separate files
7. **Every mutation MUST have a `.actionable()` server action** (see section 6)

---

## 4. Router Wiring (3 steps)

### Step 1: Create the contract
`lib/orpc/contracts/{feature}.contract.ts` (see section 2)

### Step 2: Create the procedure
`lib/orpc/procedures/{feature}.ts` (see section 3)

Export: `export const featureRouter = { list, create, update, remove }`

### Step 3: Wire it in

**Contract barrel** — `lib/orpc/contracts/index.ts`:
```typescript
import featureContract from './{feature}.contract'

export const contract = {
  protected: {
    // ... existing ...
    {feature}: featureContract,
  },
}
```

**Protected router** — `lib/orpc/procedures/protected.ts`:
```typescript
import { featureRouter } from './{feature}'

export const protectedRouter = {
  // ... existing ...
  {feature}: featureRouter,
}
```

**Main router** — `lib/orpc/router.ts`: Do NOT modify. It imports `protectedRouter` automatically.

### Router structure
```
appRouter
+-- public          (ResolvedContext -- no auth required)
|   +-- health, echo
|   +-- ideas       (list, getBySlug)
+-- auth            (ResolvedContext -- stricter rate limits)
|   +-- signUp, signIn, signOut, verifyOtp, resendVerification, ...
+-- protected       (AuthedContext -- auth required)
    +-- me, updateProfile
    +-- stripe       (getSubscription, createCheckoutSession, ...)
    +-- onboarding   (getProfile, updateName, ...)
    +-- credits      (getBalance)
    +-- ideas        (getSteps, toggleReaction, getMyReactions)
    +-- builds       (list, getSteps, markStepDone, getDownloadUrl)
    +-- kitPurchases (getKitPurchase, confirmKitPurchase, listMyPurchases)
    +-- swarm        (joinWaitlist, getWaitlistStatus)
```

### OpenAPI
- Spec auto-generated at `/api/rpc/.well-known/openapi`
- Tags from contracts group procedures in the spec
- Every procedure has a readable REST path (e.g. `GET /protected/builds`)

---

## 5. Migration (Database)

Use the Supabase MCP `apply_migration` tool for all DDL operations.

### Standard table template
```sql
CREATE TABLE IF NOT EXISTS public.{table_name} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table_name}_select_own"
  ON public.{table_name} FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "{table_name}_insert_own"
  ON public.{table_name} FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "{table_name}_update_own"
  ON public.{table_name} FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "{table_name}_delete_own"
  ON public.{table_name} FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_{table_name}_user_id ON public.{table_name}(user_id);
CREATE INDEX idx_{table_name}_created_at ON public.{table_name}(created_at DESC);

CREATE OR REPLACE FUNCTION update_{table_name}_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_{table_name}_updated_at
  BEFORE UPDATE ON public.{table_name}
  FOR EACH ROW
  EXECUTE FUNCTION update_{table_name}_updated_at();
```

### MCP usage
```
Tool: mcp__supabase__apply_migration
Params:
  project_id: "YOUR_SUPABASE_PROJECT_REF"
  name: "create_{table_name}_table"
  query: "<SQL above>"
```

**Rules:**
1. ALWAYS enable RLS on new tables
2. ALWAYS add policies for CRUD operations
3. Use `auth.uid()` for user-scoped data
4. Use `gen_random_uuid()` for primary keys
5. Include `created_at` and `updated_at` on every table
6. Add indexes for commonly queried columns
7. Use foreign keys with `ON DELETE CASCADE` where appropriate
8. For public-readable tables, add `FOR SELECT TO authenticated` (or `TO anon` if truly public)

---

## 6. Mutation Pattern — `.actionable()` + `updateTag()` (MANDATORY)

**Every mutation procedure MUST have a server action counterpart.** This is how instant cache invalidation works.

### Why

`updateTag()` from `next/cache` can ONLY run inside a server action or route handler. It CANNOT run inside an oRPC HTTP handler — it will throw a 500 error. `.actionable()` converts the procedure into a server action where `updateTag()` works.

### How

**1. Procedure** (normal — no cache logic here):
```typescript
// lib/orpc/procedures/{feature}.ts
export const create = protectedProcedure
  .input(CreateInput)
  .handler(async ({ context, input }) => {
    const { data, error } = await context.supabase
      .from('{table}').insert({ ... }).select('id').single()
    if (error) throw Errors.internal(error.message)
    return { success: true, id: data.id }
  })
```

**2. Server action** (`'use server'` file):
```typescript
// features/{feature}/actions.ts
'use server'
import { create as createProcedure } from '@/lib/orpc/procedures/{feature}'
import { buildActionContext, cacheInvalidator } from '@/lib/orpc/action-utils'

export const createAction = createProcedure.actionable({
  context: buildActionContext,
  interceptors: [cacheInvalidator<{ success: boolean; id: string }>('{tag}')],
})
```

**3. Client hook**:
```typescript
// features/{feature}/hooks/use-{feature}-mutations.ts
'use client'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { createAction } from '../actions'

export function useCreate() {
  const router = useRouter()
  return useMutation({
    mutationFn: async (input) => {
      const [error, data] = await createAction(input)
      if (error) throw error
      return data
    },
    onSuccess: () => router.refresh(),
  })
}
```

### Flow

```
Client hook → server action (.actionable) → procedure handler → DB write
                                          → interceptor: updateTag('{tag}')
           ← [error, data] tuple
           → onSuccess: router.refresh() → server re-renders with fresh cache
```

### Rules

1. **NEVER call `updateTag()` inside a procedure handler** — 500 error in HTTP context
2. **NEVER use `invalidateQueries()`** — doesn't clear server cache
3. **ALWAYS use `cacheInvalidator<OutputType>('{tag}')`** — generic must match procedure output
4. **ALWAYS call `router.refresh()` in `onSuccess`** — triggers server re-render
5. `buildActionContext` reads cookies → works in server action context
6. Helper file: `lib/orpc/action-utils.ts` (NOT a `'use server'` file — non-async exports)
