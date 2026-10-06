# Contributing to Foundry

Foundry is a Node 24 framework. Changes should work from a clean checkout without
private accounts or paid inference. Read [the setup guide](docs/GETTING-STARTED.md),
[architecture](docs/ARCHITECTURE.md), and [working agreements](AGENTS.md).

## Start locally

This is contributor setup, not required for everyday CLI use. For installation,
follow [Install Foundry](docs/GETTING-STARTED.md#install-foundry).

```sh
npm ci --ignore-scripts
npm run build:runtime
./foundry --help
```

`--ignore-scripts` skips dependency installation hooks in the source checkout.

`npm run build:runtime` builds the CLI only; `npm run build` also builds the
static website. `./foundry` runs the checkout directly; contributors do not need
a global link.

To inspect a local candidate tarball, use `npm pack`; it rebuilds
the runtime. The owner-controlled release checklist is in the
[release guide](docs/RELEASING.md). Do not publish as part of setup or
contribution.

Use test projects in isolated temporary directories. Do not exercise migration,
failure or cancellation against an owner's real product. Local provider fixtures
need no account. Do not commit credentials,
product data, private runtime state, or private source archives.

## Make a focused change

1. Describe expected behavior and relevant failure cases.
2. For substantial work, add a specification with observable criteria under
   `docs/specs/`.
3. Make the smallest change that addresses the specification.
4. Add regression coverage without weakening checks, approval boundaries,
   billing consent, or failure handling.
5. Update the canonical Markdown source when behavior or commands change.

The static docs site is generated from repository Markdown. Edit the original
page, not generated content under `site/src/content/docs/docs/`.

## Checks

Start with focused tests for the change, then run the required commands in
[README](README.md#check-the-framework). The aggregate `npm test` runs the runtime,
package, static-site, tooling, catalog and exact-index security gates. For public
website changes, also check the affected UI at desktop and mobile widths.

Do not weaken gates to make a migration pass. Report checks that could not run.

## Pull requests

Explain behavior, tests, compatibility effects and limitations. Keep unrelated
formatting and generated reports out of the patch. Record source and license
notices for reused material.

For a security issue, follow [the security guidance](SECURITY.md) before posting
reproduction details publicly.
