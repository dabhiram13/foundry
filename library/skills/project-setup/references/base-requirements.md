# Base Requirements

Always needed for every project using the standard stack.

## Env Vars — Always Required

### Supabase
| Var | Source | How to Get |
|-----|--------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API | anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | service_role key (secret) |

### Resend
| Var | Source | How to Get |
|-----|--------|------------|
| `RESEND_API_KEY` | Resend → API Keys | Create key, copy |

### Cloudflare Turnstile
| Var | Source | How to Get |
|-----|--------|------------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → Site | Site key (test: `1x00000000000000000000AA`) |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → Site | Secret key (test: `1x0000000000000000000000000000000AA`) |

### Supabase Auth Hook
| Var | Source | How to Get |
|-----|--------|------------|
| `SEND_EMAIL_HOOK_SECRET` | Supabase → Auth → Hooks | Create send-email hook → generate secret |

### App
| Var | Source | How to Get |
|-----|--------|------------|
| `NEXT_PUBLIC_SITE_URL` | Your domain | `http://localhost:3000` for dev, production URL for prod |

## Env Vars — Conditional

### Stripe (if billing)
| Var | Source |
|-----|--------|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys |

### Inngest (if background jobs)
| Var | Source |
|-----|--------|
| `INNGEST_EVENT_KEY` | Inngest → Events → Keys |
| `INNGEST_SIGNING_KEY` | Inngest → Settings → Signing Key |

### Google OAuth (if social login)
| Var | Source |
|-----|--------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials |

### OpenAI (if AI features)
| Var | Source |
|-----|--------|
| `OPENAI_API_KEY` | OpenAI → API Keys |

### Mux (if video)
| Var | Source |
|-----|--------|
| `MUX_TOKEN_ID` | Mux → Settings → Access Tokens |
| `MUX_TOKEN_SECRET` | Mux → Settings → Access Tokens |

## Manual Steps — Always Required

### 1. Git Repo
- Create repo on GitHub
- `git remote add origin {url}`
- `git add . && git commit -m "initial" && git push -u origin main`

### 2. Supabase Project
- Project should already exist (created during discovery or prior)
- Copy URL + anon key + service role key from Settings → API
- Note the project region for AGENTS.md

### 3. Cloudflare Turnstile
- Go to Cloudflare dashboard → Turnstile
- Add site → enter domain (localhost for dev)
- Widget type: Managed
- Copy site key + secret key
- For dev: use test keys (always pass)

### 4. Supabase Send-Email Hook
- Supabase → Auth → Hooks
- Enable "Send Email" hook
- Type: HTTPS
- URL: `{SUPABASE_URL}/functions/v1/send-email`
- Generate webhook secret → copy as `SEND_EMAIL_HOOK_SECRET`
- Deploy send-email edge function

### 5. OAuth Providers (if needed)
- Google: Cloud Console → APIs → Credentials → OAuth 2.0 Client
  - Authorized redirect: `{SUPABASE_URL}/auth/v1/callback`
  - Copy client ID + secret
  - Supabase → Auth → Providers → Google → paste

### 6. Stripe (if billing)
- Create products + prices matching product-overview.md pricing section tiers
- Create webhook endpoint: `{SITE_URL}/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- Copy webhook signing secret

### 7. Vercel Deployment
- Import git repo in Vercel
- Set framework: Next.js
- Root directory: `webapp/` (if monorepo)
- Add ALL env vars from .env
- Deploy

### 8. Test Users
- Supabase → Auth → Users → Add user
- Create minimum: 1 admin, 1 regular user
- Use real email addresses (for email verification testing)
- Document in `dev/test-users.md`
