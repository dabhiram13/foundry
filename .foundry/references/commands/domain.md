<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: domain
description: Configure the transactional email sender domain and audit the email templates; takes the domain as $ARGUMENTS.
---

# /domain — Configure email sender domain and audit email design

## Input
- `$ARGUMENTS` = the sender domain (e.g. `acme.com`). If empty, ask the user for their domain.

## What this command does

Updates the Supabase `send-email` edge function to use the given domain as the email sender, and audits the email templates to ensure they match the app's design system.

## Steps

### 1. Collect info
- Domain = `$ARGUMENTS` (ask if missing)
- Ask the user for:
  - **Sender name** — the display name in the "From" field (e.g. "Acme"). Default: derive from domain.
  - **Sender email prefix** — the local part before @ (e.g. "hello", "noreply", "team"). Default: "hello".

### 2. Update the "from" field
File: `supabase/functions/send-email/index.ts`

Find the `from:` line in the `sendEmailWithResend` function body (the Resend API call). Update the fallback value:
```
from: Deno.env.get('EMAIL_FROM') || '{SenderName} <{prefix}@{domain}>'
```

### 3. Audit email template colors against app design
Read `webapp/app/globals.css` to extract the current design tokens (`:root` block — the light mode values).

Read `supabase/functions/send-email/templates.ts` and compare `BRAND_COLORS` against the globals.css tokens.

Check alignment for these mappings:
| Email color key | globals.css token |
|----------------|-------------------|
| primary | --primary |
| primaryForeground | --primary-foreground |
| background | --background |
| foreground | --foreground |
| muted | --muted |
| mutedForeground | --muted-foreground |
| border | --border |
| destructive | --destructive |
| success | --success |

Since email clients don't support OKLCH, convert each globals.css OKLCH value to its closest hex equivalent and compare with the current hex values in `BRAND_COLORS`.

**Report mismatches** to the user with a table showing: color key, current hex in email, expected hex from globals.css. Ask if they want to fix them.

### 4. Update brand references in templates
In `supabase/functions/send-email/templates.ts`:
- Replace the current brand name with the new sender name in:
  - `<title>` tag
  - All email copy (headings, body text, alt text)
  - `companyName` default value
  - Subject lines
  - Plain text versions
  - Footer copyright line
- Update the logo `src` URL if the domain changed (ask user for logo URL, or suggest `https://{domain}/icon.png`)
- Update the confirmation URL base domain if it doesn't match the Supabase project (check against `YOUR_SUPABASE_PROJECT_REF.supabase.co`)

### 5. Deploy
Ask the user if they want to deploy the updated edge function now. If yes:
- Use the `mcp__supabase__deploy_edge_function` tool to deploy `send-email`
- Also remind them to set the `EMAIL_FROM` secret in Supabase if they want to override the fallback:
  ```
  supabase secrets set EMAIL_FROM="{SenderName} <{prefix}@{domain}>"
  ```

### 6. Send test email
Ask the user for a **recipient email address** to send a test email to.

Use `curl` to call the Resend API directly (bypasses the webhook signature requirement of the edge function). Read the `RESEND_API_KEY` from `webapp/.env`.

Build the HTML body by rendering the **signup** template with dummy data:
- token: `123456`
- email: the recipient's email
- Use the current `BRAND_COLORS` and brand name (post-update) from `templates.ts`

Since we can't import Deno code in bash, generate the HTML inline in the curl call. Copy the exact base template structure + signup content from `templates.ts`, substituting the current color values and brand name.

```bash
RESEND_API_KEY=$(grep RESEND_API_KEY webapp/.env | cut -d'=' -f2)

curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "{SenderName} <{prefix}@{domain}>",
    "to": ["{recipient_email}"],
    "subject": "[TEST] Welcome to {BrandName} - Verify Your Email",
    "html": "<the full signup template HTML with dummy 123456 token>",
    "text": "Test email from {BrandName}. Verification code: 123456"
  }'
```

Show the Resend API response to the user. If successful, tell them to check their inbox and confirm:
- Email arrived
- Colors and branding look correct
- Layout renders properly

### 7. Summary
Print a summary of all changes made:
- From field updated to: `{SenderName} <{prefix}@{domain}>`
- Brand name updated from X to Y
- Color mismatches found and fixed (or listed for manual review)
- Logo URL updated (if changed)
- Deployment status
- Test email sent to: `{recipient_email}` (success/failure)
