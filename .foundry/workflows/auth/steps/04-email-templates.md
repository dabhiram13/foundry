# Step 4: Email Templates

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

## Goal

Create the `send-email` Edge Function that replaces Supabase's default emails with branded templates via Resend API.

## Pre-read

- Step 1 decisions: which email types are needed
- `docs/project/product-overview.md` — product name for branding
- Design system output: primary color for email branding (convert OKLCH → hex for email compatibility)

## Architecture

```
User triggers auth action (signup, reset, etc.)
  → Supabase Auth fires webhook to send-email Edge Function
  → Function verifies webhook signature (standardwebhooks)
  → Generates branded HTML + text email from templates
  → Sends via Resend API with retry logic
  → Returns success/failure to Supabase Auth
```

## Files to Create

```
supabase/functions/send-email/
├── index.ts        # Main handler: webhook verification, routing, Resend API
├── templates.ts    # HTML + text templates, brand colors, content generators
└── types.ts        # TypeScript interfaces: EmailData, User, WebhookPayload
```

## File: `types.ts`

```typescript
export interface WebhookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
  };
  email_data: EmailData;
}

export interface EmailData {
  token: string;              // OTP code
  token_hash: string;         // For confirmation URLs
  redirect_to: string;
  email_action_type: EmailActionType;
  site_url: string;
  token_new: string;          // For email change
  token_hash_new: string;
  email?: string;
  new_email?: string;
}

export type EmailActionType =
  | 'signup'
  | 'recovery'
  | 'magiclink'
  | 'invite'
  | 'email_change'
  | 'email_change_new'
  | 'reauthentication';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateVariables {
  confirmationUrl: string;
  token: string;
  newToken?: string;
  siteUrl: string;
  email: string;
  newEmail?: string;
  companyName: string;
  year: string;
}
```

## File: `templates.ts`

Key elements:
- `BRAND_COLORS` object — hex values converted from design system OKLCH (email clients don't support OKLCH)
- `getBaseTemplate(variables, content)` — DOCTYPE, head, centered 600px layout, logo, content card, footer
- `emailContents` object — one function per email type returning HTML content
- `subjects` object — subject line per type
- `textContent` object — plain-text fallback per type

### Brand Colors (Convert from Design System)

```typescript
const BRAND_COLORS = {
  primary: '#XXXXXX',     // Convert primary OKLCH → hex
  background: '#FAFBFC',
  foreground: '#1A1F29',
  muted: '#6B7280',
  card: '#FFFFFF',
  destructive: '#DC2626',
  success: '#059669',
};
```

### HTML Template Pattern

```
DOCTYPE + head (charset, viewport)
Body: centered table layout (max 600px)
  → Logo section (product icon or text)
  → Main content card (white background, rounded corners, shadow)
    → [content from emailContents[type](variables)]
  → Footer (copyright, year)
```

### Text Fallback

Always provide. Some email clients block HTML. Keep in sync with HTML content.

## File: `index.ts`

Key logic:
1. Verify webhook signature with `standardwebhooks`
2. Extract `email_data` and `user` from payload
3. Check skip conditions (invited user on signup → skip)
4. Generate template from `emailContents[type]`
5. Send via Resend API with retry logic (3 attempts, exponential backoff)
6. Return success/failure

### Secret Handling

```typescript
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')!;
// Strip prefix before use
const secret = hookSecret.replace('v1,whsec_', '');
```

### Retry Logic

- Max 3 attempts
- Exponential backoff: 1s, 2s, 4s (capped at 10s)
- Non-retryable: 400, 401, 403 (fail immediately)
- Retryable: 429 (rate limit), 5xx (server error)

### Confirmation URL Generation

```typescript
function generateConfirmationURL(emailData: EmailData): string {
  const baseUrl = `https://<project-ref>.supabase.co/auth/v1/verify`;
  const params = new URLSearchParams({
    token: emailData.token_hash,  // token_hash, NOT token
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to,
  });
  return `${baseUrl}?${params.toString()}`;
}
```

**Important**: URL uses `token_hash`. The `token` is the human-readable OTP code displayed in the email.

## Deployment (MANDATORY — do NOT skip)

**ANY agent or subagent that modifies edge function files MUST deploy immediately after.**
This is non-negotiable. The db-architect, backend agent, or whoever touches these files — deploy right after the change. Do NOT defer deployment to a later agent or step.

```bash
cd /path/to/your/project && npx supabase functions deploy send-email --no-verify-jwt --project-ref YOUR_SUPABASE_PROJECT_REF
```

Secrets (set separately, only if not already configured):
```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxx --project-ref YOUR_SUPABASE_PROJECT_REF
npx supabase secrets set SEND_EMAIL_HOOK_SECRET=v1,whsec_xxxxx --project-ref YOUR_SUPABASE_PROJECT_REF
```

## Manual Step (Cannot Be Automated)

**Remind the user**: Enable the Send Email Hook:

> Supabase Dashboard → Authentication → Hooks → Send Email Hook → Enable → Select `send-email` Edge Function

## Done when

- `supabase/functions/send-email/` has index.ts, templates.ts, types.ts
- Templates use product name and brand colors
- All required email types have HTML + text + subject
- Webhook signature verification in place
- Retry logic with exponential backoff
- **Edge function deployed to Supabase** (not "ready for" — actually deployed)
- Hook enabled in Dashboard (user action)
