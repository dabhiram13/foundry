# Security and trust

Foundry coordinates local software work. It is not a security sandbox for unknown
executables, projects or plugins. Coding agents and configured checks can run
commands with the privileges granted by their runtime and your operating system.

## Trust boundaries

- Review a provider executable and its settings before registering it. Capability
  metadata is a claim, not evidence of isolation or a security audit.
- Runtime permissions must be enforced by the selected coding runtime or an
  actual sandbox. A read-only role prompt cannot enforce filesystem isolation.
- Keep the browser service on loopback. It is not designed as an internet-facing,
  multi-user service. Do not disable its host, origin or authorization checks.
- Cloud AI receives prompts and selected project content. Local storage is not
  offline inference; do not put secrets in prompts, logs or review documents.
- Required checks execute project-supplied commands. Inspect unfamiliar project
  configuration before running it. Cancellation cannot undo an external action.
- Owner approvals, billing consent and publishing authority are separate. A
  passing check or completed run does not authorize deployment or new spending.

## Reporting a vulnerability

Check the repository's [Security page](https://github.com/dabhiram13/foundry/security)
for an available private reporting channel. If private reporting is unavailable,
open an issue asking for a private contact **without exploit details, credentials,
private project content or a working exploit**. Do not post sensitive details in
a public issue while arranging disclosure.

Include the affected revision, supported platform, expected boundary and a minimal
safe reproduction. Never include live secrets. No response-time guarantee or
third-party security certification is claimed.
