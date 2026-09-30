# Webhook And State

A successful redirect is not enough.

Verify:
- webhook or sync path updates local state
- purchase/subscription status becomes visible in the app
- user entitlements/plan reflect the payment
- retries or replay do not duplicate ownership

Look for:
- event receipt
- app state change
- database or entitlement confirmation
