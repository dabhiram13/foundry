# Backend Pattern

Opinionated default for this kit:

- Keep the backend boring.
- Supabase owns auth, data, RLS, realtime.
- oRPC owns typed server contracts.
- Stripe side effects happen through Supabase Edge Functions.
- Inngest handles background work, fan-out, and retries.

Judgment: `.foundry/philosophy/trust-boundaries.md`, `entitlement.md`, `data-flow.md`.

## Defaults

- Start from `db-schema.md` before inventing tables.
- Every table gets RLS.
- Never put service-role logic in client code.
- Prefer one clear oRPC procedure over leaky route sprawl.
- Put validation at the boundary with Zod.
- If the flow has retries, idempotency, or async fan-out, move it to Inngest.

## Smells

- Business logic split across client hooks and SQL ad hoc.
- Procedures that return inconsistent shapes.
- New tables without policy thinking.
- Webhook logic mixed directly into UI-oriented code.
- Background work handled by request/response code.

## Read Next

- `.foundry/references/source-docs/patterns/backend/INDEX.md`
- `.foundry/references/source-docs/patterns/backend/orpc.md`
- `.foundry/references/source-docs/patterns/backend/idempotency.md`
- `.foundry/references/source-docs/patterns/backend/inngest.md`
- `.foundry/references/source-docs/supabase/INDEX.md`
