# Qualification status

Registration, local protocol tests and live qualification are different claims.
Foundry does not treat an adapter entry or passing fixture as proof that an
external runtime works reliably or enforces the requested permissions.

## Current boundaries

- Codex is registered as the built-in agent-runtime adapter. A live inference
  and billing qualification requires a separately authorized account and run;
  ordinary checks do not make provider calls.
- Local fixtures exercise protocol, cancellation, schema validation and
  redaction without credentials. Fixture success is not live-provider evidence.
- The legacy `chatgpt` registration remains marked unsupported for compatibility;
  it does not fall back to Python or another runtime.
- Node 24 runtime and package checks provide local Linux evidence, not platform
  qualification. macOS and native Windows behavior are unqualified.
- The registry package is still an unpublished candidate. Package checks do not
  establish npm scope ownership, registry availability or live-provider support.
- No performance comparison with the removed runtime is claimed.
- Migration fixtures cover supported workspace shapes. The framework cannot
  discover arbitrary controllers outside its known registries; legacy Factory
  approvals and completion are nonresumable and not transferred.
- Declared process permissions and filtered environment variables are not an OS
  sandbox. Untrusted code needs external isolation.

An owner-authorized qualification plan must identify the exact provider or
platform, permitted billing, observable acceptance criteria, and recovery
boundary before using live accounts or paid inference.
