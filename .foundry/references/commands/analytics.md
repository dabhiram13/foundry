<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: analytics
description: Choose the right analytics provider, define the event map, and then implement the first useful instrumentation. Defaults to PostHog for product analytics but can route to other providers.
---

# /analytics — Analytics Setup

This command decides what should be tracked, chooses the provider, and implements only the first useful analytics layer.

Default routing:
- product analytics / funnels / feature flags → PostHog
- lighter founder analytics → DataFast
- privacy-first site analytics → Plausible or Umami
- heavier enterprise analytics → Mixpanel

If no provider is specified, choose one explicitly before implementation.
Do not ask for provider credentials upfront. Route key collection to `/setup` when needed.

---

## Skills to Load

- `analytics-integration` — provider routing + event-map discipline
- `posthog-analytics` — only if PostHog is the chosen provider

---

## Step 0: Pick The Provider

Before implementation, respond with:

> Analytics path:
> - provider: {PostHog | DataFast | Plausible | Umami | Mixpanel}
> - why: {short reason}
> - what we will track now: {top events}
> - what can wait: {deferred events}
> - credentials needed later in `/setup`: {keys / logins}

If the chosen provider is not PostHog, either:
- produce the event map only, or
- implement the provider-specific minimum path if that provider is already wired

If the chosen provider is PostHog, continue below.

---

## PostHog Pre-Flight: Check API Key

```bash
grep -q 'NEXT_PUBLIC_POSTHOG_KEY=phc_' webapp/.env 2>/dev/null && echo "POSTHOG_KEY: OK" || echo "POSTHOG_KEY: MISSING"
```

If missing:

> PostHog is not configured yet.
> Continue with the event map now.
> Collect the key later in `/setup`:
> - `NEXT_PUBLIC_POSTHOG_KEY`
> - `NEXT_PUBLIC_POSTHOG_HOST`

Do not block the analytics plan on missing credentials.

---

## PostHog Pre-Flight: Activate When Keys Exist

The template ships with PostHog guarded behind `if` checks so the app does not break before setup.
Only remove those guards after `/setup` has provided working keys.

**`webapp/instrumentation-client.ts`** — replace the conditional block:
```typescript
// Before (guarded):
if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2026-01-30",
  });
}

// After (direct):
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
});
```

**`webapp/lib/posthog/server.ts`** — remove the null guards. Replace the file with:
```typescript
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const posthog = getPostHogServer();
  posthog.capture({ distinctId, event, properties });
  await posthog.flush();
}

export async function identifyServerUser(
  distinctId: string,
  properties: Record<string, unknown>,
) {
  const posthog = getPostHogServer();
  posthog.identify({ distinctId, properties });
  await posthog.flush();
}
```

Run `npx tsc --noEmit` to verify. Then continue.

---

## PostHog Pre-Flight: MCP Optional

Try calling a PostHog MCP tool (e.g. `dashboards-get-all`). If it fails:

> PostHog MCP is not connected. To add it:
> ```
> npx @posthog/wizard mcp add
> ```
> Then restart Claude Code and re-run `/analytics`.

**Do NOT stop** — proceed with event discovery and implementation. Dashboards can be created later.

---

## Phase 1: Feature Discovery

Spawn 4 agents in parallel to build a complete picture of the app:

### Agent 1: Built Feature Docs
Read ALL files in `docs/built/`:
```bash
ls docs/built/
```
Read each `.md` file. For each, extract:
- Feature name
- Key user actions (signup, create, update, delete, purchase, etc.)
- Funnels / multi-step flows
- Business-critical paths (revenue, activation, retention)

### Agent 2: App Routes
Scan all page routes in the app:
```bash
find webapp/app -name "page.tsx" | sort
```
Categorize each route:
- **Marketing** (`(marketing)/`) — landing, pricing, terms, privacy
- **Auth** (`auth/`) — login, signup, forgot-password, verify
- **Onboarding** (`onboarding/`) — setup flows
- **Protected** (`protected/`) — core app features
- **Other** — docs, setup, etc.

