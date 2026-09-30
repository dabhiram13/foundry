---
name: orpc-fullstack
description: >
  The house oRPC API layer — procedure tiers, secure Zod input, typed errors, the OpenAPI route
  handler, server actions and cache tags, the typed client. Use for "orpc", "add an endpoint",
  "new procedure", "api route", "protectedProcedure", "zod schema", "actionable", "server action",
  "cache tag", "cursor pagination", "rate limit an endpoint", "call this from the client".
  Depth lives under `references/`.
---

# oRPC — this repo's API layer

Every API call in this app is an oRPC procedure under `webapp/lib/orpc/`, served by one Next.js
route handler at `webapp/app/api/rpc/[[...rest]]/route.ts` (`OpenAPIHandler` + CORS +
`RatelimitHandlerPlugin`; the OpenAPI/Scalar plugin is dev-only).

This is not tRPC and there is no Hono server. Do not introduce either.

## Load the reference that matches the task

| Task | Reference |
|---|---|
| Write or change a procedure — tier, `.route()`, input, handler, errors, wiring | `references/procedure-anatomy.md` |
| A mutation — `.actionable()`, `buildActionContext`, `cacheInvalidator`, the client hook | `references/mutations-and-cache.md` |
| Read data — RSC caller, TanStack Query, the typed client, why the contract matters | `references/client-and-server.md` |
| Middleware chain, context fields, rate-limit tiers, adding a guard | `references/middleware-and-context.md` |
| List endpoints — cursor shape, tiebreaker, when offset is allowed | `references/pagination.md` |
| Proving a procedure works — Playwright request tests against the running server | `references/testing-procedures.md` |

Depth lives in `docs/orpc/` (`README`, `architecture`, `procedures`, `schemas`, `middleware`,
`client`, `realtime`) — this skill is the summary, those are the manual. Caveat: `realtime.md`
describes `lib/orpc/realtime.ts`, absent from `webapp/` — streaming is a design here, not code.

## The eight rules

1. **Pick a tier, never build one.** Import `publicProcedure`, `authProcedure`,
   `protectedProcedure`, `adminProcedure` or `paidProcedure` from `webapp/lib/orpc/base.ts`. Never
   import `os` from `@orpc/server` in a feature file.
2. **`base.ts` and `schemas.ts` are `PROTECTED — READ ONLY`; `router.ts` and `index.ts` are
   `PROTECTED — APPEND ONLY`.** Those banners are line 1 of each file. Feature logic goes in
   `webapp/lib/orpc/procedures/`.
3. **Identity comes from JWT claims, not from a session round-trip.** The auth middleware calls
   `supabase.auth.getClaims()` and hands the handler `context.user`
   (`{ id, email?, role, plan }`). Read `context.user`; never call `auth.getUser()` or
   `auth.getSession()` in a new handler.
4. **Entitlement fails closed.** `resolveUserFromClaims` defaults `plan` to `'free'`
   (`webapp/lib/orpc/resolve-user.ts:24`). Gate on `context.user.plan`, or use `paidProcedure`,
   which 403s every `'free'` user.
5. **Zod v4, imported plainly.** `import { z } from 'zod'` — the package is `zod ^4.3.6`. Never
   `zod/v4`. Every input is `secureObject({...})` from `../schemas`, never a bare `z.object()`.
6. **Throw `Errors.*`, never `new Error()`.** `webapp/lib/orpc/errors.ts` maps each factory to an
   HTTP status the client already understands.
7. **Every mutation gets an `.actionable()` server action** in `webapp/features/{feature}/actions.ts`
   that busts a cache tag. An HTTP-called mutation cannot invalidate the server cache.
8. **A procedure reaches the browser client only if it is in the contract.**
   `webapp/lib/orpc/contracts/index.ts` is what `OpenAPILink` is built from. A procedure in
   `router.ts` but not in the contract is server-callable only.

## A procedure, whole

