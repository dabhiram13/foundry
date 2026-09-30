# Feature Inventory

Reference checklist for PM. Walk through with user during Phase 1 and Phase 3.

## Universal (always build)

| # | Feature | Scope | Conditional? |
|---|---------|-------|-------------|
| U1 | Landing page | Hero, features, pricing, CTA, footer | No |
| U2 | Auth | Login, signup, password reset, email verify, Turnstile | No |
| U3 | Onboarding | Role selection, profile setup, first-value guidance | No |
| U4 | User profile & settings | Avatar, name, email, password change, preferences | No |
| U5 | Billing | Stripe checkout, subscription mgmt, invoices, portal | Yes — skip if no monetization |
| U6 | Admin dashboard | User mgmt, basic metrics | No |
| U7 | Email system | Transactional via Resend (welcome, verify, reset, receipts) | No |
| U8 | Error pages | 404, 500, maintenance | No |

## Common (ask user: include or skip?)

| # | Feature | Description | Tool Dependency |
|---|---------|-------------|-----------------|
| C1 | Team/org management | Multi-user orgs, member list | — |
| C2 | Invite system | Email invitations | Resend |
| C3 | Role-based access | Beyond admin/user | RLS + JWT claims |
| C4 | File uploads | Images, docs, media | Supabase Storage |
| C5 | Search | Full-text, filters, sort | Supabase pg_trgm or external |
| C6 | In-app notifications | Bell icon, read/unread | Supabase Realtime |
| C7 | Real-time updates | Live data | Supabase Realtime |
| C8 | User-facing analytics | Charts/metrics dashboard | May need charting lib |
| C9 | Export | CSV, PDF generation | Inngest background job |
| C10 | API keys / dev access | Public API | — |
| C11 | Webhooks outbound | Event notifications | Inngest |
| C12 | Dark mode | Toggle or system-preference | — |
| C13 | Mobile responsive | Fully responsive | — |
| C14 | Multi-language / i18n | Multiple languages | next-intl or similar |
| C15 | Changelog / what's new | In-app updates | — |

## Project-Specific (from user)

| # | Feature | Priority | Description | Tool Dependency |
|---|---------|----------|-------------|-----------------|
| P1 | | MVP / V2 / Future | | |
| P2 | | | | |
