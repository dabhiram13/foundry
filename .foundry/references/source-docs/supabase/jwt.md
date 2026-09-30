# JWT — Custom Access Token

`custom_access_token_hook` (`.foundry/migrations/01-base.sql`) runs every time Supabase issues or refreshes a JWT and injects six claims. After that, auth reads are claim reads — zero DB queries.

## Claims

| Claim | Source | Fallback |
|-------|--------|----------|
| `is_admin` | `public.admins` (EXISTS) | `false` |
| `name` | `profiles.display_name` → `profiles.full_name` | `''` |
| `avatar_url` | `profiles.avatar_url` | `''` |
| `plan` | `public.get_user_plan()` — reads `stripe.*`, never `profiles` | `'free'` |
| `language` | `profiles.preferred_language` | `'en'` |
| `onboarding_completed` | `profiles.onboarding_completed` | `false` |

`plan` is the entitlement claim. Absent means `'free'`. Every gate that reads it must fall back to `'free'` — never to a paid tier.

## Decoded Example

```json
{
  "sub": "0f6c2a4e-...", "email": "user@example.com", "role": "authenticated",
  "is_admin": false, "name": "Ada Lovelace", "avatar_url": "https://...",
  "plan": "free", "language": "en", "onboarding_completed": true
}
```

## Reading Claims (Server)

```ts
import { redirect } from "next/navigation";
import { getCachedAuth } from "@/lib/supabase/cached-claims"; // getClaims() in React cache()
import { getName, getPlan } from "@/lib/auth/utils";

const { claims } = await getCachedAuth(); // claims is {} when signed out
if (!claims.sub) redirect("/auth/login");

getPlan(claims);          // "free" | "starter" | "pro" | "lifetime"
claims.is_admin === true; // boolean
```

Readers live in `lib/auth/utils.ts` and are named after the claim they read (`getName` ↔ `name`, `getPlan` ↔ `plan`). **Never add a reader for a claim the hook does not inject** — it returns null forever, and the verify step checks the hook's names, so nothing catches it.

## Refresh

When the underlying data changes (onboarding, profile update, plan change), call `supabase.auth.refreshSession()` — it re-runs the hook and re-issues the claims.

**Full spec**: [auth.md](auth.md) · **Hook SQL**: `.foundry/migrations/01-base.sql` → `custom_access_token_hook`