For each protected route, read the page to understand what the user does there.

### Agent 3: Project Context
Read `docs/project/` files (if they exist — they come from `/discover`):
```
docs/project/product-overview.md       — what the app does, pricing, category
docs/project/users-and-journeys.md     — who uses it, pain points, flows
docs/project/feature-map.md            — all features, MVP vs future
docs/project/brand-guidelines.md       — product name, voice
docs/project/technical-requirements.md — tech constraints
```

If `docs/project/` is empty (no `/discover` run), fall back to:
- Read `webapp/app/layout.tsx` metadata for product name/description
- Read `webapp/app/(marketing)/page.tsx` for value propositions
- Read `docs/built/*.md` for feature inventory
- Ask the user: "What does this app do? Who is it for? What's the 'aha moment'?"

Synthesize into a **Product Brief** (dense summary):
- Product name, category, target audience
- Primary value action (the "aha moment")
- Revenue model (subscription, one-time, freemium, credits)
- Key user journeys (signup → activation → engagement → revenue)

### Agent 4: Protected Feature Deep Dive (THE MOST IMPORTANT)

This agent is the difference between generic analytics and analytics that actually tell you what's happening in YOUR app. It goes DEEP into the product — not just routes, but what users DO on each page.

**Step 1: Understand the product**
1. Read `docs/project/feature-map.md` — understand every feature and its status (MVP/shipped/future)
2. Read `docs/project/users-and-journeys.md` — understand who uses the app, their goals, and the expected flows
3. Read `docs/built/*.md` — understand what's already built and how features connect

**Step 2: Trace every protected route to its components**
For EVERY page in `webapp/app/protected/`:
1. Read the `page.tsx` — find which feature component it renders (follow the import)
2. Read that feature component's full source code
3. Read any hooks it uses (look for `use*.ts` imports) — these contain mutations, state changes, API calls
4. Read any server actions it calls (look for `"use server"` imports)
5. Read any oRPC procedures it calls (look for `orpc.*` or `client.*` calls)
6. Map out the component tree if it has sub-components with their own interactions

**Step 3: Identify every user action**
For each component, find every place a user can DO something:
- **Buttons**: onClick handlers — what happens when they click? (submit, toggle, navigate, open modal, download, copy, delete, etc.)
- **Forms**: onSubmit handlers — what data is being submitted? What's the success/error flow?
- **Selections**: onChange handlers on selects, radio groups, tabs, toggles — what state changes?
- **Multi-step flows**: wizards, checklists, steppers — track each step individually with step_name and step_number
- **Search/filter**: debounced inputs, dropdown filters — track the query and result count
- **Modals/dialogs**: what triggers them to open? What actions happen inside them?
- **Mutations**: any `useMutation`, `mutateAsync`, server action call — these are the most important (user changed something)
- **Downloads/exports**: file downloads, copy-to-clipboard, share actions
- **Destructive actions**: delete, cancel, unsubscribe — always track with context

**Step 4: Propose events with rich properties**

Output a table PER protected route:
```
### /protected/{route-name}
Component: `features/{feature}/components/{component}.tsx`
Purpose: {what the user does on this page}

| User Action | Proposed Event | Properties | Priority |
|-------------|---------------|------------|----------|
| {specific action} | {object}_{past_tense_verb} | {contextual properties} | P0/P1/P2 |
```

**Priority rules:**
- **P0**: Revenue actions (checkout, purchase, upgrade), core value actions (the thing users pay for), multi-step completions, activation milestones
- **P1**: Engagement actions (create, edit, search, filter), feature discovery (first time using a feature), settings changes
- **P2**: UI interactions (expand/collapse, tab switch, tooltip hover) — PostHog autocapture often handles these already

