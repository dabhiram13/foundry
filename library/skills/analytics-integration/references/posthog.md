# PostHog

Use when the product needs real product analytics, funnels, feature flags, or session replay.

## Best Fit

- SaaS products
- multi-step onboarding
- activation and retention analysis
- feature flag rollouts
- session replay / debugging

## Ask First

- Do we need feature flags now?
- Do we need product analytics or just marketing analytics?
- Which business events matter in the first 30 days?

## Start With

- sign_up_started
- sign_up_completed
- onboarding_started
- onboarding_completed
- core_value_action_completed
- checkout_started
- subscription_started

Then go deeper only if the product is already stable.

## Setup Later

Route key collection and verification through `/setup`.
Do not ask for the PostHog key during discovery unless setup starts immediately.

## Existing Assets

- `posthog-analytics`
- `/analytics`
