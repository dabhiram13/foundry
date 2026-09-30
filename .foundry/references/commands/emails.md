<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: emails
description: Design and implement lifecycle email sequences for any SaaS. Reads product context, designs drip campaigns (welcome, activation, upgrade, churn, win-back), implements via Inngest + React Email + Resend. Doubles activation rates.
---

# /emails — Lifecycle Email Sequences

Design a complete lifecycle email strategy, then implement it as Inngest functions that send beautiful React Email templates via Resend. Adapts to any SaaS — reads product context, activation moment, billing model, and user journeys.

**Stack:** React Email (design) → Resend (delivery) → Inngest (scheduling + retries)

**Existing infra:**
- `supabase/functions/send-email/` — auth emails (OTP, password reset)
- `webapp/lib/inngest/` — client (`build-app`), API route, function registry
- `RESEND_API_KEY` in `.env`

**Skills to load:** `@../library/skills/react-email/` and `@../library/skills/email-sequence/`

---

## Pre-Flight: Inngest Keys

```bash
grep -q 'INNGEST_EVENT_KEY=' webapp/.env 2>/dev/null && grep 'INNGEST_EVENT_KEY=' webapp/.env | grep -qv '^#' && echo "EVENT_KEY: OK" || echo "EVENT_KEY: MISSING"
grep -q 'INNGEST_SIGNING_KEY=' webapp/.env 2>/dev/null && grep 'INNGEST_SIGNING_KEY=' webapp/.env | grep -qv '^#' && echo "SIGNING_KEY: OK" || echo "SIGNING_KEY: MISSING"
```

**If MISSING**, explain:

> **Inngest** is the background job engine powering email sequences — it handles scheduling (`step.sleep("3d")`), retries (if Resend fails), and state checks (skip emails if user already activated). Serverless cron + workflow engine.
>
> **Local dev needs no keys** — the dev server auto-connects. For **production**:
> 1. **Event Key** — triggers sequences → https://app.inngest.com/env/production/manage/keys
> 2. **Signing Key** — verifies Inngest calls → https://app.inngest.com/env/production/manage/signing-key
>
> Add to `webapp/.env`:
> ```
> INNGEST_EVENT_KEY=your-event-key
> INNGEST_SIGNING_KEY=signkey-prod-xxxxx
> ```
> No account? Free at https://app.inngest.com (50k events/month free tier).

**Do NOT stop** — works locally without keys. Just remind user before deploying.

---

## Phase 1: Product Context

Read these files to design emails that make sense:

```
docs/project/product-overview.md       — what the app does, pricing
docs/project/users-and-journeys.md     — user types, pain points
docs/project/brand-guidelines.md       — name, voice, tone
docs/project/feature-map.md            — key features
docs/built/auth.md                     — signup/login flow
docs/built/onboarding.md              — onboarding steps (if exists)
docs/stripe/frontend.md                — pricing tiers, upgrade flow
webapp/app/globals.css                 — brand colors (convert OKLCH → hex for email)
supabase/functions/send-email/templates.ts — existing email visual style
```

Fallback if `docs/project/` is empty: read `webapp/app/(marketing)/page.tsx` + `docs/built/*.md` + ask user.

Synthesize an **Email Brief**: product name, brand voice, primary value action ("aha moment"), pricing model, top 3-5 features to educate about, upgrade triggers.

---

## Phase 2: Email Sequence Design

Design the full lifecycle strategy using the `email-sequence` skill as reference for sequence types, timing, and copy guidelines. Present ALL sequences before implementing.

### 6 Sequences (adapt timing/content to the product)

| # | Sequence | Trigger | Emails | Span |
|---|----------|---------|--------|------|
| 1 | **Welcome** | `app/user.signed-up` | 4 | 0-7d |
| 2 | **Activation Nudge** | onboarding done + no key action 48h | 1 | +48h |
| 3 | **Feature Education** | active user at day 14 | 3 | 14-28d |
| 4 | **Upgrade Prompt** | `app/user.limit-hit` OR free user day 14 | 3 | 0-5d |
| 5 | **Churn Prevention** | `app/user.inactive` (daily cron) | 3 | 7-30d inactive |
| 6 | **Win-Back** | `app/subscription.cancelled` | 3 | 0-30d |

For each email: subject (<50 chars), goal, delay from previous. Follow the email-sequence skill's copy guidelines (Hook → Context → Value → CTA → Sign-off, short paragraphs, one CTA per email, modern SaaS tone).

**Present the full plan. WAIT for approval before implementing.**

---

## Phase 3: Install React Email

```bash
cd webapp && npm install @react-email/components resend
```

No need for a separate `react-email-starter` project — we use React Email components directly inside the Next.js app and render with `@react-email/components`'s `render()`.

---

## Phase 4: Parallel Email Implementation

This is the core implementation phase. **Spawn 6 subagents in parallel** — one per sequence. Each agent writes 1-4 React Email templates + the Inngest function for its sequence.

### Subagent Context (shared by all)

Each subagent receives:
- The **Email Brief** from Phase 1
- The **approved sequence plan** from Phase 2
- Brand colors (hex values from globals.css)
- Skills: `@../library/skills/react-email/` + `@../library/skills/email-sequence/`

### File Structure

