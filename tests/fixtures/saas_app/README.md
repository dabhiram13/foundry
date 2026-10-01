# Briefroom: disposable SaaS journey fixture

This is a small workshop-planning app used to evaluate Marketcraft's checks. It is
**not a production starter** and is never installed into generated products.

The real components are a loopback HTTP server, SQLite persistence, password
hashing, opaque sessions, CSRF checks and per-account ownership. Each account is
one tenant. Plan enablement and outline composition are explicitly deterministic
fakes. Nothing connects to a live payment, AI, mail or identity provider.

The journey is: create account → see a useful empty state → save a brief → encounter
the plan boundary → enable a fake demo plan → recover from a failed outline without
losing credit → save an outline → return after a server restart → sign out and see
a different account's isolated workspace.

The browser suite also aborts each follow-up read after a committed outline. A
visible retry must keep the same operation key until the refreshed result is
displayed, so a display/network error cannot produce a second debit.

Run the API tests:

```sh
python3 -m unittest discover -s tests/fixtures/saas_app -p 'test_*.py' -v
```

Run the full evidence evaluator from the framework root:

```sh
python3 scripts/evaluate_journey.py
```

See [Evaluation](../../../docs/EVALUATION.md) for browser prerequisites, evidence,
acceptance criteria and native-delivery limits. No command automatically installs
dependencies. The evaluator requires permission to bind IPv4 loopback and inspect
its subprocess IDs. It writes local screenshots/traces under `output/playwright/`.

For manual inspection, use an explicit disposable database and port:

```sh
python3 tests/fixtures/saas_app/app.py --db /tmp/marketcraft-demo.sqlite3 --port 0 --fail-first-action
```

The first stdout line reports the local address. Choose a fresh database path for
each isolated exercise. The browser suite creates and removes its own temporary
directory automatically.

## Deliberate limits

- Local plain HTTP; cookies have `HttpOnly` and `SameSite=Strict`, but no `Secure`
  flag because this fixture serves only loopback HTTP.
- No email verification, password recovery, rate limiting, multi-member
  organizations, tenant administrators, production session rotation or external
  identity qualification.
- `POST /api/fixture/plan` intentionally self-enables fake credits once. It must
  never be treated as a real entitlement/webhook implementation.
- `X-Fixture-Drop-Response: once` deliberately loses the initial outline response
  **after** the atomic commit. The client must reuse its idempotency key; a retry
  gets the persisted response without another debit, including after restart.
- The fake provider's in-process transformation occurs inside a short database
  transaction. Do not hold that lock around a real network provider; a real service
  needs durable operation records and provider-specific effect reconciliation.
- The UI renders user text with `textContent`. Traces contain only synthetic test
  credentials and local test data. Do not substitute real credentials in this suite.
- A passing fixture proves these bounded behaviors, not a profitable business,
  native agent delivery, production security or complete accessibility conformance.
