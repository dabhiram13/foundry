# Procedure anatomy

Everything here is the shape the code in `webapp/lib/orpc/procedures/` already uses.

## The five parts

```ts
import { protectedProcedure } from '../base'          // 1. tier
import { SecureShortText, SecureId, secureObject } from '../schemas'
import { Errors } from '../errors'

const RenameInput = secureObject({                     // 2. input schema
  id: SecureId,
  title: SecureShortText.min(1, 'Title is required'),
})

export const rename = protectedProcedure
  .route({ method: 'POST', path: '/protected/posts/rename' })   // 3. HTTP shape
  .input(RenameInput)
  .handler(async ({ context, input }) => {             // 4. handler
    const { data, error } = await context.supabase
      .from('posts')
      .update({ title: input.title })
      .eq('id', input.id)
      .eq('user_id', context.user.id)
      .select('id, title')
      .single()

    if (error) throw Errors.internal(error.message)    // 5. typed errors
    if (!data) throw Errors.notFound('Post not found')

    return { success: true, post: data }
  })

export const postsRouter = { rename }
```

## 1. Tier

From `webapp/lib/orpc/base.ts` — `publicProcedure`, `authProcedure`, `protectedProcedure`,
`paidProcedure`, `adminProcedure`. Never `os` from `@orpc/server` in a feature file; `base.ts` is
the only place the middleware chain is assembled, and its line 1 reads
`// PROTECTED — READ ONLY. Do not modify the middleware chain. Feature logic goes in procedures/.`

Choosing:

```
Public (no login)?
├── yes → auth-related (sign in / sign up / reset)? → authProcedure : publicProcedure
└── no  → admin only?          → adminProcedure
         paid plans only?      → paidProcedure
         otherwise             → protectedProcedure
```

## 2. Input

`secureObject()` from `webapp/lib/orpc/schemas.ts` — it is `.strict()`, which is the mass-assignment
defence. Never a bare `z.object()` for user input, never a bare `z.string()`.

| Schema | Bound | For |
|---|---|---|
| `SecureShortText` | 100, trimmed | names, titles, labels |
| `SecureMediumText` | 500, trimmed | descriptions |
| `SecureLongText` | 5000, trimmed | bios, message bodies |
| `SecureEmail` | 254, lowercased | email |
| `SecurePassword` | 8–128 | passwords |
| `SecureUrl` / `SecureImageUrl` | 2048, http/https | links, avatars |
| `SecureId` / `SecureOptionalId` | UUID | entity ids |
| `PaginationSchema` | page 1–10000, limit 1–100 | offset lists |
| `SearchSchema`, `DateRangeSchema` | — | search box, date filters |

Zod is v4 (`webapp/package.json`, `"zod": "^4.3.6"`) and is imported as `import { z } from 'zod'`.
`zod/v4` is a compat path for v3 installs — it does not belong in this repo.

Extend rather than redefine: `extendSecureObject(BaseInput, { password: SecurePassword })`.
`z.coerce.number()` for anything arriving as a query string. `z.enum([...])` for closed sets.

A procedure with no input just omits `.input()`:

```ts
export const health = publicProcedure
  .route({ method: 'GET', path: '/public/health' })
  .handler(async () => ({ status: 'ok', timestamp: new Date().toISOString() }))
```

## 3. `.route()`

Every procedure in this repo declares one, because the handler is an `OpenAPIHandler` — the path is
the real URL under `/api/rpc`. Conventions in the tree: `/public/...`, `/auth/...`,
`/protected/{feature}/{action}`. `successStatus` when 200 is wrong
(`webapp/lib/orpc/procedures/auth.ts:12` uses `successStatus: 201` on sign-up).

## 4. Handler

`{ context, input }`. From `context`:

| Field | When |
|---|---|
| `context.supabase` | always — the request-scoped, deduped client. Never construct one in a handler |
| `context.user` | `protectedProcedure` and above: `{ id, email?, role: 'user' \| 'admin', plan: string }` |
| `context.requestId`, `context.startTime` | tracing and duration |
| `context.clientIp`, `context.userAgent` | extracted server-side in `route.ts`, never trusted from the body |

`context.user` is resolved from the Supabase JWT by `resolveUserFromClaims`
(`webapp/lib/orpc/resolve-user.ts`) — `role` is `'admin'` only when the `is_admin` claim is exactly
`true`, and `plan` falls back to `'free'` when the claim is missing or not a string. That fallback is
the entitlement default: unknown means free, never means paid.

Do not call `supabase.auth.getUser()` or `supabase.auth.getSession()` inside a handler. Three
handlers written before the rule still do — `procedures/credits.ts:24`, `procedures/auth.ts:180`,
`procedures/onboarding.ts:83`. They are the exceptions, not the pattern; do not copy them.

## 5. Errors

```ts
Errors.unauthorized()                                  // UNAUTHORIZED          → 401
Errors.forbidden('Upgrade to a paid plan')             // FORBIDDEN             → 403
Errors.notFound('Post not found')                      // NOT_FOUND             → 404
Errors.badRequest('Invalid input', { field: 'email' }) // BAD_REQUEST           → 400
Errors.internal(error.message)                         // INTERNAL_SERVER_ERROR → 500
Errors.validation('Name too short', { field: 'name' }) // VALIDATION_ERROR      → app-defined code
Errors.rateLimited(60)                                 // RATE_LIMITED          → app-defined code
```

They are `ORPCError` subclasses (`webapp/lib/orpc/errors.ts`), so the client gets `code`, `message`
and typed `data` (`{ retryAfter?, field?, details? }`). A raw `new Error()` reaches the client as an
untyped 500.

`VALIDATION_ERROR` and `RATE_LIMITED` are codes this app added to `AppErrorCode`; they are not part
of oRPC's standard set, so a client must branch on `e.code`, not on the HTTP status. The 429 a client
actually sees is emitted by `RatelimitHandlerPlugin` in the route handler.

## Wiring

1. Export the individual procedures **and** a router object from the file.
2. Append the router to its parent — `protectedRouter` in `procedures/protected.ts`, then
   `appRouter` in `router.ts`. Both `router.ts` and `index.ts` are marked
   `PROTECTED — APPEND ONLY`: add entries, never rewrite existing ones.
3. If the browser must call it, add the matching entry under
   `webapp/lib/orpc/contracts/` and export it from `contracts/index.ts` — see
   `client-and-server.md`.
4. If it mutates, write the `.actionable()` server action — see `mutations-and-cache.md`.

## Checklist

- [ ] Tier imported from `../base`, not `@orpc/server`
- [ ] `.route()` with method and path under the right prefix
- [ ] `secureObject()` input, `zod` (not `zod/v4`)
- [ ] DB through `context.supabase`, identity through `context.user`
- [ ] `Errors.*` on every failure path
- [ ] Procedure + router both exported, parent router appended
- [ ] Contract entry if the client calls it
- [ ] `.actionable()` server action if it writes
- [ ] No `any`, no `as unknown as X`, no non-null `!`
