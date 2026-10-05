# Foundry

**Turn an idea or an existing repository into working software, from your terminal.**

Foundry keeps the plan, approvals, specialist instructions, checks and saved progress
in one TypeScript framework. An AI runtime does the implementation work; Foundry
checks the results and keeps the next decision visible. Your product can use any
language with commands that Foundry can run to check it.

```text
                  foundry
          terminal UI or commands
                     │
              one shared core
           ┌─────────┴─────────┐
      provider adapters    checks + Git
           └─────────┬─────────┘
              local results

  Research → Plan → Design → Build → Test → Ship
               ↑       ↑        ↻
            Approve Approve  Check / repair
```

**Ship is a local summary, not permission to publish or deploy.** Small repository
changes can use a scoped work run instead of the six-stage new-product journey.
Neither mode needs a Foundry account or a browser workspace.

## Install from source

Requires **Node.js 24 LTS**, npm and Git. Foundry itself does not require Python.
An optional provider or a product written in Python may have its own requirements.

```sh
git clone https://github.com/dabhiram13/foundry.git
cd foundry
npm ci --ignore-scripts
npm run build
npm start -- --help
./foundry
```

The last command opens the interactive terminal when attached to a terminal.
Without one, it prints guidance and exits. Explicit commands with `--json` are
available for automation and do not prompt. Installation and help do not start AI.

Build a local tarball with `npm pack`. **No npm registry release is promised here.**
See the [installation guide](docs/GETTING-STARTED.md) for the first-project journey.

## What it does

- **Plan before building:** Plan and Design need approval of the exact revision
  you reviewed. Changed documents invalidate that approval.
- **Build in small tasks:** required checks run between tasks; repairs are bounded;
  successful product changes receive Git checkpoints.
- **Review evidence:** a model saying “done” is not sufficient. Failed checks,
  missing evidence and blocking review findings prevent completion.
- **Stop and recover:** interrupted work remains visible. Recovery is explicit.
- **Use specialist roles:** research, planning, design, implementation and review
  policies share the same controller, permissions and provider contract.
- **Keep ownership:** code, documents and history live in your project. Private
  runtime state and credentials do not belong in product checkpoints.

## Providers and trust

Codex is the built-in adapter; other runtimes can implement the same process and
structured-message contract. An API key alone does not add an agent runtime.
Local fixtures prove the contract, **not live provider qualification**.

Billing consent is explicit; Foundry does not silently switch to paid API usage.
Cloud providers receive the prompts and project content supplied to them.
Environment filtering and declared permissions are **not an OS sandbox**.
Use an externally restricted environment for untrusted work.

See [providers](docs/PROVIDERS.md), [security](SECURITY.md) and
[tested behavior and limits](docs/VALIDATION.md). Native Windows and an independent
second live runtime remain unqualified. No speed advantage over the old runtime
is claimed.

## Documentation

The static website provides a landing page, searchable docs and a GitHub link.
Repository Markdown is the source of those docs, not a second manual.

| Read next | Contents |
| --- | --- |
| [Start here](docs/README.md) | Ordered documentation map |
| [Get started](docs/GETTING-STARTED.md) | Installation and first project |
| [Commands](docs/COMMANDS.md) | Terminal controls and scripting |
| [Workflow](docs/WORKFLOW.md) | Approvals, checks and local completion |
| [Existing repositories](docs/RUNTIME.md) | Scoped changes, migration and recovery |
| [Providers](docs/PROVIDERS.md) | Setup, capabilities and adding an adapter |
| [Architecture](docs/ARCHITECTURE.md) | Boundaries, modules and specialist roles |
| [Contributing](CONTRIBUTING.md) | Development and pull requests |

## Check the framework

```sh
npm run typecheck
npm run build
npm test
node scripts/check_catalog.mjs
node scripts/security_scan.mjs --whole-tracked
```

Checks use local fixtures, not paid AI. Cutover checks cover terminal/core, import,
packed installation and static-site links/content. Browser automation is excluded
from this rewrite's verification. Products still need their own behavior checks.

## Origins and licenses

Read [provenance](docs/PROVENANCE.md), [third-party notices](THIRD_PARTY_NOTICES.md)
and the repository license files before reusing adapted material. Attribution is
preserved; it is not a requirement to use a particular person's account or setup.
