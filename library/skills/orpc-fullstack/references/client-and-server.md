# Calling procedures — server and client

## The four call paths

| From | Use | File |
|---|---|---|
| Server component / `data.ts`, user-scoped | `await getORPCCaller()` | `webapp/lib/orpc/server.ts` |
| Inside `use cache`, public data only | `getPublicORPCCaller()` | `webapp/lib/orpc/server.ts` |
| Client component, read | `orpc.*.queryOptions()` with TanStack Query | `webapp/lib/orpc/client.ts` |
| Client component, write | the `.actionable()` server action | `mutations-and-cache.md` |

## Server-side caller (no HTTP)

```ts
// webapp/features/settings/data.ts
import { getORPCCaller } from '@/lib/orpc/server'

export async function getProfileData() {
  const caller = await getORPCCaller()
  return caller.protected.settings.getProfile()
}
```

`getORPCCaller()` builds the context itself — Supabase client from cookies, `getClaims()`,
`resolveUserFromClaims` — then `createRouterClient(appRouter, { context })`. Procedures run in the
same process: no fetch, no serialization, full types.

Because it reads cookies it is **not** safe inside a `use cache` function. For cached public data use
`getPublicORPCCaller()`, which uses the admin client and carries no user — call only `public.*`
procedures through it.

`caller` reaches **every** procedure in `router.ts`, contract entry or not.

## Browser client

```ts
import { client, orpc } from '@/lib/orpc/client'
```

- `client` — a `RouterClient<AppRouter>` over `OpenAPILink`. `await client.protected.me()`.
- `orpc` — `createTanstackQueryUtils(client)`. `useQuery(orpc.protected.me.queryOptions())`,
  `orpc.protected.me.key()` for query keys.

Call paths mirror the router: `client.public.health()`, `client.auth.signIn({ email, password })`,
`client.protected.credits.getBalance()`, `client.protected.stripe.getSubscription()`.

The link is built from the **contract**, not the router:

```ts
const link = new OpenAPILink(contract, { url: `${getBaseUrl()}/api/rpc`, plugins: [ ... ] })
```

So a procedure that exists in `router.ts` but has no entry under `webapp/lib/orpc/contracts/` has no
URL the browser client knows how to build. Today `protected.jobs` and `protected.settings` are in
that position: reachable from `getORPCCaller()`, from a server action, and by raw path in a test —
not from `client.*`. If a feature needs browser access, add the contract entry:

```ts
// webapp/lib/orpc/contracts/posts.contract.ts
import { oc } from '@orpc/contract'
import { z } from 'zod'

const posts = oc.route({ tags: ['posts'] }).errors({ UNAUTHORIZED: {} })

const rename = posts
  .route({ method: 'POST', path: '/protected/posts/rename' })
  .output(z.object({ success: z.boolean(), post: z.object({ id: z.string(), title: z.string() }) }))

export default { rename }
```

then add it to the `protected` block of `contracts/index.ts`. Method and path must match the
procedure's `.route()` exactly.

The contract is also what the dev-only OpenAPI spec and Scalar UI are generated from
(`/api/rpc/spec.json` and `/api/rpc/`, both `NODE_ENV === 'development'` only).

## Queries in React

```tsx
const { data, isLoading, error } = useQuery(orpc.protected.me.queryOptions())

const list = useQuery(
  orpc.protected.posts.list.queryOptions({ input: { limit: 20 } })
)
```

No data fetching in `useEffect`. Prefer a server component read and pass the data down; reach for
TanStack Query when the data must refetch on the client (polling, filters the URL does not hold,
infinite lists).

## Client-side errors

```ts
import { ORPCError } from '@orpc/server'

try {
  await client.protected.me()
} catch (e) {
  if (e instanceof ORPCError) {
    // e.code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST'
    //       | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'INTERNAL_SERVER_ERROR'
    // e.message, e.data: { retryAfter?, field?, details? }
  }
}
```

Server actions do not throw across the boundary — they return `[error, data]`.

## Retry

`client.ts` installs `RetryAfterPlugin` (3 attempts, 30s timeout), so 429 and 503 retry themselves
and honour `Retry-After`. Do not add a retry loop of your own on top.

## The route handler

`webapp/app/api/rpc/[[...rest]]/route.ts` exports `GET`, `POST`, `PUT`, `DELETE`, all delegating to
one `handleRequest`. It builds the context (Supabase client, `getClaims()`, IP and User-Agent read
from headers server-side), runs the request inside a Sentry `AsyncLocalStorage` scope, and hands it
to `handler.handle(request, { prefix: '/api/rpc', context })`. CORS is same-origin, with `.localhost`
allowed in development for the proxy. Nothing about this file needs editing to add a procedure.
