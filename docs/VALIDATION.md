# Validation

Verified for the initial 0.1.0 release, September 29, 2026 local time (September 30
UTC). Presence of a catalog entry is not evidence that every optional provider
integration has run.

| Check | Observed result |
|---|---|
| Runtime and hook contracts | 18 tests passed: installation/update preservation, Git roots, symlink/path boundaries, one coordinator, pause/resume, receipt freshness/tampering, real native patch payloads and staged-index scanning. |
| Independent web application | 12 real HTTP/SQLite tests passed, including persistence across restart and invalid request boundaries. |
| Native catalog | 37 explicit skills, 67 optional bundles, 28 parseable role TOMLs; policies, existing references and legacy-operation checks passed. |
| Live Codex build | CLI 0.155.1 built the accepted app using the inherited configured model, executed its checks, and completed through the runtime. No vendor CLI or hook-trust bypass. |
| Browser behavior | Add, done, reload persistence, delete synthetic test data, blank-title validation, draft retention on connection failure, and restart/refresh recovery observed in Chrome. |
| Latest full installation | Separate product installed with its own Git root; pause/resume retained the run ID; app and catalog checks passed; completion returned to idle. Updating to the final framework also passed with mode-aware installation and fresh completion. |
| Original preservation | All 1,337 original project hashes unchanged; 1,337 framework files and 31 matching CLI files archived with recorded SHA-256 hashes. |

Live build receipts and sanitized behavior output are in
[`evidence/live-codex/`](evidence/live-codex/); final installed-runtime receipts are in
[`evidence/final-install/`](evidence/final-install/). Each records the actual run and
input hashes, argv, exit codes and log hashes. Final update receipts are in [`evidence/final-update/`](evidence/final-update/). Logs were copied for preservation;
their original paths refer to the isolated test projects.

The CLI build reported native delegation unavailable and implemented directly.
Role files have structural and reference validation; this does not qualify every
role's model behavior. Current app/CLI capability determines whether native
delegation is available.

## Scope

Required framework checks cover the coordinator, completion evidence, installer
conflicts, native hook payloads, safe staged-index scanning and catalog integrity.
An independently authored local web application supplies a real HTTP/SQLite
behavior target. Live Codex uses the user's configured model and sandbox; no
hook trust bypass is used.

## Limits

- Native hooks require project trust and exact definition review through `/hooks`.
  Dispatcher contract tests are separate from evidence of hooks executing in the
  desktop app. Explicit runtime verification works without trusted hooks.
- Optional service recipes require currently configured providers and their own
  real integration acceptance tests. Payments, deployment, email, database accounts
  and production security are not qualified by the local application example.
- Whole-checkout fingerprints favor correctness. Large monorepos may need a measured
  input-scope optimization; incomplete scopes must not qualify changed backend code.
- One coordinator per checkout is intentional. Use separate Git worktrees for
  simultaneous feature coordinators; roles in one run can have independent tasks.
- Receipts are local files intended for review. A user with write access can alter
  the implementation or evidence; this is not an attestation service.
- Linux and macOS are the Python runtime targets; WSL is the Windows route.

Full source preservation, static baseline checks and the 19-section documentation
review are under `docs/audit/` and `upstream/`.