**Property rules:**
- ALWAYS include the entity context: which item, which step, which plan, which category
- ALWAYS include identifiers: slugs, IDs, names — so you can break down by specific items
- Include counts where relevant: results_count, items_selected, step_number/total_steps
- Include state transitions: from_status/to_status, old_plan/new_plan
- Keep properties FLAT (no nested objects) and use snake_case

**What makes a GOOD event map:**
- You can reconstruct the user's entire session from the events alone
- Every funnel step has an event (no gaps between "clicked checkout" and "payment confirmed")
- You can answer "which {items} are most popular?" from breakdown properties
- You can answer "where do users drop off?" from sequential events
- You can answer "what do power users do differently?" from engagement events

---

## Phase 2: Event Map

Using the discovery from Phase 1, produce a complete event taxonomy. This is the core output — it determines what gets tracked.

### Event Naming Convention
- Format: `[object]_[action]` in snake_case
- Actions in past tense: `created`, `completed`, `upgraded`, `viewed`
- Be specific: `project_created` not `feature_used`

### Build the Event Map

Organize events by the AARRR framework (Acquisition → Activation → Retention → Revenue → Referral):

```markdown
## Event Map: {Product Name}

### Acquisition (how users find you)
| Event | Properties | Where Tracked | Priority |
|-------|-----------|---------------|----------|
| `page_viewed` | url, referrer, utm_source, utm_medium, utm_campaign | Auto (PostHog) | P0 |
| `landing_cta_clicked` | cta_text, cta_location (hero/pricing/footer) | Client | P0 |
| `signup_form_started` | method (email/google) | Client | P0 |

### Activation (first value moment)
| Event | Properties | Where Tracked | Priority |
|-------|-----------|---------------|----------|
| `user_signed_up` | signup_method, referral_source | Server | P0 |
| `onboarding_started` | | Client | P0 |
| `onboarding_step_completed` | step_name, step_number, total_steps | Client | P0 |
| `onboarding_completed` | duration_seconds, steps_skipped | Client | P0 |
| `first_[key_action]` | {context-specific} | Client/Server | P0 |

### Engagement (daily usage)
{Feature-specific events from discovery — e.g. project_created, report_generated, etc.}

### Revenue (money events)
| Event | Properties | Where Tracked | Priority |
|-------|-----------|---------------|----------|
| `pricing_page_viewed` | current_plan | Client | P0 |
| `checkout_started` | plan, billing_period, price | Client | P0 |
| `subscription_upgraded` | from_plan, to_plan, mrr_change | Server | P0 |
| `subscription_downgraded` | from_plan, to_plan, reason | Server | P1 |
| `subscription_cancelled` | plan, reason, feedback | Server | P0 |

### Retention (coming back)
| Event | Properties | Where Tracked | Priority |
|-------|-----------|---------------|----------|
| `session_started` | days_since_last | Auto | P1 |
| `feature_[x]_used` | context | Client | P1 |

### Referral (growth loops)
| Event | Properties | Where Tracked | Priority |
|-------|-----------|---------------|----------|
| `invite_sent` | invite_method | Client/Server | P1 |
| `referral_link_copied` | | Client | P2 |

### Errors & Friction
| Event | Properties | Where Tracked | Priority |
|-------|-----------|---------------|----------|
| `error_occurred` | error_type, error_message, page | Client | P1 |
| `form_validation_failed` | form_name, field, error | Client | P2 |
```

### Key Funnels to Define

Based on the product, define 3-5 critical funnels:

1. **Signup Funnel**: Landing → CTA Click → Signup Page → Form Submit → Email Verified → Onboarding Complete
2. **Activation Funnel**: Signup → First [key action] → Second [key action] → "Aha Moment"
3. **Revenue Funnel**: Pricing View → Checkout Start → Payment Complete
4. **Feature Funnel**: {product-specific}

### Present for Review

Show the event map + funnels to the user:

> **Analytics Plan for {Product Name}**
>
> {Event Map table}
>
> **Key Funnels:**
> {Funnel definitions}
>
> **Total events:** {count} ({P0 count} critical, {P1 count} important, {P2 count} nice-to-have)
>
> Approve? Or adjust events?