```
webapp/emails/                          — React Email templates
  _components/
    base-layout.tsx                     — shared branded layout (Logo, Container, Footer, unsubscribe)
  welcome/
    welcome-1-getting-started.tsx       — React Email component
    welcome-2-activation-nudge.tsx
    welcome-3-feature-education.tsx
    welcome-4-check-in.tsx
  activation/
    activation-nudge.tsx
  education/
    education-1-feature-a.tsx
    education-2-feature-b.tsx
    education-3-feature-c.tsx
  upgrade/
    upgrade-1-limit-hit.tsx
    upgrade-2-value.tsx
    upgrade-3-offer.tsx
  churn/
    churn-1-miss-you.tsx
    churn-2-data-waiting.tsx
    churn-3-feedback.tsx
  winback/
    winback-1-sorry.tsx
    winback-2-improvements.tsx
    winback-3-offer.tsx

webapp/lib/emails/send.ts              — Resend sending utility (render + send)

webapp/lib/inngest/functions/emails/
  welcome-sequence.ts
  activation-nudge.ts
  feature-education.ts
  upgrade-prompt.ts
  churn-prevention.ts                  — cron detector + per-user sequence
  winback-sequence.ts
```

### Subagent 0: Base Layout + Send Utility (run first)

Creates the shared `_components/base-layout.tsx` using React Email components (`Html`, `Head`, `Preview`, `Body`, `Container`, `Tailwind`, `pixelBasedPreset`). Must match the visual style of `supabase/functions/send-email/templates.ts`. Brand colors from globals.css converted to hex. Includes unsubscribe footer.

Creates `webapp/lib/emails/send.ts`:
```typescript
import { render } from "@react-email/components";
import { Resend } from "resend";
// render(ReactComponent) → html string, then send via Resend
// Also renders plainText version via render(component, { plainText: true })
```

### Subagents 1-5: One per sequence (parallel after agent 0)

Each subagent writes:
1. **React Email templates** — one `.tsx` per email, using the base layout, with typed props and `PreviewProps`
2. **Inngest function** — the sequence orchestration with `step.sleep()`, `step.run()`, activation checks

**Inngest hard rules (every subagent must follow):**
- New Supabase admin client inside each `step.run()` — never reuse across steps
- Pass IDs in events, look up data in steps — lean payloads
- No oRPC from Inngest — direct Supabase admin client only
- Unique step IDs — descriptive names like `send-welcome-1`, `check-activation`
- Check user state between `step.sleep()` calls — skip if already converted
- Use `render()` from `@react-email/components` to convert React → HTML inside `step.run()`

**React Email rules (every subagent must follow):**
- Use `Tailwind` + `pixelBasedPreset` for styling (no rem units)
- No flexbox/grid — use `Row`/`Column` or table layouts
- No SVG/WEBP images — PNG/JPG only
- No media queries (`sm:`, `md:`) — not supported in email clients
- `Button` always needs `box-border` class
- `Hr` always needs explicit border type (`border-solid`)
- Always include `Preview` text (preheader)
- Every email gets `PreviewProps` for testing

### Subagent Assignment

| Agent | Sequence | Emails | Inngest File |
|-------|----------|--------|-------------|
| 0 | Base layout + send utility | `_components/base-layout.tsx` + `lib/emails/send.ts` | — |
| 1 | Welcome (4 emails) | `welcome/*.tsx` | `welcome-sequence.ts` |
| 2 | Activation + Education (4 emails) | `activation/*.tsx` + `education/*.tsx` | `activation-nudge.ts` + `feature-education.ts` |
| 3 | Upgrade (3 emails) | `upgrade/*.tsx` | `upgrade-prompt.ts` |
| 4 | Churn Prevention (3 emails) | `churn/*.tsx` | `churn-prevention.ts` (cron + sequence) |
| 5 | Win-Back (3 emails) | `winback/*.tsx` | `winback-sequence.ts` |

---

## Phase 5: Register + Wire Triggers

### Register all Inngest functions

Update `webapp/lib/inngest/functions/index.ts` to export all new email functions.

### Wire trigger events

Find these locations in the codebase and add `inngest.send()` calls:

| Event | Where to wire | Data |
|-------|--------------|------|
| `app/user.signed-up` | Auth confirm route / signup callback | `{ userId, email, name, signupMethod }` |
| `app/subscription.cancelled` | Stripe webhook / portal handler | `{ userId, email, name, plan, reason }` |
| `app/user.limit-hit` | Plan limit check / `consume_credits` response | `{ userId, email, name, limitType, currentUsage, limit }` |

The churn cron (`0 9 * * *`) auto-triggers — no wiring needed. It queries for inactive users and sends `app/user.inactive` events via `step.sendEvent()`.

---

## Phase 6: Verify & Report

### Quality gates
```bash
cd webapp && npx tsc --noEmit   # Zero type errors
```

### Local test instructions
```bash
# Terminal 1: npm run dev
# Terminal 2: npm run dev:inngest
# Open http://localhost:8288 → send test event:
# { "name": "app/user.signed-up", "data": { "userId": "test-123", "email": "test@example.com", "name": "Test User" } }
```

### Write `docs/built/emails.md`

Document: sequences, triggers, timing, file locations, how to customize.

### Present summary

> **Lifecycle Emails: {count} sequences, {count} emails**
> - React Email templates in `webapp/emails/`
> - Inngest functions in `lib/inngest/functions/emails/`
> - Sending utility in `lib/emails/send.ts`
> - tsc: PASS
>
> **Next:** `npm run dev:inngest` → http://localhost:8288 → send test event

---

## Constraints

- One CTA per email — don't confuse the reader
- Skip emails if user already converted — check state between `step.sleep()` calls
- Subject lines under 50 chars — mobile inbox cutoff
- Respect unsubscribe — check preference before sending
- Brand consistency — match existing auth email visual style
- React Email `render()` for HTML + plainText — no raw HTML strings
