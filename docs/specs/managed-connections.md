# Managed connections

Status: implemented in source, checked offline only.

## Problem

Managed sessions accepted only a `http://127.0.0.1:PORT/v1` test endpoint, and
the provider registry knew only process adapters. There was no way to select a
remote provider, model and key for managed execution without weakening the
consent, credential and lifecycle boundaries.

## Scope

- `src/core/connection-profile.ts` defines one connection profile shared by
  managed sessions and the provider registry: `local-test` (loopback only) or
  `remote` (provider, model, plain HTTPS base URL, chat completions API and a
  credential reference). `CredentialReference` is the small exported reference
  type other subsystems reuse; it names an environment variable and never holds
  the value.
- `.foundry/connections.json` is the owner-authored registry. A missing file or
  an unlisted profile denies remote access.
- `src/core/managed-profile.ts` keeps the local test profile unchanged and adds
  `consented-remote` profiles with request and output-token limits and an
  explicit `dollarCap: not-enforced-by-foundry` acknowledgement.
- `src/runtime/connection-proxy.ts` is a per-execution loopback relay. OpenCode
  receives a random token, never the key. The relay forwards only chat
  completions for the selected model to the selected endpoint, clamps output
  tokens, refuses requests past the limit, does not follow redirects and cancels
  forwarded requests on Pause or Stop.
- `foundry provider` and `foundry providers` list registered connections with
  credential presence and `authentication: not_checked`.

## Limits

No live account was connected and no paid inference was run. Offline relay
checks are not live-model qualification. Request and token limits bound usage
but are not a dollar cap. The boundary remains trusted-local and host-process
based, not a sandbox; model tools can use the per-run relay token within the
limits.

## Acceptance

See `managed-connections.scope.json`.
