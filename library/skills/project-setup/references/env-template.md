# .env Template

Generate from this template. Fill known values, comment TODOs for pending.

```env
# ============================================
# Supabase
# ============================================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ============================================
# App
# ============================================
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ============================================
# Resend (Email)
# ============================================
RESEND_API_KEY=

# ============================================
# Cloudflare Turnstile (Captcha)
# ============================================
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# ============================================
# Supabase Auth Hook
# ============================================
SEND_EMAIL_HOOK_SECRET=

# ============================================
# Stripe (if billing)
# ============================================
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=

# ============================================
# Inngest (if background jobs)
# ============================================
# INNGEST_EVENT_KEY=
# INNGEST_SIGNING_KEY=

# ============================================
# Google OAuth (if social login)
# ============================================
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# ============================================
# Additional Tools (from external-tools.md)
# ============================================
# Add tool-specific env vars here
```

## Rules

- Uncomment sections that apply to this project (from external-tools.md)
- Delete sections that don't apply
- `# TODO:` prefix for values user hasn't provided yet
- NEVER commit this file — verify .gitignore first
- Dev uses test keys where available (Turnstile, Stripe)
- Prod values go in Vercel env vars, not this file
