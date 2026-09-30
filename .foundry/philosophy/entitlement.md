# An absent claim is a denied claim, and money never moves in silence

**Goal.** Paying users get exactly what they paid for. Everyone else sees a path to paying — never an error. Every movement of money, in or out, has a receipt and a reversal.

**Reasoning.** Two failures bracket this. On one side, the fail-open gate: two files defaulted an unknown plan to a paid tier while four defaulted to the lowest, and the paid tier was the one with a credit allocation — so the wrong default *granted* and the right default *blocked*. On the other side, the error-first paywall: server-side rejections were built first, free users met them as "Failed to save" toasts and blank pages, and the whole gating layer was rebuilt as upgrade walls — 30 minutes of rework, and a product that looked broken meanwhile. The judgment: **entitlement defaults to the least privilege that exists and refuses if none does; the free experience is designed first and is a demonstration, not a wall of errors; money is state that must be confirmed, refunded on failure, and revoked on reversal.**

**Priority.**
1. Never over-grant. When the plan cannot be resolved, resolve to the lowest tier that exists — that *is* the denial for entitlement: the user keeps the product and gains no paid privilege. When no lowest tier exists, refuse the operation. (Authorization — admin, ownership — denies access outright; see `trust-boundaries`.) If the same fallback appears in two files, one of them is wrong.
2. For anything that costs money, freshness beats speed: resolve the plan live at the moment of consumption, not from a cached claim that may be an hour stale. For rendering, the cached claim is fine.
3. A failed action costs nothing. Debit, run, refund on failure — atomically, under a row lock, once.
4. The upgrade moment is a marketing moment. A free user sees the gated action, tries it, and meets an offer — not a hidden button, not an error state, not an empty page pretending nothing exists.
5. Money that goes back means access that goes back. A refund, a dispute, a failed renewal changes entitlement without a human remembering to.

**Good.**
- A write free users must not perform is refused at the procedure with a clear status; the client turns that status into an upgrade dialog, not a red toast.
- A read with a preview returns the rows the free user may see plus a flag; the client renders the rest as a locked preview. The server decides what is visible — never the client.
- A wholly paid page returns empty data plus the flag; the page replaces its body with an upgrade wall. A genuine failure (network, database) is a separate path with a retry, never confused with the paywall.
- A purchase confirms by polling the provider, refreshes the claims, then redirects — the user never lands on a page that still believes they are free.
- Every successful payment emits an event that sends a confirmation. Every consumption writes a ledger row, and the ledger is append-only.

**Counterexamples.**
- `claims.plan ?? 'starter'` where `starter` is paid. The fail-open default that granted ten generations a day to an unresolved plan.
- Gating a preview read with a hard refusal — killing the preview the strategy existed to show.
- Hiding the gated button behind a client-side plan check: no attempt, no offer, no conversion.
- Trusting a client-supplied tier when the product's metadata is missing — tier escalation through a cheap price.
- "Something went wrong" on a paywall. The message was "this is a paid feature", and the user heard "this is broken".

**Evidence.** For every gated procedure and page, exercise the free path and the paid path and record what each sees: status, flag, rendered state. Exercise an unresolvable plan (no customer, no subscription) and confirm it resolves to the lowest tier or refuses. For anything that debits: exercise a failure after the debit and confirm the refund row; fire two first-use requests in parallel and confirm a single allocation row. Confirm the receipt event fires on a successful payment. Then, per gated action:
- Entitlement is answered before existence. Call the paid action as a free user with an id that does not exist: the answer is 403 from the middleware before the handler reads anything (`webapp/lib/orpc/base.ts:202-203`), never 404 — a 404 there tells a free user which ids are real. Record the pair: free caller + missing id → 403; paid caller + missing id → 404.
- The free user learns the gate before spending a click. Record what the control looks like to a free user before the request — the affordance is legible (`aria-disabled` plus a tooltip on hover **and** focus, or a plan badge where a tooltip cannot fire), and the server is still the gate that refuses.
- Anything not exercised is UNKNOWN.
