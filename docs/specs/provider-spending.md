# Provider credentials and spending controls

## Outcome

Process adapters can receive API keys through a per-attempt loopback broker
instead of the caller's environment, and API billing distinguishes
provider-enforced limits, reservations, metered stopping and post-hoc
accounting. Unknown or unbounded paid execution stays refused.

## Scope and authority

This changes `src/runtime/credentials.ts`, `src/runtime/providers.ts` and the
provider guide. Existing billing consent, acknowledgement, reservation,
attempt, elapsed-time, concurrency and cancellation gates are kept. No live
provider account is connected and no paid inference is run; checks use local
fixtures and a loopback upstream.

## Acceptance

- PS-01: Adapters declare credential references by source variable, billing
  modes and delivery. Broker delivery gives the adapter a loopback URL and a
  per-attempt token, injects the real value only toward the declared upstream,
  and revokes the token when the attempt stops. Environment delivery is
  recorded as exposed to the adapter process.
- PS-02: A selected credential that is not set stops the request before a task
  or process starts. Credential-like names passed through `environment` are
  recorded as exposed to the adapter process.
  Values and tokens do not appear in saved tasks, evidence or output.
- PS-03: `usage` events with cumulative totals are recorded while the adapter
  runs. In API billing a report at or above the reservation stops the process
  group and records `budget_exceeded` with unknown final cost, which blocks
  further paid attempts. Outside API billing a reported charge stops the
  provider and records `billing_violation`.
- PS-04: API billing requires usage metering or an owner-attested
  `provider_limit_dollars` no higher than `max_api_dollars`. Each task records
  `spend_control` with the limit marked `owner_attested_not_verified` and
  `hard_dollar_cap: false`.
- PS-05: The provider guide states that `max_api_dollars` is post-hoc unless
  the provider enforces a limit, and that metered stopping can be exceeded by
  delayed reports and in-flight requests.

## Limits

No credential store, account connection or provider limit verification is
added. The broker is not an operating-system sandbox: tools that can read the
caller's files or memory can still reach secrets. Live provider usage reports
and provider-side limits are not qualified by these checks.
