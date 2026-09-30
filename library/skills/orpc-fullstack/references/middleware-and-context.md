# Middleware and context

`webapp/lib/orpc/base.ts` assembles every chain in the app, once, and its first line is
`// PROTECTED — READ ONLY. Do not modify the middleware chain. Feature logic goes in procedures/.`
Read it to understand a request; change it only under an explicit instruction to change the security
model.

## Chain order

`publicProcedure`:

```
1. contextInit          requestId + startTime, seeds the Sentry scope
2. tracing              OpenTelemetry span wrapping everything downstream
3. supabase             context.supabase ?? await createClient()   (dedupe — reuses a caller's client)
4. publicRateLimit      by client IP
5. onError(sentry)      captures with path, requestId, user
6. logging              console.debug on success, console.error on throw, both with duration
7. analytics            fire-and-forget in a finally block, success or failure
```

`authProcedure` = public + `authRateLimit` (stricter, by IP).

`protectedProcedure` = public + `auth` (resolve user from claims) + `requireAuth` (401 if none) +
`protectedRateLimit` (by user id).

`paidProcedure` = protected + `requirePaid` — 403 `Upgrade to a paid plan to access this feature`
when `context.user.plan === 'free'`.

`adminProcedure` = protected + `requireAdmin` — 403 `Admin access required` unless
`context.user.role === 'admin'`.

## Where identity comes from

```ts
const { data: claimsData } = await context.supabase.auth.getClaims()
const claims = claimsData?.claims
if (claims) {
  const orpcUser = resolveUserFromClaims(claims)   // lib/orpc/resolve-user.ts
  ...
}
```

The auth middleware short-circuits when `context.user?.id` is already set, because the route handler
and the server caller resolve the user before the chain runs — one `getClaims()` per request, not
two.

`resolveUserFromClaims` is the single source of truth for claims → user, and it is deliberately
strict:

```ts
{
  id:    claims.sub,                                        // no sub → undefined user → 401
  email: typeof claims.email === 'string' ? claims.email : undefined,
  role:  claims.is_admin === true ? 'admin' : 'user',       // exactly true, nothing truthy
  plan:  typeof claims.plan === 'string' ? claims.plan : 'free',
}
```

Both defaults fail closed. Do not re-derive role or plan in a handler; read `context.user`.

## Context

```ts
interface ORPCContext {
  requestId: string
  startTime: number
  user?: ORPCUser            // present from protectedProcedure down
  supabase?: SupabaseClient
  clientIp?: string          // extractClientIp(): x-forwarded-for → x-real-ip → cf-connecting-ip
  userAgent?: string
}
```

`ResolvedContext` narrows `supabase` to required; `AuthedContext` narrows `user` too — both in
`webapp/lib/orpc/context.ts`, and both are what the route handler and callers `satisfies`.

IP and User-Agent are read from the request headers in `route.ts`. They are never accepted from the
request body.

## Rate limiting

`webapp/lib/orpc/rate-limit.ts` is the live one: `MemoryRatelimiter` from
`@orpc/experimental-ratelimit`, three middleware factories keyed by IP (public, auth) and user id
(protected). In-memory means per-instance — correct for one process, not for a horizontally scaled
deploy.

`webapp/lib/orpc/ratelimit.ts` holds an Upstash/Redis variant that nothing currently imports. It is
the migration target for multi-instance, not a second live limiter — check which one `base.ts`
imports before reasoning about limits.

`RatelimitHandlerPlugin` in the route handler is what turns a limiter rejection into
`429` + `Retry-After`, which the client's `RetryAfterPlugin` then honours.

## Adding a guard

Put the guard on a tier that already exists rather than inventing a chain. When a feature genuinely
needs its own, build it from the exported builder and keep it in the feature's procedure file:

```ts
import { procedureBuilder } from '../base'   // the raw `base`, exported for this purpose
import { Errors } from '../errors'
import type { ORPCUser } from '../context'

const requireOwner = procedureBuilder
  .$context<{ user?: ORPCUser }>()
  .middleware(async ({ context, next }) => {
    if (!context.user) throw Errors.unauthorized()
    return next()
  })

export const something = protectedProcedure.use(requireOwner).route({ ... }).handler(...)
```

A guard throws `Errors.*` and otherwise returns `next()`. It never returns a response.

## Observability

| Layer | Where |
|---|---|
| OpenTelemetry spans per procedure | `webapp/lib/orpc/tracing.ts` |
| Sentry capture with oRPC context | `webapp/lib/orpc/sentry.ts` |
| Fire-and-forget analytics event per call | `webapp/lib/orpc/analytics.ts` |
| Request replay / idempotency / nonce checks | `webapp/lib/orpc/request-integrity.ts` |

Analytics has a pluggable transport — `setAnalyticsTransport(fn)` at app init. None of these ever
block or fail a request.
