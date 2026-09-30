# Step 6: Frontend Pages

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Build all auth pages using the PPR pattern, with Turnstile captcha, redirect handling, and proper state management.

## Pre-read

- `references/auth-rules.md` — PPR pattern, file organization, banned patterns
- `docs/built/auth.md` — complete auth reference (procedures, flows, security, JWT claims)
- Design system output: tokens, button variants, card shadows

## Pages to Build

### 1. Login (`/auth/login`)

**Files:**
```
webapp/app/auth/login/page.tsx                              → PPR wrapper
webapp/features/auth/login/components/cached-login-ui.tsx   → "use cache" static shell
webapp/features/auth/login/components/dynamic-login-form.tsx → async server, reads searchParams
webapp/features/auth/login/components/login-form.tsx         → "use client" form
```

**SearchParams:** `redirect?`, `email?` (invitation), `message?` (success message)

**Form fields:** email, password, Turnstile captcha

**Redirect logic:**
1. `validateRedirect(searchParams.redirect)` — block open redirects
2. Priority: `redirectTo` prop > `sessionStorage.redirectAfterLogin` > `/protected`
3. `sessionStorage` for OAuth flows that leave the page

**Links:** "Forgot your password?" → `/auth/forgot-password`, "Sign up" → `/auth/sign-up`

### 2. Sign Up (`/auth/sign-up`)

**Files:**
```
webapp/app/auth/sign-up/page.tsx
webapp/features/auth/sign-up/components/cached-sign-up-ui.tsx
webapp/features/auth/sign-up/components/dynamic-sign-up-form.tsx
webapp/features/auth/sign-up/components/sign-up-form.tsx
```

**SearchParams:** `email?` (invitation), `invitationToken?`

**Form fields:** email, password, repeat password, Turnstile captcha

**Client-side validation:** Password match check before API call

**On success:** Redirect to `/auth/sign-up-success?email={encoded}`

### 3. OTP Verification (`/auth/sign-up-success`)

**Files:**
```
webapp/app/auth/sign-up-success/page.tsx
webapp/features/auth/sign-up-success/components/cached-sign-up-success-ui.tsx
webapp/features/auth/sign-up-success/components/dynamic-sign-up-success.tsx
webapp/features/auth/sign-up-success/components/sign-up-success-content.tsx
```

**Key behaviors:**
- 8-digit OTP input (use `InputOTP` from shadcn if available)
- Auto-submit when all 8 digits entered
- Email from URL params → `localStorage` fallback (page refresh resilience)
- "Resend code" with 60-second cooldown timer
- On success: clear localStorage, redirect to `/onboarding` (or `/protected`)

**Edge cases:**
- No email available → "Session Expired" card + link to sign up again
- Wrong OTP → error displayed, input cleared, can retry
- Double-submit guard (`isVerifyingRef`)

### 4. Forgot Password (`/auth/forgot-password`)

**Files:**
```
webapp/app/auth/forgot-password/page.tsx                        → static rendering (no PPR needed)
webapp/features/auth/forgot-password/components/forgot-password-form.tsx → "use client"
```

**Form fields:** email only

**After submit:** Toggle to "Check Your Email" confirmation card (no redirect)

**Always returns success** — anti-enumeration

### 5. Update Password (`/auth/update-password`)

**Files:**
```
webapp/app/auth/update-password/page.tsx
webapp/features/auth/update-password/components/update-password-form.tsx
```

**How user arrives:** Clicks link in password reset email → Supabase sets recovery session via URL token

**Form fields:** new password only

**On success:** Redirect to `/protected`

### 6. Error Page (`/auth/error`)

**File:** `webapp/app/auth/error/page.tsx`

**SearchParams:** `error?` (error code from Supabase auth redirects)

**Shows:** "Sorry, something went wrong." + error code if present

## Shared Components

### AuthButton (Server Component)

`webapp/features/_shared/components/auth-button.tsx`

- Async server component — wrap in `<Suspense>`
- Calls `getClaims()` to check session
- Authenticated: shows user name/email + LogoutButton
- Unauthenticated: Sign in + Sign up buttons

### LogoutButton (Client Component)

`webapp/features/_shared/components/logout-button.tsx`

- Calls `orpc.auth.signOut()`
- `router.push('/auth/login')` + `router.refresh()`

### Turnstile (Client Component)

`webapp/features/_shared/components/turnstile.tsx`

