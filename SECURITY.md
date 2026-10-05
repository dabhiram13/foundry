# Security and trust

Foundry coordinates local software work; it is not an operating-system sandbox
for unknown projects, providers or check commands. A child process can act with
the privileges granted by the runtime and the host.

## Trust boundaries

- Review provider executables, adapter configuration and requested capabilities.
  Capability metadata is not proof of isolation, enforcement or security review.
- Role instructions and filtered child environments do not enforce filesystem
  permissions. Use an externally restricted environment for untrusted code.
- Cloud providers receive the prompts and project content sent to them. Do not
  place secrets in prompts, documents, logs or review records.
- Required checks execute project-supplied commands. Inspect unfamiliar project
  configuration before running it. Cancellation cannot undo an external action.
- Billing consent, owner approval, publication and deployment authority are
  separate. A local pass or Ship summary does not authorize external effects.
- The public site is static and does not expose project state or a workspace
  server.

## Reporting a vulnerability

Check the repository's [Security page](https://github.com/dabhiram13/foundry/security)
for an available private reporting channel. If private reporting is unavailable,
open an issue asking for a private contact **without exploit details, credentials,
private project content or a working exploit**. Do not post sensitive details in
a public issue while arranging disclosure.

Include the affected revision, supported platform, expected boundary and a minimal
safe reproduction. Never include live secrets. No response-time guarantee or
third-party security certification is claimed.
