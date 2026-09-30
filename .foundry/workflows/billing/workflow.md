# Billing Workflow

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

End-to-end billing setup: Stripe products, database functions, oRPC procedures, JWT plan detection, and billing page. Works for any SaaS with subscription tiers + optional one-time (lifetime) payments.

**SECURITY PRINCIPLE:** No billing data in `profiles`. Plan is resolved at JWT time via `get_user_plan()` which reads `stripe.*` tables (Sync Engine, read-only). For one-time purchases, use a `purchases` table with SELECT-only RLS + SECURITY DEFINER RPC to insert after payment verification.

## What Already Exists (Prerequisites)

- **Stripe Sync Engine** enabled in the Supabase Dashboard (populates `stripe.*` tables). Turned on by `/setup supabase` Step 4.3 — if that was skipped, stop and do it first. Confirm with `SELECT to_regclass('stripe.customers') IS NOT NULL;` before Step 2 of this workflow: every function in `steps/02-edge-functions.md` reads `stripe.*` and cannot be created without it.
- **Auth workflow** completed (user ID for customer mapping, JWT hook exists)
- **Design-system workflow** completed (card patterns for pricing cards)
- `STRIPE_SECRET_KEY` in env vars
- `webapp/lib/stripe/` — Stripe client singleton
- `webapp/lib/orpc/` — oRPC base, schemas, errors

**Do NOT rebuild these.** Read them. Extend them.

## Inputs

1. `docs/project/product-overview.md` — pricing section: tiers, prices, limits, upgrade triggers
2. `docs/stripe/api.md` + `docs/stripe/database.md` — existing skeleton spec (backend)
3. `docs/stripe/frontend.md` — existing skeleton spec (frontend)
4. `docs/built/design-system.md` — card patterns, tokens

---

## Steps — Checklist

- [ ] **Step 1: Create Stripe Products + Prices** → `steps/01-stripe-products.md`
  Create products and prices in Stripe via API. Map tiers from pricing model.

- [ ] **Step 2: Database Functions** → `steps/02-edge-functions.md`
  Create `_stripe_resolve_customer_id`, `get_user_plan`, `get_my_subscription`, `list_active_products`. Plan reads from `stripe.*` tables — NOT from `profiles`.

- [ ] **Step 3: oRPC Procedures + Hooks** → `steps/03-procedures.md`
  Wire oRPC procedures (calling Stripe SDK directly) + TanStack Query mutation hooks.

- [ ] **Step 4: JWT Plan Detection** → `steps/04-jwt-hook.md`
  Update `custom_access_token_hook` to call `get_user_plan()` which reads `stripe.*` tables. No billing data in profiles.

- [ ] **Step 5: Plan Gating Infrastructure** → `steps/05-plan-gating.md`
  Add `plan` to oRPC context, create `paidProcedure`, shared `<UpgradeWall />` + `<UpgradeDialog />` components, pattern doc for 3 gating strategies.

- [ ] **Step 6: Credit System** → `steps/06-credits.md`
  Credit tables, functions, config, middleware, hook, billing page display.

- [ ] **Step 7: Billing Page** → `steps/07-billing-page.md`
  Build billing page: plan cards, upgrade-only flow, no downgrade buttons.

- [ ] **Step 8: Payment Emails** → `steps/08-payment-emails.md`
  Inngest functions for billing events. Welcome-to-plan + upgrade emails via React Email.

- [ ] **Step 9: Verify** → `steps/09-verify.md`
  Test checkout, upgrade, lifetime, portal, credits, plan gating, emails. Run quality gates.

---

## Required Skills

| Skill | When |
|-------|------|
| `stripe-cli` | Step 1 — product/price creation via CLI |
| `stripe-best-practices` | Steps 1-2 — product structure, checkout patterns |
| `shadcn-ui` | Step 5 — UpgradeWall/UpgradeDialog components |
| `marketing-psychology` | Step 7 — anchoring, decoy effect, pricing psychology |
| `tailwind-design-system` | Step 7 — pricing card design |
| `react-email` | Step 8 — payment confirmation email templates |

## Resume

Read checklist. Skip done steps. Read next pending step.

## References

- `references/how-it-works.md` — Full billing architecture: Sync Engine flow, subscription lifecycle, all triggers needed (refunds, disputes, failed payments), plan gating patterns, new project checklist
- `references/billing-rules.md` — Sync Engine patterns, pricing psychology, banned patterns
- `references/credit-system.md` — Credit system: tables, functions, consume/refund flow, lazy allocation, edge cases, `withCredits()` middleware, `get_user_plan()` variants (subscription-only, one-time-only, hybrid)
- `docs/stripe/` — full Stripe reference (schema, workflows, queries)
- `.foundry/references/source-docs/patterns/billing/plan-gating.md` — 3 plan gating strategies (hard block, soft gate, empty response), decision tree, shared components