**WAIT for approval before implementing.**

---

## Phase 3: Implement Tracking

After approval, implement the events. Strategy:

### 3A: User Identification

Find where auth state changes happen and add PostHog identify/reset calls.

Look for:
- Login success handler → `posthog.identify(userId, { email, name, plan })`
- Signup success → `posthog.identify(userId, { ... })` + `posthog.capture('user_signed_up', { ... })`
- Logout handler → `posthog.capture('user_logged_out')` + `posthog.reset()`
- OAuth callback → identify after session exchange
- Profile update → `posthog.capture('$set', { $set: { name, avatar_url } })`

Common locations in this template:
```
features/auth/_shared/         — auth actions
app/auth/confirm/route.ts      — OAuth callback
app/protected/layout.tsx       — session provider (good place for identify on mount)
```

**Implementation pattern:**
```typescript
'use client';
import posthog from 'posthog-js';

// On auth state ready:
posthog.identify(user.id, {
  email: user.email,
  name: user.user_metadata?.full_name,
  plan: claims?.plan || 'free',
  created_at: user.created_at,
});
```

### 3B: Marketing Page Events (Client-Side)

Track high-value interactions on public pages:

- **CTA clicks** — hero CTA, pricing CTAs, footer CTA
- **Scroll depth** — 25%, 50%, 75%, 100% on landing page
- **Pricing toggle** — monthly/annual switch
- **Outbound link clicks** — social, docs, external

Create a lightweight analytics utility (NOT a provider or HOC — just functions):

```typescript
// lib/posthog/track.ts
import posthog from 'posthog-js';

export function trackCTA(ctaText: string, location: string) {
  posthog.capture('cta_clicked', { cta_text: ctaText, cta_location: location });
}

export function trackScrollDepth(percentage: number, page: string) {
  posthog.capture('scroll_depth_reached', { percentage, page });
}
```

Add tracking calls directly in the components — inline, no wrappers:
```typescript
<Button onClick={() => { trackCTA('Get Started', 'hero'); router.push('/auth/sign-up'); }}>
  Get Started
</Button>
```

For scroll tracking, add a small `useEffect` in the landing page component:
```typescript
useEffect(() => {
  const thresholds = [25, 50, 75, 100];
  const fired = new Set<number>();

  function onScroll() {
    const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    for (const t of thresholds) {
      if (pct >= t && !fired.has(t)) {
        fired.add(t);
        trackScrollDepth(t, window.location.pathname);
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
```

### 3C: Auth Events

Track the full auth lifecycle. Add captures at the point of success/failure — NOT in the UI components, but in the action handlers or callbacks:

- `user_signed_up` — after successful signup (include method: email/google)
- `user_logged_in` — after successful login
- `user_logged_out` — before reset
- `password_reset_requested` — after requesting reset
- `email_verified` — after OTP verification
- `oauth_started` — when user clicks Google button
- `auth_error` — on any auth failure (include error type)

### 3D: Onboarding Events

If onboarding exists (`app/onboarding/`):

- `onboarding_started` — on mount
- `onboarding_step_completed` — each step (include step_name, step_number)
- `onboarding_completed` — final step (include duration)
- `onboarding_skipped` — if skip is available

### 3E: Feature-Specific Events (The Custom Part)

This is where the discovery pays off. For EACH feature discovered in Phase 1:

1. Read the feature's actual code (components, actions, API procedures)
2. Identify the key user actions (creates, updates, deletes, submits)
3. Add tracking at the success callback or server action level

**Server-side tracking** — use for events that MUST be reliable (revenue, critical conversions):
```typescript
import { trackServerEvent } from '@/lib/posthog/server';

// In an oRPC procedure or server action:
await trackServerEvent(userId, 'subscription_upgraded', {
  from_plan: oldPlan,
  to_plan: newPlan,
  mrr_change: priceDiff,
});
```

