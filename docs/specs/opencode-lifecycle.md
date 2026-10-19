# Owned OpenCode lifecycle

## Outcome

Qualify a small typed boundary to an explicitly selected local OpenCode binary.
Start one authenticated server, bind an empty upstream session to the selected
project, inspect and delete it, and confirm shutdown. Do not send a model prompt.

The existing managed-task bridge uses trusted fixtures. It does not establish
SDK compatibility or real OpenCode process behavior. This separate slice tests
those boundaries without replacing scoped-work or Factory authority.

## Boundaries

- Use the pinned SDK client, not its environment-inheriting server helper.
- Select an absolute executable, expected binary digest and project. No remote URL, shell, model,
  account connection, prompt, tools, browser or public managed API is exposed.
- Use a private runtime directory outside project/Git trees, a fresh home,
  filtered environment, disabled external configuration/plugins and deny rules.
  Check effective configuration before creating the empty session.
- Keep a durable launch record before spawning. An unresolved record blocks
  another qualification using that runtime directory, including after restart.
  Reading records never starts, resumes or kills a process.
- Bind canonical project identity, binary digest/version and upstream identity.
  These are resource qualification records, not another workflow store.
- Authenticate loopback requests; bound startup output, HTTP bodies and time.
  Do not retain raw output, HTTP errors or credentials in records/errors.
- Await owned process-group shutdown. An abort acknowledgement alone does not
  prove tools stopped. Unconfirmed resources remain explicitly unresolved.

## Acceptance criteria

- OC-01: The exact SDK builds on Node 24/25. Missing/relative/symlink executables,
  invalid roots and unsafe runtime directories are rejected before launch.
- OC-02: One explicitly requested local server uses a random loopback port and
  per-launch authentication. Wrong version, missing auth, redirects, malformed
  responses and wrong project/session identity fail closed.
- OC-03: Startup, request bodies and total operation time are bounded. Hung,
  noisy and prematurely exiting processes fail with redacted diagnostics.
- OC-04: Project/global plugin and MCP settings and supervisor credentials are
  not inherited. Effective deny-only configuration is checked before session
  creation. Tests use sentinel environment values and hostile fixture config.
- OC-05: The typed SDK performs health/config, create, inspect, idle abort and
  delete, always with the selected project. No prompt, shell, auth or model
  endpoint is invoked, and no workflow task becomes completed.
- OC-06: Success requires confirmed process-group shutdown. Termination
  escalation is bounded; unknown resources keep an unresolved launch record.
  Reopening or concurrent admission cannot silently replay a launch.
- OC-07: Fixture protocol tests and a separately selected real pinned binary
  exercise the lifecycle. Record actual binary/SDK versions and project binding.
  Idle abort does not qualify cancellation of active model/tools.
- OC-08: Runtime/type/package, static-site, tooling, catalog, security and scoped
  checks pass. Existing connected-host and managed-fixture behavior stays intact.

## Exclusions

No model execution, account connection, spending, browser/PTY, production sandbox,
managed execution API, task dispatch or package release. Runtime configuration
and permissions are not filesystem/network containment. Qualification uses a
trusted disposable project; arbitrary untrusted projects remain unsupported.
Connecting this resource boundary to durable managed execution/leases and
qualifying active-turn cancellation are later slices. No existing data migrates.
