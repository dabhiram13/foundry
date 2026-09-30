<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: setup
description: Guided environment and service setup after discovery. Collect API keys and service credentials at the right time, write env vars safely, and verify the project is ready to build.
---

# Project Setup

This command runs after discovery, or whenever service wiring and credentials are the current blocker.

Do not ask for every API key upfront.
Ask for credentials only when the setup flow reaches the service that needs them.

Arguments: `$ARGUMENTS`
- No args = run the normal setup flow
- `--resume` = continue from existing setup notes/checklist
- `<service>` or `--service <service>` = focus on one service only. A bare first word that names a service (`/setup supabase`, `/setup stripe`) is that service — this is the form `/skeleton` and `/help` hand the user.
- `/setup supabase` includes provisioning: project creation, extensions, migrations `01`-`05`, and the Custom Access Token hook (Step 4).

---

## Purpose

Setup owns:
- account and service checklist
- env var collection
- safe `.env` writing
- connection verification
- test-user setup where needed

Setup does **not** own:
- full discovery
- feature planning
- code implementation

---

## Complexity Warning

If the project came from `/discover`, tell the user this up front:

> Discovery is the complex research phase.
> Setup is the credential and wiring phase.
> Depending on the external tools we selected, we may need several API keys or service logins.
> I will ask for them only when each service is actually needed.

Never demand a giant dump of secrets at the start.

---

## Read First

Read these before asking anything:
1. `.foundry/docs/setup-links.md` — signup URLs + CLI install + login commands per service (always read this first)
2. `.foundry/migrations/` — the schema this command applies: `01-base.sql` (profiles, admins, credits, JWT hook), `02-billing.sql` (plan resolution + credit system), `03-subscriptions-security.sql` (billing-column removal + hook update), `04-storage.sql` (avatars bucket), `05-system.sql` (email error log). Read each file's header comment before applying it — they declare their own prerequisites.
3. `docs/project/external-tools.md` if it exists
4. `docs/project/technical-requirements.md` if it exists
5. `docs/project/product-overview.md` if it exists
6. `library/skills/project-setup/references/base-requirements.md`
7. `library/skills/project-setup/references/verification-checks.md`
8. `webapp/.env.example` if it exists

If the project docs do not exist, setup can still run for base services using `setup-links.md` as the service directory.

---

## Core Rules

- **CLI/MCP-first — never send the user to a dashboard if a tool can do the job.**
- Collect secrets grouped by service
- Write secrets only to `.env`-style files
- Never commit `.env`
- Verify each service after configuration
- If a key is missing, mark it pending and continue where possible
- Prefer exact signup/dashboard URLs when asking for keys

## CLI / MCP Routing (before asking a human to click anything)

For each service, try this order:

| Service | First choice | Fallback | Last resort |
|---------|-------------|----------|-------------|
| Supabase | `supabase` MCP (`.mcp.json`) → create project, push migrations, read secrets | `npx supabase@latest` CLI (login, projects create, db push) | Dashboard |
| Stripe | `stripe-cli` skill (`stripe products create`, `stripe prices create`, `stripe webhook_endpoints create`, `stripe listen` for local webhook) | Stripe API via curl | Dashboard |
| Sentry | `sentry-cli` skill (create project, fetch DSN, upload sourcemaps) | Sentry API via curl | Dashboard |
| Vercel | `develop-and-deploy` skill, `references/vercel-cli/` (`vercel link`, `vercel env add`, `vercel deploy`) | Dashboard | — |
| PostHog / Umami | CLI or copy-paste install snippet | Dashboard | — |
| Resend | API call via curl (create domain, verify DNS) | Dashboard | — |

Only ask the user to touch a dashboard when:
- The service genuinely has no CLI/API path (Google OAuth client ID is the classic one)
- DNS changes on their registrar (Resend domain, custom domains)
- Billing/plan selection that requires a human decision
- Supabase Integrations that are toggles, not resources — the **Stripe Sync Engine** and the **Custom Access Token hook** have no CLI or API path at all (both are Step 4)