**Client-side tracking** — use for UI interactions and engagement:
```typescript
import posthog from 'posthog-js';

posthog.capture('project_created', {
  project_id: result.id,
  template: selectedTemplate,
});
```

### 3F: Purchase Attribution (UTM Tracking)

Most SaaS founders run ads and post content but can't tie revenue back to the source. This step fixes that by capturing UTM parameters on landing, persisting them through auth redirects, and attaching them to every purchase event.

**Step 1: Create `lib/posthog/utm.ts`** — three functions:

```typescript
import posthog from 'posthog-js'

const UTM_STORAGE_KEY = '_ph_utm'
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

// 1. captureUtms() — reads UTM params from URL, stores in localStorage.
//    Only writes when UTMs are present (never overwrites good data with empty visits).
//    Captures initial_referrer + landing_page alongside UTMs.
//    Expires after 30 days.
export function captureUtms(): void { /* ... */ }

// 2. getStoredUtms() — reads back from localStorage. Returns null if expired.
export function getStoredUtms(): UtmData | null { /* ... */ }

// 3. registerUtms() — calls posthog.register() with stored UTMs as super properties
//    (auto-attached to every subsequent event) and posthog.people.set_once()
//    for first-touch attribution on the person profile.
export function registerUtms(): void { /* ... */ }
```

**Step 2: Hook into PostHog init** in `instrumentation-client.ts`:

```typescript
import { captureUtms, registerUtms } from '@/lib/posthog/utm'

if (typeof window !== 'undefined') {
  captureUtms() // Runs immediately — before any redirect can strip UTMs

  const initPostHog = () => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      // ...
      loaded: (ph) => {
        registerUtms() // Register stored UTMs as super properties
        ph.capture('$pageview')
      },
    })
  }
  // ... deferred init as before
}
```

