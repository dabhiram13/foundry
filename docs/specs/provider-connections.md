# Provider connections and current product scope

Foundry must describe the product that exists, not treat its internal session
tests as a complete managed coding workspace.

## Acceptance

- PC-01: Public starting pages distinguish npm 0.5.1, the connected source
  workflow and unfinished managed execution. They explain who edits code, runs
  tools, owns the account and controls spending, without promising a complete
  unattended product build.
- PC-02: The provider guide documents an OpenAI-compatible connection through
  OpenCode, with an explicit model, base URL and environment-held key. It does
  not imply that Foundry accepts a raw endpoint as a coding agent or that all
  compatible models support tools, streaming, structured output or cancellation.
- PC-03: Connecting, refreshing and removing Foundry preserve owner provider
  configuration, including environment references and unrelated MCP settings.
  A separately selected real OpenCode binary can exercise a local fake endpoint
  and a real tool call without a provider account or live inference.
- PC-04: Node 24/25 runtime/package checks, static-site checks, tooling, catalog,
  security and saved scoped verification pass. Test results distinguish local
  protocol checks from live-model, visual-quality and full-product acceptance.

## Limits

No new model loop, managed coding turns, terminal/browser workspace, PR/CI
automation, cloud account connection, spending, sandbox, publishing or learning
engine is enabled. The endpoint check qualifies one host protocol path, not all
providers. Existing managed OpenCode deny-only qualification remains separate.
