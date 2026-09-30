# Step 7: Middleware

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Implement route protection middleware that refreshes sessions, protects routes, and handles redirects — using JWT only, no DB queries.

## Pre-read

- `references/auth-rules.md` — middleware rules, banned patterns
- `.foundry/references/source-docs/supabase/auth.md` — Middleware section
- `webapp/middleware.ts` or `webapp/proxy.ts` — check what exists

## Architecture

```
Every matched request
  → middleware.ts (or proxy.ts)
    → updateSession(request)
      → Refresh Supabase auth cookie
      → Read claims from JWT
      → Apply route protection rules
      → Redirect or continue
```

## Route Protection Rules

### Public Routes (No Auth Required)

```typescript
const PUBLIC_ROUTES = [
  '/',
  '/auth',        // All /auth/* routes
  '/onboarding',  // All /onboarding/* routes
  '/api/health',
  '/api/rpc',     // ORPC endpoint (has its own auth)
  '/api/stripe/webhook',
  // Add marketing pages, blog, etc.
];
```

### Protection Logic

```
1. Is route public? → Continue (no auth check)
2. Is user authenticated?
   NO  → Is route protected? → Redirect to /auth/login?redirect={current_path}
   YES → Is route /auth/*? → Redirect to dashboard (already logged in)
3. Is route /protected/admin/*?
   YES → Is user in ADMIN_USER_IDS? → Continue or redirect to user dashboard
4. Continue
```

### Onboarding Redirect

**CRITICAL RULE**: Never add a DB query to middleware.

- If `onboarding_completed` is a **JWT claim**: middleware CAN check it and redirect to `/onboarding`
- If `onboarding_completed` is NOT in JWT: redirect happens in the login/signup success handler (client-side after ORPC call), NOT in middleware

```typescript
// ONLY if onboarding_completed is in JWT claims:
if (isProtectedRoute && claims.onboarding_completed === false) {
  return NextResponse.redirect(new URL('/onboarding', request.url));
}
```

### Admin Access

Admin status is a JWT claim (`is_admin: boolean`), set by the `custom_access_token_hook` which reads from the `admins` table (no RLS — only service role can manage it).

```typescript
// is_admin comes from JWT claims — ZERO DB queries
// The admins table has NO RLS policies, so users can't self-promote
// Admin access is granted via MCP execute_sql or service role client only

if (request.nextUrl.pathname.startsWith('/protected/admin')) {
  if (claims.is_admin !== true) {
    return NextResponse.redirect(new URL('/protected', request.url));
  }
}
```

**Do NOT hardcode user IDs.** The `admins` table is the single source of truth. To grant/revoke admin:
```sql
-- Grant: via MCP execute_sql or admin client
INSERT INTO public.admins (user_id, granted_by) VALUES ('uuid', 'admin@example.com');
-- Revoke:
DELETE FROM public.admins WHERE user_id = 'uuid';
-- User must re-login for JWT to update (or wait for token refresh)
```

## Session Refresh

The middleware must refresh the Supabase session cookie on every request:

```typescript
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // This refreshes the session cookie
  const { data: { user } } = await supabase.auth.getUser();

  return { response, user };
}
```

## Middleware Matcher

```typescript
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## File Structure

```
webapp/
├── proxy.ts                → Entry point (Next.js 16 `proxy()`), imports updateSession
└── lib/supabase/
    └── proxy.ts            → updateSession function, route protection logic
```


## Performance

| Concern | Solution |
|---------|----------|
| Middleware runs on EVERY request | Matcher excludes static files |
| JWT decode | ~1-2ms, acceptable |
| DB queries | BANNED in middleware — JWT only |
| Session refresh | `getUser()` calls Supabase Auth (~5-10ms, needed for cookie refresh) |

## Done when

- Middleware refreshes session on every matched request
- Protected routes redirect to `/auth/login?redirect=...` when unauthenticated
- Auth routes redirect to dashboard when authenticated
- Admin routes check `is_admin` JWT claim (from `admins` table, no hardcoded IDs)
- Onboarding redirect follows the JWT-only rule
- No DB queries in middleware
- Public routes list is complete
- Matcher excludes static files
