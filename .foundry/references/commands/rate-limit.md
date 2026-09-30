<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: rate-limit
description: Move rate limiting from in-memory to production-grade distributed limits (Upstash/Redis) across the API surface.
---

# /rate-limit — Production Rate Limiting Setup

Transition from in-memory rate limiting to production-grade distributed rate limiting.

## Overview

The template ships with **in-memory rate limiting** (`webapp/lib/orpc/rate-limit.ts`) — useless on serverless because each function invocation has its own memory. This command transitions to:

| Layer | Protects | How | Cost |
|-------|----------|-----|------|
| **Vercel WAF** | Public + Auth routes | Edge-level per-IP rate limiting, blocks before function runs | Free (Pro plan) |
| **Supabase Auth** | Auth endpoints | Built-in GoTrue rate limits + Turnstile captcha | Already included |
| **Upstash Redis** | Protected endpoints | Per-user ID throttling (120 req/min) — the one layer Supabase can't do | Free tier: 500K commands/mo |

**Why NOT rate-limit auth with Redis?** Supabase Auth already rate-limits signups, logins, OTP, and password resets at the GoTrue level. Turnstile blocks bots. Vercel WAF blocks IP floods at the edge. Adding Upstash on top just wastes Redis commands for zero added security.

## Instructions

### Phase 1: Analyze Endpoints

Before setting limits, spawn a `planner` agent to audit all oRPC endpoints.

Use the **Agent tool** with this prompt:

```
You are a backend rate-limiting analyst. Read all oRPC procedure files and produce a rate limit recommendation report.

Read ALL files inside: webapp/lib/orpc/procedures/
Also read: webapp/lib/orpc/router.ts and webapp/lib/orpc/base.ts

For each endpoint, output a table with columns:
| Route Path | Procedure Type | Method | Recommended Limit | Reasoning |

Group by:
1. **PUBLIC routes** (Vercel WAF) — these get IP-based edge rate limiting
2. **AUTH routes** (Vercel WAF + Supabase built-in) — already protected, just verify
3. **PROTECTED routes** (Upstash Redis) — these need per-user rate limiting

For protected routes, consider:
- READ endpoints (GET) can be more generous (user browsing)
- WRITE endpoints (POST/PUT/DELETE) should be stricter (mutations cost more)
- Payment endpoints (checkout, upgrade) should be very strict (fraud prevention)
- Onboarding endpoints are burst-heavy (user fills form quickly) — don't make too tight

Output:
1. Recommended Vercel WAF rules (path, limit, window)
2. Recommended Upstash protected tier limit
3. Any endpoints that need special attention
```

Present the agent's recommendations to the user. Let them review before proceeding.

### Phase 2: Create Upstash Redis

Tell the user:

