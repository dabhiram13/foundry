---
name: project-setup
description: >
  Environment setup after project discovery. Collects API keys, guides external
  service configuration, writes .env, verifies connections, creates test users.
  Transitions project status from Pending to Ready. Use for "setup project",
  "configure env", "setup environment", "project setup", "get ready to build".
---

# Project Setup

Runs AFTER `/discover`. Reads discovery outputs to build a dynamic checklist of
secrets, manual steps, and verifications. Goal: transition AGENTS.md status from
`Pending` → `Ready`.

**Nothing gets implemented until this skill completes.**

## When to Use

- `docs/project/` exists (discovery done)
- `.env` missing or incomplete
- AGENTS.md status is `Pending` or `Not Started`

## Pre-flight

Read these. Nothing else.

1. `docs/project/external-tools.md` — additional tools beyond stack
2. `docs/project/technical-requirements.md` — locations, security, data model
3. `docs/project/product-overview.md (pricing section)` — does billing exist?
4. `references/base-requirements.md` — always-needed env vars + steps
5. `references/verification-checks.md` — how to verify each service
6. `.foundry/migrations/01-base.sql` … `05-system.sql` — the schema this setup applies (header comments declare each file's prerequisites)

## Execution

### Step 1: Build the Checklist

Merge base requirements + conditional requirements from discovery outputs.

**Base** (every project): see `references/base-requirements.md`

**Conditional** (from `external-tools.md`):
For each tool listed → look up its required env vars and manual steps.
If tool not in base-requirements → ask user for env var names and values.

Present the FULL checklist to the user. Group by service.

### Step 2: Collect Secrets

Ask user for all env vars, grouped by service. Accept:
- Direct paste of keys
- Screenshots of dashboards (extract values)
- "I'll do this later" (mark as pending)

**NEVER store secrets in any file except `.env`.**
**NEVER commit `.env` to git.**

Verify `.gitignore` includes `.env` before writing.

### Step 3: Write .env

Use `references/env-template.md` as base. Fill with collected values.
Add comments for pending values: `# TODO: Get from {service} dashboard`

Write to `webapp/.env`.

### Step 4: Manual Steps Guide

Walk user through each step sequentially. Order matters — some depend on others.

| Order | Step | Service | Depends On |
|-------|------|---------|------------|
| 1 | Create git repo, push initial code | GitHub | Nothing |
| 2 | Create/verify Supabase project, copy keys | Supabase | Nothing |
| 3 | Enable extensions: `pgcrypto`, and `pg_cron` if you want the `05-system.sql` purge job | Supabase | Step 2 |
| 4 | Enable **Stripe Sync Engine** (Dashboard → Integrations → paste Stripe secret key) — creates the `stripe.*` schema `02-billing.sql` reads | Supabase + Stripe | Step 2 |
| 5 | Apply `.foundry/migrations/` `01` → `05` in order, one MCP `apply_migration` call per file. Stop at the first failure | Supabase | Steps 3-4 (`02`/`03` need Step 4) |
| 6 | Enable the **Custom Access Token hook** (Dashboard → Authentication → Hooks → select `public.custom_access_token_hook`) | Supabase | Step 5 |
| 7 | Configure Turnstile for domain | Cloudflare | Domain known |
| 8 | Create send-email auth hook, generate secret | Supabase | Step 2 |
| 9 | Configure OAuth providers | Google/GitHub → Supabase | Step 2 |
| 10 | Create Stripe products/prices | Stripe | product-overview.md pricing section |
| 11 | Set up Stripe webhook endpoint | Stripe | Step 10 |
| 12 | Deploy to Vercel, set all env vars | Vercel | Steps 1-11 |
| 13 | Create test users | Supabase Auth | Step 2 |
| 14 | Configure additional tools | From external-tools.md | Varies |

Steps 4 and 6 are the only two with no CLI or API path — both are Dashboard toggles. Everything else runs from here.

For each step:
- Tell user exactly what to do (service, page, button)
- Tell user what to copy back
- If step is not needed (e.g., no Stripe) → skip and say why

### Step 5: Test Users

Ask user for test user details:
- Email + password for each role (minimum: 1 admin, 1 regular user)
- Store credentials in `dev/test-users.md` (NOT in .env)

Format:
```markdown
# Test Users
| Role | Email | Password | Notes |
|------|-------|----------|-------|
| admin | {email} | {password} | Created via Supabase dashboard |
| user | {email} | {password} | Created via Supabase dashboard |
```

Guide user to create them in Supabase Auth dashboard (or via SQL if preferred).

### Step 6: Verification

Run checks from `references/verification-checks.md`:

1. `.env` exists with all required vars (no TODO remaining)
2. Supabase connection works (use Supabase MCP: `list_tables`)
3. Git repo has remote origin
4. Vercel deployment responds (if deployed)
5. Test users exist (use Supabase MCP: `execute_sql` to check auth.users)
6. Schema matches `.foundry/migrations/` — tables, functions, the `free` allocation row, the `avatars` bucket, and six JWT claims on a fresh token (check 9 in `references/verification-checks.md`)

Report: `PASS` / `FAIL` per check. If any FAIL → tell user what to fix.

### Step 7: Update Project Status

When all checks pass:

1. Update AGENTS.md — set status to `Ready`
2. Write `docs/project/setup-complete.md` with:
   - Date completed
   - Services configured
   - Test users created
   - Env vars present (names only, never values)
   - Verification results

## Status in AGENTS.md

Add this block to AGENTS.md after the Boot Sequence section:

```markdown
## Project Status
- **Phase**: Ready | Pending | Not Started
- **Discovery**: complete | in-progress | not-started
- **Setup**: complete | pending-user | not-started
- **Active Feature**: {name} or none
```

## Post-flight

- [ ] `.env` written with all required vars
- [ ] `.gitignore` includes `.env`
- [ ] All manual steps completed or marked pending with reason
- [ ] Test users created and documented
- [ ] Migrations `01`-`05` applied, or each deferred one named with its reason
- [ ] Custom Access Token hook enabled and returning all six claims
- [ ] Verification checks all PASS
- [ ] AGENTS.md status updated to `Ready`
- [ ] `docs/project/setup-complete.md` written

## Error Recovery

**Fixable:** Missing env var → ask user again. Service not responding → check key format.
**Blocking:** User doesn't have account for required service → pause, tell them to create it.
**Partial:** Some services ready, others not → mark status `Pending`, document what's missing.

## References

- `references/base-requirements.md` — always-needed env vars + steps
- `references/verification-checks.md` — per-service verification
- `references/env-template.md` — .env template
