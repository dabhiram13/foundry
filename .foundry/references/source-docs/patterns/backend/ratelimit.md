# Rate Limiting

Two layers: **Vercel WAF** (edge, public + auth) + **Upstash Redis** (application, protected only).

---

## Architecture

```
Request → Vercel WAF (edge, free) → oRPC function
                                       ├─ public: no middleware (WAF handles it)
                                       ├─ auth: no middleware (WAF + Supabase Auth + Turnstile)
                                       └─ protected: Upstash Redis (per-user ID)
```

| Layer | Protects | Limit | Key | Cost |
|-------|----------|-------|-----|------|
| **Vercel WAF** | Public routes | 60 req/min | IP | Free (Pro plan) |
| **Vercel WAF** | Auth routes | 20 req/min | IP | Free (Pro plan) |
| **Supabase Auth** | Auth routes | GoTrue built-in | IP | Already included |
| **Turnstile** | signUp, signIn | Captcha | Bot detection | Free |
| **Upstash Redis** | Protected routes | 120 req/min | User ID | Free: 500K commands/mo |

**Why no Redis on auth?** Supabase Auth already rate-limits at GoTrue level. Turnstile blocks bots. WAF blocks IP floods at the edge. Adding Redis just wastes commands.

**Why no Redis on public?** WAF does IP-based rate limiting at the edge for free, before your function even cold-starts. Zero latency, zero cost.

---

## Enable / Disable Upstash

**Enable**: Add Upstash via [Vercel Marketplace](https://vercel.com/marketplace/upstash) → auto-sets env vars. Or manually:

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

**Disable**: Remove or leave empty. No env vars = no rate limiting on protected routes, zero overhead.

---

## How It Works (Protected Tier)

```
Protected request → oRPC → protectedProcedure → ratelimit middleware → handler
                                                       ↓
                                              env vars set? ──NO──→ skip (no-op)
                                                       ↓ YES
                                              check Upstash Redis (sliding window, per user ID)
                                                       ↓
                                              under limit? ──YES──→ proceed
                                                       ↓ NO
                                              throw TOO_MANY_REQUESTS (429)
```

Two pieces work together:
- `createProtectedRatelimit()` in middleware — enforces per-user limit
- `RatelimitHandlerPlugin` in route handler — adds `RateLimit-Remaining` and `Retry-After` response headers

---

## Files

| File | What |
|------|------|
| `lib/orpc/ratelimit.ts` | Protected limiter creation + middleware factory. Returns `undefined` when disabled. |
| `lib/orpc/base.ts` | Conditionally applies protected ratelimit middleware |
| `app/api/rpc/[[...rest]]/route.ts` | `RatelimitHandlerPlugin` adds rate limit headers |

---

## Per-Endpoint Stricter Limits

For expensive mutations (email, export, bulk, destructive), use `createCustomRatelimit()`:

```typescript
import { createCustomRatelimit } from '@/lib/orpc/ratelimit'

// Email-triggering: 10/hour per user
const emailLimiter = createCustomRatelimit(10, 3600)

// Export: 5/min per user
const exportLimiter = createCustomRatelimit(5, 60)

// Destructive: 1/hour per user
const destructiveLimiter = createCustomRatelimit(1, 3600)

// Chain onto protectedProcedure — limiter may be undefined (no Upstash configured)
const baseProcedure = emailLimiter
  ? protectedProcedure.use(emailLimiter)
  : protectedProcedure

export const sendInvite = baseProcedure
  .input(SendInviteSchema)
  .handler(async ({ context, input }) => { ... })
```

| Tier | Max Requests | Window | Use For |
|------|-------------|--------|---------|
| default | 120 | 60s | Standard CRUD |
| email | 10 | 3600s | Any mutation that sends email |
| export | 5 | 60s | CSV export, PDF generation |
| bulk | 10 | 60s | Batch operations (>10 rows) |
| destructive | 1 | 3600s | Delete account, purge data |

Returns `undefined` when Upstash env vars aren't set — rate limiting is a no-op, won't break anything.

---

## Changing the Protected Limit

Edit `lib/orpc/ratelimit.ts` — the `createUpstashLimiter()` call:

```typescript
// Protected: createUpstashLimiter(120, 60) → 120 req per 60s per user
```

---

## Vercel WAF Rules

Configured in Vercel Dashboard → Firewall → Rules. Not in code.

| Rule | Path (starts with) | Window | Requests | Key |
|------|--------------------|--------|----------|-----|
| Public API | `/api/rpc/public` | 60s | 60 | IP |
| Auth API | `/api/rpc/auth` | 60s | 20 | IP |
| Global Fallback | `/api` | 60s | 200 | IP |

Run `/rate-limit` to set these up with step-by-step guidance.