When a CLI path exists, run it. When a key is the only missing input, ask for just that one key. Never dump a 10-field form at the user up front.

---

## Output Files

Always create `dev/active/setup/` if it does not exist.

Write:
- `dev/active/setup/checklist.md`
- `dev/active/setup/status.md`

If setup completes, also write:
- `docs/project/setup-complete.md`

---

## Step 1: Build The Checklist

Merge:
- base stack requirements
- external tool requirements from discovery

Group by service:
- GitHub
- Supabase
- Stripe
- Vercel
- Resend
- external tools from discovery

For each group include:
- why it is needed
- which env vars are required
- exact URL to get the key or complete the login
- whether it is blocking now or can wait

---

## Step 2: Present The Setup Plan

Respond in this shape:

> Setup plan ready.
>
> Services:
> - ...
>
> Blocking now:
> - ...
>
> Can wait:
> - ...
>
> I will ask for credentials one service at a time and verify each one before moving on.
>
> Proceed? Yes or no.

Wait for confirmation.

---

## Step 3: Collect Credentials At The Point Of Use

Work sequentially by service. Use the `setup-links.md` phrasing template for every handoff.

**Core rule — new terminal:**
- Never run `supabase login`, `stripe login`, `vercel login`, `gh auth login`, or any interactive auth command inside the Claude session. The stdin prompt breaks.
- Tell the user: **"Open a new terminal and run: `<command>`"** then wait for them to say `done`.
- Never create an account on the user's behalf. Always share the signup URL from `setup-links.md`.

For each service:
1. Read the service block from `.foundry/docs/setup-links.md`
2. Surface: signup URL (if not logged in) + CLI install command + login command ("in a new terminal")
3. Wait for the user to confirm login
4. Collect only the keys that can't come from the CLI (e.g. webhook secrets, project IDs)
5. Write/update the correct env file
6. Verify immediately
7. Mark pass/fail/pending in `dev/active/setup/status.md`

If the user says "later":
- Write a TODO line
- Keep moving if the service is not currently blocking

**Edge function secrets.** `supabase/functions/` ships with the skeleton. Each function reads its own secrets, so set them per function (`npx supabase@latest secrets set NAME=value`, or the MCP). Names only — never paste a value into a file that is not `.env`:

| Function | `verify_jwt` | Secrets it reads |
|---|---|---|
| `send-email` | false | `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `EMAIL_FROM` |
| `stripe-checkout` | false | `STRIPE_SECRET_KEY` |
| `stripe-portal` | false | `STRIPE_SECRET_KEY` |
| `stripe-upgrade` | false | `STRIPE_SECRET_KEY` |

---

## Step 4: Provision The Database (Supabase)

Runs when the service is Supabase, and as part of the full flow. Skip it only if the user says the schema already exists — then verify instead (Step 5).

**4.1 — Project and MCP.** Prefer the `supabase` MCP server declared in `.mcp.json`. It reads two environment variables and holds no secret itself:

- `SUPABASE_ACCESS_TOKEN` — a personal access token from https://supabase.com/dashboard/account/tokens
- `SUPABASE_PROJECT_REF` — the project ref

Ask the user to export both in the terminal they launch Claude from, then restart the session so the server picks them up. If the user has no project yet: create it (MCP, or `npx supabase@latest projects create`), then replace `YOUR_SUPABASE_PROJECT_REF` in `AGENTS.md` line 3 with the real ref. Never run `supabase login` in-session (see Core Rules). Alternative transport, if the user prefers OAuth in a browser over a token: `claude mcp add --transport http supabase https://mcp.supabase.com/mcp` — use one or the other, not both.

Write-capable MCP is what makes `apply_migration` possible. Once provisioning is done, the user can add `--read-only` to the server's args in `.mcp.json`.

