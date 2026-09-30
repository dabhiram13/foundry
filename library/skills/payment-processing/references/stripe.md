# Stripe

Use Stripe when:
- billing is deeply integrated into the app
- custom checkout and portal logic matter
- the product already uses the current Stripe/Supabase billing stack
- subscriptions, upgrades, downgrades, and admin controls need depth

Best fit here:
- if the product already uses Stripe, extend its existing integration
- strong docs and app code already exist
- custom server-side flows are a better fit than simple hosted sales

Setup later:
- secret key
- publishable key
- webhook / sync state
- product and price IDs

Existing assets:
- `docs/stripe/`
- `stripe-cli`
- built billing docs and flows
