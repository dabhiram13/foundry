# Service Setup Links

Single source of truth for signup URLs, CLI install commands, and login flow per service.

**Core rule:** Claude never creates accounts or logs in on behalf of the user. Claude gives the user a command to run in a **new terminal**, waits for confirmation, then continues.

When `/setup` asks for a service, read this file, surface the signup URL + CLI install + login command, and tell the user to run the login command in a new terminal.

---

## Phrasing template

Every service handoff should use this shape:

> **{Service}**
> 1. If you don't have an account: {signup URL}
> 2. Install the CLI (one-time): `{install command}`
> 3. **Open a new terminal and run:** `{login command}`
> 4. When you see "{expected success marker}", come back here and say `done`.

Never run the login/signup/auth command inside Claude — the interactive prompt breaks the session.

---

## Services

### Supabase

- **Signup:** https://supabase.com/dashboard/sign-up
- **CLI install:** `brew install supabase/tap/supabase` (or `npm install -g supabase`)
- **Login (new terminal):** `supabase login`
- **Success marker:** `You are now logged in. Happy coding!`
- **MCP:** configured in `.mcp.json` as `@supabase/mcp-server-supabase`. Reads `SUPABASE_ACCESS_TOKEN` (https://supabase.com/dashboard/account/tokens) and `SUPABASE_PROJECT_REF` from the environment — export both, then restart the session. Hosted alternative if the user prefers browser OAuth to a token: `claude mcp add --transport http supabase https://mcp.supabase.com/mcp`.
- **Stripe Sync Engine (Dashboard-only):** project → Integrations → Stripe Sync Engine → Enable → paste the Stripe secret key. **Success marker:** `SELECT to_regclass('stripe.customers')` returns non-null.
- **Custom Access Token hook (Dashboard-only):** project → Authentication → Hooks → Customize Access Token (JWT) Claims → Enable → `public.custom_access_token_hook`. **Success marker:** a fresh JWT carries `plan`, `is_admin`, `name`, `avatar_url`, `language`, `onboarding_completed`.

### Stripe

- **Signup:** https://dashboard.stripe.com/register
- **CLI install:** `brew install stripe/stripe-cli/stripe` (or download from https://github.com/stripe/stripe-cli/releases)
- **Login (new terminal):** `stripe login`
- **Success marker:** `> Done! The Stripe CLI is configured for your account`
- Claude will ask for publishable + secret + webhook keys after login.

### Vercel

- **Signup:** https://vercel.com/signup
- **CLI install:** `npm install -g vercel`
- **Login (new terminal):** `vercel login`
- **Success marker:** `> Success! GitHub authentication complete`
- Claude will run `vercel link` next to attach the repo.

### GitHub

- **Signup:** https://github.com/signup
- **CLI install:** `brew install gh` (or https://cli.github.com)
- **Login (new terminal):** `gh auth login`
- **Success marker:** `✓ Logged in as <username>`

### Sentry

- **Signup:** https://sentry.io/signup/
- **CLI install:** `brew install getsentry/tools/sentry-cli` (or `curl -sL https://sentry.io/get-cli/ | bash`)
- **Login (new terminal):** `sentry-cli login`
- **Success marker:** `Stored API token in config`

### Resend (email)

- **Signup:** https://resend.com/signup
- **CLI install:** no CLI — use API key from dashboard
- **Dashboard API keys:** https://resend.com/api-keys
- Claude will ask for the API key once you've generated one.

### PostHog (product analytics)

- **Signup:** https://app.posthog.com/signup
- **CLI install:** no CLI — project API key from dashboard
- **Project keys:** https://app.posthog.com/project/settings

### Clerk (auth alternative)

- **Signup:** https://dashboard.clerk.com/sign-up
- **CLI install:** no CLI — keys from dashboard
- **Dashboard keys:** https://dashboard.clerk.com → create app → API Keys

### OpenAI

- **Signup:** https://platform.openai.com/signup
- **CLI install:** `npm install -g @openai/codex` (optional — API key is enough)
- **Dashboard keys:** https://platform.openai.com/api-keys

### Anthropic

- **Signup:** https://console.anthropic.com/
- **CLI install:** `npm install -g @anthropic-ai/claude-code`
- **Dashboard keys:** https://console.anthropic.com/settings/keys

---

## Services without a CLI (dashboard-only)

For these, Claude will share the signup URL and the direct path to generate the needed key. The user pastes the key back; Claude writes it to the env file.

- **Resend** — dashboard API key
- **PostHog** — dashboard project key
- **Clerk** — dashboard publishable + secret keys
- **Google OAuth** — https://console.cloud.google.com/apis/credentials (always dashboard-only)
- **Apple Sign In** — https://developer.apple.com/account (always dashboard-only)
- **Twilio** — dashboard SID + auth token

---

## What Claude should NEVER do

- Never run `supabase login`, `stripe login`, `vercel login`, `gh auth login`, or any interactive auth flow inside the Claude session — the stdin prompt breaks.
- Never create an account on behalf of the user — always share the signup URL and let the user sign up themselves.
- Never paste the user's secrets into a chat response — write directly to the env file.
- Never commit a `.env` file.
