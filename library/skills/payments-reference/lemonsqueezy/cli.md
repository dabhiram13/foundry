# lmsq CLI Reference

`lmsq` is a CLI for the Lemon Squeezy API with 62 operations across 22 resource types. Optimized for AI agents with auto-compact output in non-TTY mode.

## Installation

```bash
npm install -g lmsq
# Or run without installing:
npx lmsq <command>
```

## Authentication

```bash
# Env var (preferred for agents)
export LEMONSQUEEZY_API_KEY=lsq_live_xxxxxxxxxxxx

# Or persistent auth
lmsq auth login --key lsq_live_xxxxxxxxxxxx
lmsq auth status   # verify
lmsq auth logout
```

Resolution: `--api-key` flag > `LEMONSQUEEZY_API_KEY` env > config file.

## Command Patterns

All resources follow consistent CRUD patterns:

```bash
lmsq <resource> list [--store-id <id>] [--filters] [-p <page>] [-s <size>]
lmsq <resource> get <id>
lmsq <resource> create [--required-options] [--optional-options]
lmsq <resource> update <id> [--options]
lmsq <resource> delete <id>
```

## Global Flags

| Flag | Effect |
|------|--------|
| `--json` | Flattened JSON output |
| `-f, --fields a,b` | Return only specific attributes |
| `--api-key <key>` | Override stored API key |
| `--color` / `--no-color` | Force/disable color |

## List Flags

| Flag | Effect |
|------|--------|
| `-p, --page <n>` | Page number (default: 1) |
| `-s, --page-size <n>` | Results per page (default: 5, max: 100) |
| `--only-ids` | One ID per line |
| `--count` | Just total count |
| `--first` | First result only |

## Get Flags

| Flag | Effect |
|------|--------|
| `--pluck <field>` | Return bare value of one field |

## Token Optimization for Agents

Choose the least verbose mode that gets the job done:

```bash
# Single value (~1 token)
lmsq customers get 456 --pluck email

# Count (~3 tokens)
lmsq subscriptions list --status active --count

# IDs only (~5 tokens/resource)
lmsq subscriptions list --status active --only-ids --page-size 100

# Specific fields (~20 tokens/resource)
lmsq orders list --page-size 10 --fields status,total,user_email

# Full attributes (~150 tokens/resource)
lmsq orders list --page-size 10

# JSON (~200 tokens/resource)
lmsq orders get 123 --json

# AVOID: Raw JSON:API (~2000 tokens/resource)
# lmsq orders get 123 --json-raw  <-- only if user explicitly asks
```

## Common Workflows

### Check subscription status
```bash
lmsq subscriptions get 789 --pluck status
```

### Find customer's active subs
```bash
lmsq subscriptions list --user-email user@example.com --status active --fields status,product_name
```

### Create checkout and get URL
```bash
lmsq checkouts create --store-id 1 --variant-id 1 --pluck url
```

### Refund an order
```bash
lmsq orders refund 12345           # full refund
lmsq orders refund 12345 --amount 500  # partial ($5.00)
```

### Subscription lifecycle
```bash
lmsq subscriptions update 789 --pause void       # pause
lmsq subscriptions update 789 --unpause           # resume
lmsq subscriptions update 789 --cancelled          # cancel at period end
lmsq subscriptions update 789 --uncancelled        # undo cancel
lmsq subscriptions cancel 789                      # cancel immediately
```

### License key management
```bash
lmsq licenses activate --key XXXXX --instance-name "server-1"   # no auth
lmsq licenses validate --key XXXXX                                # no auth
lmsq licenses deactivate --key XXXXX --instance-id abc123         # no auth
lmsq license-keys update 456 --activation-limit 5                 # auth required
lmsq license-keys update 456 --activation-limit unlimited
lmsq license-keys update 456 --expires-at never
```

### Discount management
```bash
# Create 20% off code
lmsq discounts create --store-id 1 --name "Launch" --amount 20 \
  --amount-type percent --code LAUNCH20 --duration forever

# Fixed $5 off, limited to 100 uses
lmsq discounts create --store-id 1 --name "Five Off" --amount 500 \
  --amount-type fixed --code FIVEOFF --is-limited-redemptions true \
  --max-redemptions 100

# Delete
lmsq discounts delete 123
```

### Webhook management
```bash
lmsq webhooks create --store-id 1 \
  --url "https://myapp.com/webhook" \
  --secret "whsec_xxx" \
  --events order_created,subscription_created

lmsq webhooks update 123 --events order_created,order_refunded
lmsq webhooks delete 123
```

## Full Resource List

| Resource | Available Actions |
|----------|------------------|
| `auth` | login, logout, status |
| `user` | (show current) |
| `stores` | list, get |
| `customers` | list, get, create, update, archive |
| `products` | list, get |
| `variants` | list, get |
| `prices` | list, get |
| `files` | list, get |
| `orders` | list, get, invoice, refund |
| `order-items` | list, get |
| `subscriptions` | list, get, update, cancel |
| `subscription-invoices` | list, get, generate, refund |
| `subscription-items` | list, get, update, usage |
| `usage-records` | list, get, create |
| `discounts` | list, get, create, delete |
| `discount-redemptions` | list, get |
| `license-keys` | list, get, update |
| `license-key-instances` | list, get |
| `checkouts` | list, get, create |
| `webhooks` | list, get, create, update, delete |
| `affiliates` | list, get |
| `licenses` | activate, validate, deactivate (no auth) |

## Tips

- `--help` on any command shows all options
- Most list commands support `--store-id` to filter by store
- `--include <resources>` for related data: `--include customer,order-items`
- Discount `--amount-type percent`: `20` = 20% off. `--amount-type fixed`: `500` = $5.00 off
- `lmsq <command> --help` for every option on any command
