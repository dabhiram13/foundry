# Step 5: ORPC Procedures

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Implement all auth ORPC procedures — the server-side API layer between frontend forms and Supabase Auth.

## Pre-read

- `references/auth-rules.md` — input validation, rate limiting, error messages
- `.foundry/references/source-docs/supabase/auth.md` — ORPC Auth Router section
- `webapp/lib/orpc/procedures/auth.ts` — check if file exists already
- `webapp/lib/orpc/index.ts` — router structure

## Procedures to Implement

### `signUp`

| Field | Detail |
|-------|--------|
| **Base** | `authProcedure` (rate-limited, public) |
| **Input** | `email: SecureEmail`, `password: SecurePassword`, `fullName?: SecureShortText`, `captchaToken?: string` |
| **Action** | `supabase.auth.signUp({ email, password, options: { data: { full_name }, captchaToken } })` |
| **Output** | `{ success, user: { id, email } | null, requiresEmailConfirmation: boolean }` |
| **Notes** | `requiresEmailConfirmation = true` when Supabase doesn't return a session (email verify required) |

### `signIn`

| Field | Detail |
|-------|--------|
| **Base** | `authProcedure` |
| **Input** | `email: SecureEmail`, `password: SecurePassword`, `captchaToken?: string` |
| **Action** | `supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })` |
| **Output** | `{ success, user: { id, email } | null }` |
| **Error** | ALWAYS `'Invalid email or password'` — no distinction between wrong email/wrong password |
| **Notes** | Session set as HTTP-only cookie by Supabase SSR, NOT in response body |

### `signOut`

| Field | Detail |
|-------|--------|
| **Base** | `protectedProcedure` (requires auth) |
| **Input** | None |
| **Action** | `supabase.auth.signOut()` |
| **Output** | `{ success }` |

### `verifyOtp`

| Field | Detail |
|-------|--------|
| **Base** | `authProcedure` |
| **Input** | `email: SecureEmail`, `token: z.string().length(8)`, `type: z.enum(['signup', 'recovery', 'magiclink', 'invite', 'email_change'])` |
| **Action** | `supabase.auth.verifyOtp({ email, token, type })` |
| **Output** | `{ success, user: { id, email } | null }` |
| **Notes** | 8-digit OTP. Auto-submitted by frontend when all digits entered. |

### `resendVerification`

| Field | Detail |
|-------|--------|
| **Base** | `authProcedure` |
| **Input** | `email: SecureEmail`, `type: z.enum(['signup', 'email_change'])` |
| **Action** | `supabase.auth.resend({ type, email })` |
| **Output** | `{ success }` |
| **Notes** | 60-second cooldown enforced client-side |

### `requestPasswordReset`

| Field | Detail |
|-------|--------|
| **Base** | `authProcedure` |
| **Input** | `email: SecureEmail` |
| **Action** | `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${SITE_URL}/auth/update-password' })` |
| **Output** | `{ success }` — ALWAYS returns success (anti-enumeration) |

### `updatePassword`

| Field | Detail |
|-------|--------|
| **Base** | `protectedProcedure` (requires active recovery session) |
| **Input** | `password: SecurePassword` |
| **Action** | `supabase.auth.updateUser({ password })` |
| **Output** | `{ success, user: { id, email } | null }` |

### `getSession`

| Field | Detail |
|-------|--------|
| **Base** | `publicProcedure` |
| **Input** | None |
| **Action** | `supabase.auth.getSession()` |
| **Output** | `{ session: { expiresAt } | null, user: { id, email } | null }` |
| **Notes** | Client-side session check only. NOT for server-side auth — use `getClaims()` instead. |

## Input Validators

These should exist in a shared validation file (e.g., `webapp/lib/orpc/validators.ts`):

```typescript
import { z } from 'zod';

export const SecureEmail = z.string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const SecurePassword = z.string()
  .min(8)
  .max(128);

export const SecureShortText = z.string()
  .trim()
  .max(100)
  .optional();

// Wraps z.object with .strict() to drop unknown keys
export function secureObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}
```

## Procedure Base Types

```typescript
// authProcedure: public but rate-limited (10 req/min)
// protectedProcedure: requires authenticated session
// publicProcedure: no auth, no rate limit
```

## Delegation

Use `backend` agent:
- Provide: procedure specs from above, existing router structure
- Agent writes the procedures with proper error handling and Zod schemas

## Done when

- All 8 procedures implemented in `webapp/lib/orpc/procedures/auth.ts`
- Input validators use `secureObject` with `.strict()`
- Error messages are generic (no email enumeration)
- Router exports all procedures
- `npx tsc --noEmit` passes
