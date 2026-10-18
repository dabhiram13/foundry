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
- Research reads selected public HTTPS URLs in the controller, outside the
  provider sandbox. Destination servers see the requested URL and connection;
  do not place secrets in URLs. The reader rejects non-public addresses, pins
  DNS results, rechecks redirects and bounds response size/time. It sends no
  cookies or authorization and executes no page scripts. This reader does not
  restrict other network tools available to a provider.
- Source pages are untrusted input. Matching quotes and snapshot hashes do not
  establish factual truth or a tamper-proof audit trail against a privileged
  process. Keep stronger host isolation and independent review for untrusted work.

## Internal managed fixtures

The managed-task bridge accepts trusted local fixture code, not arbitrary
executors. It has no public CLI, MCP or HTTP endpoint. Internal owner, supervisor
and inspector contexts are application authority, not authentication credentials
to accept from client JSON.

A private project claim coordinates participating scoped, Factory and provider
operations. It is not a filesystem or network restriction. Other same-user
processes can still edit files and read local data. Process failure leaves
uncertain claims and admissions blocked until trusted inspection.

Managed checks receive only PATH, LANG and TZ, plus check-report variables when
needed. Declared environment grants are rejected in this slice. This prevents
default environment inheritance, not access to secrets elsewhere on the host.
The fixture callback itself is trusted code in the controller process, without
a sandbox. Untrusted projects need an externally restricted environment.

## Reporting a vulnerability

Check the repository's [Security page](https://github.com/dabhiram13/foundry/security)
for an available private reporting channel. If private reporting is unavailable,
open an issue asking for a private contact **without exploit details, credentials,
private project content or a working exploit**. Do not post sensitive details in
a public issue while arranging disclosure.

Include the affected revision, supported platform, expected boundary and a minimal
safe reproduction. Never include live secrets.
