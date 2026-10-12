# Foundry documentation

Foundry is a product-building framework for your AI. It carries Research, Plan,
Design, Build and Review through saved assignments, approvals and evidence.
Your AI supplies reasoning and coding tools; Foundry coordinates the work.

## Choose your starting point

| You want to | Start here | Availability |
| --- | --- | --- |
| Work inside your coding client | [OpenCode connection](CONNECTED-CLIENT.md) | Source preview; not in npm 0.5.1 |
| Run a product journey from Foundry's terminal | [Install and first project](GETTING-STARTED.md) | Published npm CLI with a selected provider adapter |
| Track a change without connecting an AI | [Existing repositories](RUNTIME.md) | Manual scoped work |

The connected source supports Research → Plan approval → Design approval →
Builders → Reviewer → local handoff. A live model-driven trial remains
unqualified. Homebrew distribution is not available. No path deploys automatically.

## Use Foundry

1. [Install and build your first project](GETTING-STARTED.md) or
   [build inside your coding client](CONNECTED-CLIENT.md).
2. [How Foundry works](WORKFLOW.md) - what Foundry does, what the AI does, and
   what stays under your control.
3. [Command reference](COMMANDS.md) - look up a command when you need it.

You need Node.js 24 or newer and Git. To run AI work, choose a compatible provider,
install its runtime and authorize the access it needs.

## When you need more detail

- [Existing projects and recovery](RUNTIME.md)
- [Provider setup and custom connectors](PROVIDERS.md)
- [Project settings](CUSTOMIZATION.md)
- [Specialist roles and extra guides](CATALOG.md)
- [Security and trust](../SECURITY.md)

## Develop Foundry itself

- [Contributor setup](../CONTRIBUTING.md) and [code layout](ARCHITECTURE.md)
- [Tests](VALIDATION.md) and [saved-record rules](WORKFLOW-CONTRACTS.md)
- [Check a provider integration](QUALIFICATION.md)
- [Build the documentation website](DOCUMENTATION.md)
- [Publish an npm release](RELEASING.md)
- [Origins and licenses](PROVENANCE.md)