**Step 3: Pass UTMs to Stripe checkout metadata.** In the checkout hook, read `getStoredUtms()` and send `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `initialReferrer`, `landingPage` alongside the checkout request. On the server, write them to `metadata` on the Stripe session. This means attribution is visible in both PostHog and Stripe.

**Step 4: Server-side purchase event.** In the purchase confirmation procedure, read UTMs back from Stripe session metadata and fire a server-side PostHog event:

```typescript
trackServerEvent(userId, 'purchased', {
  kit_slug, tier, purchase_id, stripe_session_id,
  amount_total: session.amount_total,
  currency: session.currency,
  ...utmAttribution, // utm_source, utm_medium, utm_campaign, etc.
})
```

This server event is the source of truth for revenue attribution — it doesn't depend on client JavaScript.

**Why this matters:**
- UTMs survive auth redirects (localStorage persists across navigation)
- `posthog.register()` attaches UTMs to EVERY event automatically — no manual passing
- `posthog.people.set_once()` locks first-touch attribution permanently on the person
- Stripe metadata lets you correlate PostHog and Stripe data
- Server-side event is reliable even if the user's browser blocks PostHog

**PostHog dashboards to create (Phase 4):**
- Purchase funnel broken down by `utm_source` — which channels convert
- Revenue by `utm_campaign` — which campaigns make money
- Buying path (PathsQuery ending at `purchase_confirmed`) — actual user journeys

### 3G: Billing Events

Find billing-related code and add:
- `pricing_page_viewed` — when pricing section/page loads
- `checkout_started` — when user initiates Stripe checkout
- `checkout_completed` — after successful payment (server-side, from webhook or callback)
- `subscription_changed` — plan upgrades/downgrades (server-side)

Look in:
```
app/protected/billing/
features/billing/
supabase/functions/stripe-checkout/
supabase/functions/stripe-portal/
```

### 3H: Error Tracking

Add a global error boundary capture (if not already handled by Sentry):
```typescript
posthog.capture('client_error', {
  error_message: error.message,
  error_stack: error.stack?.slice(0, 500),
  page: window.location.pathname,
});
```

---

## Phase 4: PostHog Dashboards (via MCP)

**Skip this entire phase if PostHog MCP is not connected.** The event map doc is the fallback.

### Create Dashboards

Create 4 dashboards using PostHog MCP tools (`dashboard-create`, `query-run`, `insight-create-from-query`, `add-insight-to-dashboard`):

**1. Acquisition Dashboard**
- Signups by method (daily trend)
- Landing page → signup conversion funnel
- CTA click-through rates by location
- Signup funnel: Visit → CTA → Signup Page → Submit → Verified → Onboarded

**2. Activation Dashboard**
- Onboarding completion rate (trend)
- Time to first key action (distribution)
- Drop-off by onboarding step (funnel)
- Activation rate: % of signups reaching "aha moment" within 7 days

**3. Engagement Dashboard**
- DAU / WAU / MAU (trend)
- Feature usage breakdown (bar chart — which features used most)
- Sessions per user per week (distribution)
- Power users vs casual (cohort: >5 sessions/week vs <2)

**4. Revenue Dashboard**
- Pricing page → checkout → payment funnel
- Upgrades vs downgrades (trend)
- Plan distribution (pie chart)
- Churn events by reason (breakdown)
- MRR approximation (if subscription events have price data)

**5. Product Features Dashboard (from Agent 4 deep dive)**
This dashboard is UNIQUE to the specific app. Built entirely from Agent 4's protected feature deep dive. It answers: "What are users actually doing inside the app?"

Build these insights from Agent 4's discovered events:

- **Core product funnel**: Chain the P0 events from Agent 4 into the app's main value funnel (e.g. browse → select → configure → purchase → use → complete). Every app has one — find it.
- **Per-feature usage trends**: One trend line per major feature's key event — shows which features get used and which are dead
- **Multi-step completion rates**: For any wizard, checklist, onboarding, or setup flow — track completion vs drop-off by step
- **User journey paths**: PathsQuery starting from the app's main entry page (usually the first protected route after login). Shows how users navigate through features.
- **Feature-specific funnels**: If Agent 4 found a multi-step flow within a feature (e.g. create → configure → publish, or browse → detail → action), create a funnel for it
- **Engagement depth**: Use unique user counts on key events to show how many users reach deep engagement (e.g. used 3+ features, completed 5+ actions, returned 3+ times)

This dashboard should have at MINIMUM 3 insights, ideally 5+. It's the most valuable dashboard because it's the only one that's specific to THIS product.

### Dashboard Creation Flow

For EACH dashboard:

1. Create the dashboard:
```
dashboard-create → name, description, tags
```

2. For each insight in the dashboard, build the query and test it:
```
query-run → test the HogQL or event-based query
```

3. Save the insight:
```
insight-create-from-query → name, query, favorited
```

4. Add to dashboard:
```
add-insight-to-dashboard → insightId, dashboardId
```

### Example Queries

**Signup funnel:**
```json
{
  "kind": "InsightVizNode",
  "source": {
    "kind": "FunnelsQuery",
    "series": [
      { "kind": "EventsNode", "event": "$pageview", "name": "Visited Site", "properties": [{"key": "$current_url", "value": "/", "operator": "exact"}] },
      { "kind": "EventsNode", "event": "cta_clicked", "name": "Clicked CTA" },
      { "kind": "EventsNode", "event": "user_signed_up", "name": "Signed Up" },
      { "kind": "EventsNode", "event": "onboarding_completed", "name": "Onboarding Done" }
    ],
    "dateRange": { "date_from": "-30d" }
  }
}
```

**DAU/WAU/MAU:**
```json
{
  "kind": "InsightVizNode",
  "source": {
    "kind": "TrendsQuery",
    "series": [{ "kind": "EventsNode", "event": "$pageview", "math": "dau" }],
    "dateRange": { "date_from": "-90d" },
    "interval": "week"
  }
}
```

**Feature usage breakdown:**
```json
{
  "kind": "InsightVizNode",
  "source": {
    "kind": "TrendsQuery",
    "series": [
      { "kind": "EventsNode", "event": "{feature_1}_used", "name": "{Feature 1}" },
      { "kind": "EventsNode", "event": "{feature_2}_created", "name": "{Feature 2}" }
    ],
    "dateRange": { "date_from": "-30d" },
    "interval": "week"
  }
}
```

Adapt these queries to use the ACTUAL events from the approved event map.

---

## Phase 5: Verify & Report

### Type Check
```bash
cd webapp && npx tsc --noEmit
```
Must pass. Fix any type errors introduced by tracking code.

### Build Check
```bash
cd webapp && npm run build 2>&1 | tail -20
```
Must pass.

### Write Event Map Doc

Write `dev/active/analytics/event-map.md` with the complete event taxonomy from Phase 2.

### Write Built Doc

Write `docs/built/analytics.md`:

```markdown
# Analytics (PostHog)