- Wraps `@marsidev/react-turnstile`
- Requires `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Returns `null` if key not set (dev convenience)

### validateRedirect

`webapp/features/_shared/utils/index.ts`

```typescript
export function validateRedirect(redirect?: string): string | undefined {
  if (!redirect) return undefined;
  // Only allow /relative paths
  if (redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return undefined;
}
```

## PPR Pattern (For Every Auth Page)

```tsx
// page.tsx
export default async function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense fallback={<CachedLoginUI />}>
      <DynamicLoginForm searchParams={searchParams} />
    </Suspense>
  );
}
```

```tsx
// cached-login-ui.tsx
"use cache";
import { cacheLife } from "next/dist/server/use-cache/cache-life";
export function CachedLoginUI() {
  cacheLife("weeks");
  return <LoginForm />; // No props = static shell
}
```

```tsx
// dynamic-login-form.tsx
export async function DynamicLoginForm({ searchParams }: { searchParams: Promise<...> }) {
  const params = await searchParams;
  const redirectTo = validateRedirect(params.redirect);
  return <LoginForm redirectTo={redirectTo} email={params.email} message={params.message} />;
}
```

## Design Style — Auth Pages

### Layout: Logo + Centered Content (ALL auth pages)

Every auth page (`/auth/login`, `/auth/sign-up`, `/auth/sign-up-success`, `/onboarding`) follows the same vertical layout:

1. **Company logo** — centered horizontally, at the top of the content area
   - Use the same SVG logo from `webapp/features/marketing/components/header.tsx`
   - Standalone (no brand name text next to it on auth pages — just the logo mark)
   - Size: `w-10 h-10` on mobile, `w-12 h-12` on desktop
   - Subtle shadow: `shadow-md shadow-primary/15`
2. **Heading text** — centered below the logo
   - Page title (e.g., "Welcome back", "Create your account", "Check your email", "Set up your account")
   - Optional subtitle in `text-muted-foreground`
3. **Form card** — centered below the heading

```
          [Logo]
       Welcome back
   Sign in to your account

   ┌──────────────────────┐
   │  Email               │
   │  Password            │
   │  [Sign in]           │
   └──────────────────────┘
```

### Mobile: No Card — Full-Page Content

On mobile (`<640px`), auth forms render directly on the page background — no card wrapper, no border, no shadow. The logo, heading, and fields fill the screen naturally.

On `sm:` and up, content sits inside a card: `sm:rounded-3xl sm:shadow-xl sm:border sm:border-border sm:bg-card`.

```
/* Mobile: plain page */        /* Desktop: floating card */
[Logo]                          ┌─────────────────────┐
Welcome back                    │  [Logo]              │
Sign in to your account         │  Welcome back        │
                                │  Sign in to account  │
Email: [___________]            │                      │
Password: [________]            │  Email: [_________]  │
[Sign in]                       │  Password: [______]  │
                                │  [Sign in]           │
                                └─────────────────────┘
```

### Card (Desktop Only)

- `sm:shadow-xl` + `sm:border sm:border-border` + `sm:bg-card`
- `sm:rounded-3xl`
- `sm:max-w-md mx-auto` — never wider than 448px, centered
- Outer wrapper: `p-0 sm:p-6` (no padding on mobile, breathing room on desktop)

### Inputs

- `focus:ring-2 focus:ring-ring` — primary color family for focus state
- `bg-muted/50` or `bg-input` for input background

### CTA Button

- Primary gradient (`bg-gradient-to-br from-primary-gradient-from to-primary-gradient-to`)
- Plain `shadow` default, `shadow-md` on hover
- Full width in auth forms

### Responsiveness

- **Mobile (375px):** Logo + heading + card stack vertically, full-width card with `px-6 py-8` padding, generous touch targets (min `h-12` on inputs and buttons)
- **Tablet (768px):** Card floats centered with `max-w-md`, more vertical breathing room (`py-10`)
- **Desktop (1280px):** Same as tablet but with `min-h-screen flex items-center justify-center` to vertically center the entire content block

### Overall Feel

Clean, airy, floating card on a white/neutral background. Primary color appears as accents (gradient tint on card, focus rings, CTA button) — not as fills everywhere. The logo grounds the page to the brand. The header on login/signup connects the auth flow to the marketing site.

## Delegation

Use `designer` for component implementation:
- Provide: page specs, PPR pattern, component structure, form fields, design style above
- Agent builds responsive, accessible forms using design system tokens

## Done when

- All 6 auth routes exist and render
- PPR pattern on login, signup, OTP pages
- Turnstile on login, signup, forgot password
- Redirect validation on login page
- OTP auto-submit + resend cooldown
- Shared components: AuthButton, LogoutButton, Turnstile
- `npx tsc --noEmit` passes
- Forms use design system tokens (no raw colors)
