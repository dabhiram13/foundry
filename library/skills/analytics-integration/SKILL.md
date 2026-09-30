---
name: analytics-integration
description: >
  Route analytics work to the right provider and event plan. Use for "analytics", "event tracking",
  "product analytics", "tracking plan", "funnel tracking", "posthog", "datafast", "umami",
  "plausible", or "mixpanel". Good for choosing a provider, defining events, and deciding what
  should be configured now vs later in setup.
---

# Analytics Integration

Choose the analytics path first. Do not jump straight into one vendor.

## When to Use

- The user wants analytics, event tracking, funnels, dashboards, or feature flags.
- The user names a provider like PostHog, DataFast, Umami, Plausible, or Mixpanel.
- The user wants to know what events to track before wiring code.

## Core Rules

1. Start with the product question, not the vendor.
2. Decide what must be tracked now vs what can wait.
3. Ask for API keys or provider credentials later in `/setup`, one service at a time.
4. Prefer one primary analytics provider per project.
5. Track business events first; skip vanity events.

## Decision Tree

- **Default SaaS / product analytics / feature flags / session replay** → `references/posthog.md`
- **Fast product instrumentation with lightweight AI-friendly analytics** → `references/datafast.md`
- **Privacy-first website analytics, minimal product depth** → `references/plausible.md` or `references/umami.md`
- **Enterprise-style event pipelines and analysis** → `references/mixpanel.md`

If the app is still undefined, define the event map first, then pick the provider.

## Standard Workflow

1. Read the current request and determine whether analytics is:
   - website-only
   - product analytics
   - funnel + activation
   - feature flags + experiments
2. Build a minimal event map:
   - acquisition
   - activation
   - engagement
   - revenue
   - retention
3. Pick the provider using the decision tree.
4. If setup is not done, route credential collection to `/setup`.
5. Implement only the minimum useful instrumentation first.

## Output Shape

Always produce:

- chosen provider
- why it fits
- events to add now
- events to defer
- env vars or setup items needed later
- next command

## References

- `references/posthog.md`
- `references/datafast.md`
- `references/plausible.md`
- `references/umami.md`
- `references/mixpanel.md`
