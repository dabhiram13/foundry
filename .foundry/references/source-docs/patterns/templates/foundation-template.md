# Foundation: {feature}

**Work Type**: {new-feature | enhancement | fix}
**Supabase Project**: `YOUR_SUPABASE_PROJECT_REF`
**Date**: {date}

## Core Rules (from core-beliefs.md)

1. Humans steer, agents execute — never invent requirements
2. One way to do everything — follow chosen patterns
3. Progressive disclosure — load what's needed, when needed
4. Forward-only architecture: Types → Config → Repo → Service → Runtime → UI
5. Server-side is the only side — `getClaims()` on every protected request, never `getUser()`/`getSession()`
6. Validate at boundaries, trust internals — Zod at API inputs
7. Pages are Server Components always — `"use client"` on smallest leaf only
8. Shared first, feature second — check `_shared/` before building
9. SRP: one procedure = one operation, one component = one concern

## Stack Summary

- **Next.js 15** (App Router, RSC, PPR with `"use cache"`)
- **oRPC** → `lib/orpc/procedures/{domain}.ts`, `.input(zod)`, mutations return `{ success, entity }`, reads return `{ items, page, hasMore, totalCount }`
- **Supabase** → server `createClient()` per request, `getClaims()` for auth, RLS on every table
- **Tailwind CSS v4** → semantic tokens only (`bg-card`, `text-muted-foreground`), never raw palette
- **TanStack Query 5** → only for infinite scroll, real-time SSE, interactive search; everything else: server component + `"use cache"`
- **Zod 3** → `secureObject()` for mutations, `SecureShortText`/`SecureLongText`/`SecureId` for user input
- **Playwright** → API tests against running dev server

## Banned Patterns

- `getUser()`, `getSession()` → use `getClaims()`
- `"use client"` on page/layout → push to leaf
- `any` type → `unknown` + Zod parse
- Raw palette colors (`text-red-500`, `bg-white`) → semantic tokens
- `invalidateQueries` → `updateTag()` server-side + `router.refresh()`
- Direct DB from UI → go through oRPC
- Feature imports another feature → go through `_shared/`
- Route segment configs (`export const dynamic`) → `"use cache"` + `cacheLife()`

## Cache Tiers

| Tier | Directive | When |
|------|-----------|------|
| Public | `"use cache"` | No auth, shared across users |
| Shared + auth | `"use cache: remote"` | Needs cookies, shareable data |
| User-scoped | `"use cache: private"` | Per-user data |
| Dynamic | No directive | Must be fresh every request |

## Relevant Schema

{Paste ONLY the tables this feature touches from db-schema.md. For new features: paste related tables for FK references. For enhancements: paste the tables being modified.}

## Feature Goal

{One-line goal from feature spec}

## Source Docs

- `docs/features/{feature}/backend.md`
- `docs/features/{feature}/frontend.md`
{If enhancement:}
- `docs/features/{feature}/enhancements/backend.md`
- `docs/features/{feature}/enhancements/frontend.md`
