# Lemon Squeezy Subscriptions

## Querying Subscriptions

```bash
# List active subscriptions
lmsq subscriptions list --status active

# Count active subs
lmsq subscriptions list --status active --count

# Get all active IDs
lmsq subscriptions list --status active --only-ids --page-size 100

# Get specific subscription
lmsq subscriptions get 789

# Check status
lmsq subscriptions get 789 --pluck status

# Filter by product, variant, customer
lmsq subscriptions list --product-id 1 --status active --fields status,user_email
```

## Subscription Statuses

| Status | Meaning |
|--------|---------|
| `on_trial` | In free trial period |
| `active` | Paying and active |
| `paused` | Paused by customer or admin |
| `past_due` | Payment failed, in grace period |
| `unpaid` | Multiple payment failures |
| `cancelled` | Canceled, access until period end |
| `expired` | Subscription ended |

## Plan Changes

Switch a subscription to a different variant (plan):

```bash
lmsq subscriptions update 789 --variant-id 2

# Invoice immediately (don't wait for next cycle)
lmsq subscriptions update 789 --variant-id 2 --invoice-immediately

# Disable proration when changing plans
lmsq subscriptions update 789 --variant-id 2 --disable-prorations
```

## Pause / Resume

Two pause modes:
- **`void`**: Customer loses access immediately
- **`free`**: Customer keeps access but isn't charged

```bash
# Pause (lose access)
lmsq subscriptions update 789 --pause void

# Pause (keep access)
lmsq subscriptions update 789 --pause free

# Pause with auto-resume date
lmsq subscriptions update 789 --pause void --pause-resumes-at "2025-03-01T00:00:00Z"

# Resume
lmsq subscriptions update 789 --unpause
```

## Cancellation

Two approaches:
- **End of period**: Customer keeps access until billing period ends
- **Immediate**: Access revoked now

```bash
# Cancel at end of billing period
lmsq subscriptions update 789 --cancelled

# Undo pending cancellation
lmsq subscriptions update 789 --uncancelled

# Cancel immediately
lmsq subscriptions cancel 789
```

## Trials

```bash
# Set trial end date
lmsq subscriptions update 789 --trial-ends-at "2025-04-01T00:00:00Z"

# Skip trial on checkout
lmsq checkouts create --store-id 1 --variant-id 1 --skip-trial
```

## Billing Anchor

Set the day of month for billing:

```bash
# Bill on the 15th of each month
lmsq subscriptions update 789 --billing-anchor 15

# Remove billing anchor
lmsq subscriptions update 789 --billing-anchor 0
```

## Subscription Invoices

```bash
# List invoices for a subscription
lmsq subscription-invoices list --subscription-id 789

# Generate a formatted invoice
lmsq subscription-invoices generate 456 \
  --name "Jane Doe" \
  --address "123 Main St" \
  --city "San Francisco" \
  --state "CA" \
  --zip-code "94102" \
  --country "US"

# Refund a subscription invoice
lmsq subscription-invoices refund 456

# Partial refund (in cents)
lmsq subscription-invoices refund 456 --amount 500
```

## Subscription Items (Usage-Based)

For usage-based products:

```bash
# List subscription items
lmsq subscription-items list --subscription-id 789

# Update quantity
lmsq subscription-items update 123 --quantity 10

# Get current usage in billing period
lmsq subscription-items usage 123

# Create usage record
lmsq usage-records create --subscription-item-id 123 --quantity 50 --action increment
```

## Gotchas

- **`--cancelled` vs `cancel`**: `update --cancelled` cancels at end of billing period (customer keeps access). `cancel` cancels immediately (access revoked now). Big difference.
- **Pause modes matter**: `void` revokes access, `free` keeps it. Choose based on whether you're pausing as a punishment (downgrade) or a courtesy.
- **Proration is on by default**: Plan changes mid-cycle create prorated charges. Use `--disable-prorations` to skip.
- **Invoice immediately**: When switching plans, the charge happens at next renewal by default. Use `--invoice-immediately` to charge now.
- **Billing anchor range**: 1-31. If the month doesn't have that day (e.g., 31st in February), billing happens on the last day of the month.
- **Status transitions**: `on_trial` -> `active` -> `past_due` -> `unpaid` -> `expired` is the typical failure path. `cancelled` and `paused` are separate states.
