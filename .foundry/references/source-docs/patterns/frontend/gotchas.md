# Frontend Gotchas

Lessons from real bugs. Read before writing components.

## Data Patterns

- **Server-first data fetching** — use server components with `'use cache'` + `cacheTag()`. Only use `useQuery` for client-managed state (infinite scroll, real-time, interactive search).
- **Derive values from query data directly** — never copy query data into `useState` via `useEffect`. Use `const userId = data?.id ?? null` instead.
- **No `any`** — use `unknown` for untyped data, `Error` type for mutation error callbacks, `Record<string, unknown>` for JSON.
- **Prefix unused params with `_`** — ESLint rule: `_roomId`, `_unused`.
- **React Hook Form + Zod for all forms** — never `useState` for form field values. Use `useForm` + `zodResolver`.

## Mutations

- **No `invalidateQueries`** — server handles cache via `.actionable()` server actions with `updateTag()`. Client calls `router.refresh()` to re-render with fresh data.
- **No `client.*` for mutations** — use `.actionable()` server actions instead. HTTP client calls can't trigger `updateTag()`.
- **NEVER call `updateTag()` inside an oRPC procedure handler** — it will 500. `updateTag()` only works in server actions and route handlers. Use `.actionable()` with `cacheInvalidator()` interceptor.
- **`.actionable()` returns `[error, data]` tuple** — always destructure and throw on error: `const [error, data] = await action(input); if (error) throw error;`
- **`useMutation` for loading/error state** — never manual `useState(false)` + try/finally. Use `isPending` from `useMutation`.

## Auth

- **Never query `auth.users` on the client** — use `profiles` table or get user data from oRPC procedures.
- **Never use `getSession()` or `getUser()`** — always `getClaims()` server-side.

## Cache Components (cacheComponents: true)

- **Route segment configs are build errors** — never generate `export const dynamic`, `export const revalidate`, `export const fetchCache`, `export const runtime`. All dead with cacheComponents.
- **Force dynamic with `connection()`** — `import { connection } from 'next/server'` then `await connection()` to defer to request time.
- **No runtime APIs inside `use cache`** — `cookies()`, `headers()`, `searchParams` cannot be called inside `'use cache'`. Pass values as arguments instead.
- **Default is dynamic** — no directive needed for request-time data. Only add `'use cache'` for data that should be cached across requests.
- **`updateTag()` for instant invalidation** — use in oRPC mutation procedures. Same request sees fresh data.
- **`revalidateTag()` for background invalidation** — next request sees fresh data (stale-while-revalidate).

## Loading States & Focus

The judgment (content already on screen never disappears; skeleton on first paint only; focus moves to the result, the next item, or the container — never the body) is `.foundry/philosophy/async-state.md`. The mechanics — `startTransition` + `shallow: false`, filters outside the boundary, `onOpenChange` + trigger ref, `useEffect` keyed on status — are in `loading-states-pattern.md`.

## Accessibility

- **Hover + keyboard equivalents** — every `group-hover:opacity-100` MUST pair with `group-focus-within:opacity-100`. Hover-only reveal is a WCAG failure. Test: can every action be triggered via Tab + Enter?
- **aria-live for all dynamic state changes** — saving spinners, checkmarks, filter result counts, infinite scroll loads, mutation outcomes are visual-only. Add `aria-live="polite"` region near the trigger for every dynamic content update.

## Dual Cache Invalidation

- **Server + client cache** — if a feature uses BOTH `'use cache'` server data AND `useQuery`/`useInfiniteQuery` client data, mutations must invalidate both: `cacheInvalidator('{tag}')` in the server action (server cache) + `queryClient.invalidateQueries` in `onSuccess` (client cache). Missing either leaves stale data.

## Infinite Queries

- **queryKey must use orpc key prefix** — `[...orpc.protected.{feature}.list.key(), { filters }]` so cache invalidation matches.