## Intent

Product analytics via PostHog. Tracks user lifecycle (signup → activation → engagement → revenue → retention) with {N} custom events across {N} features. Client-side via posthog-js (instrumentation-client.ts), server-side via posthog-node.

## Setup

- **Client**: `webapp/instrumentation-client.ts` — auto-initializes with Next.js 15.3+
- **Server**: `webapp/lib/posthog/server.ts` — singleton client, `trackServerEvent()` + `identifyServerUser()`
- **Env**: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

## User Identification

- Identify on login/signup (auth callback + protected layout)
- Reset on logout
- Properties: email, name, plan, created_at

## Event Taxonomy

### Acquisition
{list events}

### Activation
{list events}

### Engagement
{list events}

### Revenue
{list events}

### Retention
{list events}

## Key Funnels

1. **Signup**: {steps}
2. **Activation**: {steps}
3. **Revenue**: {steps}

## Dashboards

{list dashboards created with links, or "PostHog MCP not connected — see event-map.md"}

## Files Modified

{list all files that were changed with what was added}
```

### Present Summary

> **Analytics Implementation Complete**
>
> **Events:** {count} total ({P0} critical, {P1} important, {P2} nice-to-have)
> **Funnels:** {count} defined
> **Dashboards:** {count} created (or "PostHog MCP not connected — run `npx @posthog/wizard mcp add`")
>
> **Files modified:**
> - {list each file and what tracking was added}
>
> **Next steps:**
> 1. Click around the app to generate events
> 2. Check PostHog dashboard: https://us.posthog.com
> 3. Verify user identification works (login → check Persons in PostHog)
> 4. Set up alerts for key metrics (signup rate, activation rate)
>
> tsc: PASS
> build: PASS

---

## Key Constraints

- **Never track PII beyond email/name** — no passwords, tokens, credit cards, addresses
- **Server-side for revenue events** — client-side can be blocked by ad blockers
- **Don't over-track** — P0 events first, P1 if time permits, P2 only if asked
- **No wrapper components or HOCs** — inline `posthog.capture()` calls, keep it simple
- **No useEffect for data fetching** — only for scroll tracking and identify-on-mount
- **Respect the `defaults: '2026-01-30'` config** — PostHog auto-captures pageviews, clicks, sessions
- **Event names in snake_case, past tense** — `project_created` not `createProject`
- **Properties are flat objects** — no nested objects, no arrays (PostHog works best with flat props)
- **If PostHog MCP is not available, skip dashboards** — the event map doc is the fallback
- **GDPR**: PostHog's `person_profiles: 'identified_only'` is set by default via the defaults config

## Error Recovery

- tsc fails → fix type errors from tracking code, re-run
- posthog-js import fails in server component → ensure `'use client'` directive or use `posthog-node` instead
- Events not appearing in PostHog → check API key, check browser console for PostHog debug output
- User not identified → verify identify call runs after auth state is available
- PostHog MCP not connecting → run `npx @posthog/wizard mcp add` and restart Claude Code