```ts
// webapp/lib/orpc/procedures/posts.ts
import { protectedProcedure } from '../base'
import { SecureShortText, SecureId, secureObject } from '../schemas'
import { Errors } from '../errors'

export const rename = protectedProcedure
  .route({ method: 'POST', path: '/protected/posts/rename' })
  .input(secureObject({ id: SecureId, title: SecureShortText.min(1, 'Title is required') }))
  .handler(async ({ context, input }) => {
    const { data, error } = await context.supabase
      .from('posts')
      .update({ title: input.title })
      .eq('id', input.id)
      .eq('user_id', context.user.id)   // RLS also enforces this; the filter keeps the 404 honest
      .select('id, title')
      .single()

    if (error) throw Errors.internal(error.message)
    if (!data) throw Errors.notFound('Post not found')

    return { success: true, post: data }
  })

export const postsRouter = { rename }
```

Then append `posts: postsRouter` to `protectedRouter` in `procedures/protected.ts`, and add the
matching contract entry if the browser needs to call it.

## Tiers

| Builder | Auth | Rate limit key | Use for |
|---|---|---|---|
| `publicProcedure` | none | client IP | health, public reads |
| `authProcedure` | none | client IP, stricter | sign-in, sign-up, password reset |
| `protectedProcedure` | required | user id | everything a signed-in user does |
| `paidProcedure` | required, plan `!== 'free'` | user id | writes free users must not reach |
| `adminProcedure` | required, `role === 'admin'` | user id | admin surfaces |

The chain is built once in `base.ts`: context init → tracing → Supabase client → rate limit →
Sentry `onError` → logging → analytics, then the tier's own guards.

## Errors

| Factory | `e.code` | Status |
|---|---|---|
| `Errors.unauthorized()` | `UNAUTHORIZED` | 401 |
| `Errors.forbidden(msg)` | `FORBIDDEN` | 403 |
| `Errors.notFound(msg)` | `NOT_FOUND` | 404 |
| `Errors.badRequest(msg, { field })` | `BAD_REQUEST` | 400 |
| `Errors.internal(msg)` | `INTERNAL_SERVER_ERROR` | 500 |
| `Errors.validation(msg, { field })` | `VALIDATION_ERROR` | app-defined code |
| `Errors.rateLimited(seconds)` | `RATE_LIMITED` | app-defined code |

The last two are codes this app invented (`webapp/lib/orpc/errors.ts`), not oRPC standard ones —
branch on `e.code`, never on the status number. A client's 429 comes from the rate-limit plugin.

## Mutation, end to end

```ts
// webapp/features/posts/actions.ts
'use server'
import { rename as renameProcedure } from '@/lib/orpc/procedures/posts'
import { buildActionContext, cacheInvalidator } from '@/lib/orpc/action-utils'

export const renameAction = renameProcedure.actionable({
  context: buildActionContext,
  interceptors: [cacheInvalidator('posts')],   // generic <T> is the output type; let it infer
})
```

```ts
// webapp/features/posts/hooks/index.ts — 'use client'
const mutation = useMutation({
  mutationFn: async (values: RenameValues) => {
    const [error, data] = await renameAction(values)
    if (error) throw new Error(error.message ?? 'Rename failed')
    return data
  },
  onSuccess: () => router.refresh(),
})
```

`cacheInvalidator` calls `updateTag()` server-side; `router.refresh()` re-renders the server
components. Never `queryClient.invalidateQueries()` for a mutation — the server cache is the source
of truth, and `updateTag()` inside the HTTP handler 500s.

## Reading

- Server component: `const caller = await getORPCCaller()` then `caller.protected.settings.getProfile()`.
  It reads cookies, so it is **not** safe inside `use cache` — use `getPublicORPCCaller()` there.
- Client component: `useQuery(orpc.protected.me.queryOptions())`, or `await client.protected.me()`.
  Never fetch in a `useEffect`.

## List shapes

`{ items, nextCursor, hasMore }` for cursor, `{ items, page, hasMore, totalCount }` for offset.
Always name the array `items`. Cursor is the default; offset only for admin page-jumping.
`references/pagination.md` has the query and the required index.
