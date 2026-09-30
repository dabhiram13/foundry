<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: help
description: Show all available slash commands grouped by purpose. Run this anytime you forget what's available or want a quick tour of the framework surface.
---

# Help

Print the command map below, then stop. No tool calls, no file writes.

---

## Getting started

- **`/start`** — first-session intake. Runs once per project. Writes `.foundry/state/project-started.json` when done.
- **`/skeleton saas`** — clone the Next.js + Supabase + Stripe starter into `webapp/` + `supabase/`.
- **`/setup <service>`** — guided credential and env-var wiring for a single service. Reads `.foundry/docs/setup-links.md` for signup URLs and CLI install commands.

## Build flow

- **`/discover`** — deep product discovery for a new idea (competitors, users, tech reqs, external tools).
- **`/deep-interview`** — multi-turn interview version of `/discover` for fuzzy ideas.
- **`/mvp-spec`** — produce the MVP roadmap from discovery output.
- **`/mvp-build`** — execute the roadmap.
- **`/spec`** — spec one focused feature.
- **`/enhance`** — add or extend a single feature.
- **`/fix-issue`** — targeted bug fix.

## Specialist routers

- **`/design`** — design system, tokens, components.
- **`/landing-design`** — marketing page design.
- **`/logo`** — SVG logo iteration.
- **`/blog`** / **`/seo`** / **`/emails`** / **`/fumadocs`** — content + docs surfaces.
- **`/payments`** — Stripe wiring (products, prices, webhooks, customer portal).
- **`/analytics`** — PostHog / Umami install + event taxonomy.
- **`/sentry`** — error monitoring install + project wiring.

## Quality + shipping

- **`/audit`** — full repo audit (security + performance + dependencies + drift).
- **`/security`** / **`/pentest`** — security-only scan / real exploit validation.
- **`/performance`** — frontend + backend + DB profiling.
- **`/drift`** — pattern-drift detection across features.
- **`/heal`** — read all reports, create a branch, fix, verify, report.
- **`/monitor`** — set up recurring scheduled audits.
- **`/deploy`** — ship to Vercel. (Docker/VPS paths arrive in v0.2.)

## Infra + ops

- **`/domain`** — custom domain + DNS wiring.
- **`/rate-limit`** — rate-limit middleware + per-route tuning.
- **`/schema-sync`** — sync `db-schema.md` with current Supabase state.
- **`/trace`** — analyze agent trajectories, evolve skills.
- **`/settings`** — framework settings surface.

---

## Key file locations

- `AGENTS.md` — project rules (stack, code standards, workspace protocol)
- `.foundry/docs/INDEX.md` — pattern-doc index (backend, frontend, UI, mobile)
- `.foundry/docs/setup-links.md` — signup URLs + CLI install commands per service
- `docs/INDEX.md` — master docs index (stack references + built-feature docs)
- `db-schema.md` — current Supabase schema (tables, RLS, relationships)
- `dev/active/{feature}/` — in-progress work (plan, decisions, context)
- `dev/archive/{feature}/` — completed features

---

## Installing more Claude Code

- Not installed? `npm install -g @anthropic-ai/claude-code`
- Already here? Just type any of:
  - "build a SaaS for dog walkers"
  - "add Stripe to my existing Next app"
  - "audit my repo for security issues"

The orchestrator routes automatically. Prefer to pick the path yourself? Type `/start`.

---

## Docs

- npm package: https://www.npmjs.com/package/buildthisnow
- Source: https://github.com/ZeiProX76/codekit