**4.2 — Extensions.** Before any migration:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() in 01, 02, 05
CREATE EXTENSION IF NOT EXISTS pg_cron;    -- optional; 05-system.sql skips its purge job when absent
```

Do not enable `pgjwt` — it is gone from current Supabase Postgres and nothing here needs it.

**4.3 — Stripe Sync Engine gate.** `02-billing.sql` reads `stripe.customers`, `stripe.subscriptions`, `stripe.products`, `stripe.prices`, `stripe.checkout_sessions` and `stripe.checkout_session_line_items`. None of them exist until the Sync Engine is on, and it is Dashboard-only:

> **Stripe Sync Engine**
> 1. Open your project: `https://supabase.com/dashboard/project/<ref>/integrations`
> 2. Find **Stripe Sync Engine** → Enable → paste your Stripe **secret** key (`sk_test_…` while testing)
> 3. Wait for the first sync to finish.
> 4. Come back here and say `done`.

Verify rather than trust the `done`:

```sql
SELECT to_regclass('stripe.customers') IS NOT NULL AS sync_engine_ready;
```

**4.4 — Apply the migrations, in order.** One `apply_migration` call per file, `name` = the file's stem, `query` = the file's contents, read from `.foundry/migrations/`. Stop at the first failure and report the SQL error verbatim — never continue past a failed migration.

| # | File | Depends on | Apply when |
|---|------|-----------|-----------|
| 1 | `01-base.sql` | nothing | always |
| 2 | `02-billing.sql` | 01 + `stripe.*` | only after 4.3 verifies |
| 3 | `03-subscriptions-security.sql` | 01 + 02 | only after 02 |
| 4 | `04-storage.sql` | nothing | always |
| 5 | `05-system.sql` | nothing | always |

If 4.3 fails or the user defers Stripe: apply `01`, `04`, `05` now, record `02` and `03` in `dev/active/setup/status.md` as **pending — blocked on Stripe Sync Engine**, and say so out loud. In that state the JWT hook falls back to `plan = 'free'` (`01-base.sql`) — the app runs, billing does not.

**4.5 — Enable the Custom Access Token hook.** The migrations create `public.custom_access_token_hook` and grant it to `supabase_auth_admin`, but Auth does not call it until it is switched on, and there is no CLI for that:

> **Custom Access Token hook**
> 1. `https://supabase.com/dashboard/project/<ref>/auth/hooks`
> 2. **Customize Access Token (JWT) Claims** → Enable → select `public.custom_access_token_hook`
> 3. Say `done`.

**4.6 — Report.** Write the applied list, the deferred list, and the reason for each deferral to `dev/active/setup/status.md`.

---

## Step 5: Verification

After each service, run only the relevant verification check.

Examples:
- Supabase — connection, then schema:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename IN ('profiles','admins','credits','credit_allocations','credit_balances','credit_ledger','system_email_errors');
  SELECT proname FROM pg_proc WHERE proname IN
    ('handle_new_user','update_updated_at','custom_access_token_hook','get_user_plan','consume_credits','refund_credits');
  SELECT plan, credit_type, allocation, period FROM public.credit_allocations ORDER BY plan;  -- 'free' must be present
  SELECT id FROM storage.buckets WHERE id = 'avatars';
  ```
  Then sign in as a test user and confirm the six JWT claims — the same check as `.foundry/workflows/auth/steps/08-verify.md`. A `plan` claim of `"free"` with no Stripe subscription is the pass condition.
- Stripe: verify keys present and mode understood
- Vercel: verify login/link state if used
- external API: verify key format or minimal connectivity

At the end, summarize:
- ready
- pending keys
- blockers
- next recommended command

---

## Step 6: Handoff

If setup is complete:

> Setup complete.
>
> Next:
> - `/mvp-spec` if discovery is complete and you want the roadmap
> - `/spec` if you are building one focused feature now

If setup is partial:

> Setup is partially complete.
>
> Blocking items:
> - ...
>
> Once those are done, continue with the recommended build flow.

---

## Success Criteria

Setup is successful when:
- required services are clearly grouped
- the user is not asked for unnecessary keys too early
- env vars are written safely
- each configured service is verified
- the project can proceed without setup confusion
- the schema exists and matches `.foundry/migrations/` — or the missing pieces are named, with the reason, in `dev/active/setup/status.md`
- the Custom Access Token hook is enabled and a fresh JWT carries all six claims