> **Create Upstash Redis on Vercel:**
>
> 1. Go to: **https://vercel.com/~/stores**
> 2. Click **Create Store** → select **Upstash Redis**
> 3. Name it (e.g. `my-app-ratelimit`), pick the closest region, click **Create**
> 4. Go to the store's **Settings** tab → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
> 5. Connect the store to your Vercel project (Settings → Connected Projects)
> 6. Add both values to your local `webapp/.env`:
>
> ```env
> # Upstash Redis (rate limiting)
> UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
> UPSTASH_REDIS_REST_TOKEN=AXxx...
> ```
>
> **Note:** Vercel may give you `KV_REST_API_URL` / `KV_REST_API_TOKEN` instead.
> Use those values but name them `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

Wait for the user to confirm before proceeding.

### Phase 3: Switch from In-Memory to Upstash

Check the current state of the codebase and make these changes:

1. **Read** `webapp/lib/orpc/base.ts` — check which rate-limit file it imports from

2. **If it imports from `./rate-limit`** (in-memory), update it:
   - Change the import to: `import { createProtectedRatelimit } from './ratelimit'`
   - Create singleton limiter at module level:
     ```typescript
     // Upstash rate limiter — undefined when env vars are missing (graceful no-op)
     // Public + Auth: handled by Vercel WAF (edge) + Supabase Auth built-in limits + Turnstile
     // Protected: per-user ID throttling (only layer Supabase can't do)
     const protectedRatelimit = createProtectedRatelimit()
     ```
   - Remove ALL old rate limit middleware from public and auth chains
   - `authProcedure` should just be `publicProcedure` (no extra middleware — Supabase + WAF + Turnstile handle it)
   - Wire protected conditionally:
     ```typescript
     const protectedBase = publicProcedure
       .use(authMiddleware)
       .use(requireAuthMiddleware)
     export const protectedProcedure = protectedRatelimit
       ? protectedBase.use(protectedRatelimit)
       : protectedBase
     ```

3. **If it already imports from `./ratelimit`** (Upstash), just verify the wiring is correct

4. **Delete** `webapp/lib/orpc/rate-limit.ts` if it still exists (old in-memory file)

5. **Verify** `webapp/app/api/rpc/[[...rest]]/route.ts` has `RatelimitHandlerPlugin` in the handler plugins

6. **Verify** `webapp/lib/orpc/ratelimit.ts` exists with only `createProtectedRatelimit()` (no public/auth)

7. **Apply the agent's recommended limit** from Phase 1 if different from default:
   - Edit `webapp/lib/orpc/ratelimit.ts` — update the `createUpstashLimiter(120, 60)` call

8. **Type check**:
   ```bash
   cd webapp && npx tsc --noEmit
   ```

### Phase 4: Configure Vercel WAF

Guide the user step-by-step through the Vercel Firewall UI.

Tell the user:

> **Set up Vercel WAF rate limiting:**
>
> Go to your project's firewall:
> **https://vercel.com/[team]/[project]/firewall/configure/rule/new?templateAction=rate_limit**
>
> You'll see a form with: Name, Description, Configure (If / Rate Limit / Then).
>
> ---
>
> **Rule 1: Public API Rate Limit**
>
> | Field | What to enter |
> |-------|---------------|
> | **Name** | `Public API Rate Limit` |
> | **Description** | `Rate limit public API endpoints by IP` |
> | **If** → Request Path | Operator: **"starts with"** — Value: `/api/rpc/public` |
> | **Rate Limit** | Fixed Window — **60** seconds — **60** requests |
> | **Keys** | `IP Address` (default) |
> | **Then** | `Too Many Requests (429)` (default) |
>
> Click **Save Rule**.
>
> ---
>
> **Rule 2: Auth API Rate Limit**
>
> Create another rule:
>
> | Field | What to enter |
> |-------|---------------|
> | **Name** | `Auth API Rate Limit` |
> | **Description** | `Edge-level brute force protection for auth endpoints` |
> | **If** → Request Path | Operator: **"starts with"** — Value: `/api/rpc/auth` |
> | **Rate Limit** | Fixed Window — **60** seconds — **20** requests |
> | **Keys** | `IP Address` |
> | **Then** | `Too Many Requests (429)` |
>
> Click **Save Rule**.
>
> This is a coarse outer shield. Supabase Auth has its own stricter built-in limits, and Turnstile blocks bots. This WAF rule just stops IP-level floods before your function cold-starts.
>
> ---
>
> **Rule 3 (optional): Global API Fallback**
>
> | Field | What to enter |
> |-------|---------------|
> | **Name** | `Global API Rate Limit` |
> | **Description** | `Catch-all for entire API surface` |
> | **If** → Request Path | Operator: **"starts with"** — Value: `/api` |
> | **Rate Limit** | Fixed Window — **60** seconds — **200** requests |
> | **Keys** | `IP Address` |
> | **Then** | `Too Many Requests (429)` |

Wait for the user to confirm they've created the rules.

### Phase 5: Summary

Print the final summary:

> **Rate limiting configured!**
>
> | Layer | What | Limit | Key |
> |-------|------|-------|-----|
> | Vercel WAF | `/api/rpc/public/*` | 60 req/min | IP |
> | Vercel WAF | `/api/rpc/auth/*` | 20 req/min | IP |
> | Vercel WAF | `/api/*` (fallback) | 200 req/min | IP |
> | Supabase Auth | GoTrue built-in | Per-endpoint | IP |
> | Turnstile | signUp, signIn | Captcha | Bot detection |
> | Upstash Redis | All protected endpoints | 120 req/min | User ID |
>
> ```
> Request → Vercel WAF (edge, free) → oRPC function
>                                        ├─ public: no extra middleware
>                                        ├─ auth: Supabase + Turnstile handle it
>                                        └─ protected: Upstash Redis (per-user ID)
> ```
>
> **Files:**
> - `webapp/lib/orpc/ratelimit.ts` — Upstash protected limiter (edit limit here)
> - `webapp/lib/orpc/base.ts` — Middleware chain
> - Vercel Dashboard → Firewall → Rules (WAF config)
> - Supabase Dashboard → Auth → Rate Limits (built-in config)
