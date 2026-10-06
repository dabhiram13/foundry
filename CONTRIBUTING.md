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

Here `--ignore-scripts` avoids running dependency install hooks while setting
up the source checkout. It is a contributor precaution, not a Foundry install
requirement. Everyday users only need `npm install -g @dabhiram13/foundry`.

`npm run build:runtime` builds the CLI only; `npm run build` also builds the
static website. `./foundry` runs the checkout directly; contributors do not need
a global link. Installing `@dabhiram13/foundry` from npm is for everyday use,
not a contributor requirement.

To inspect a local candidate tarball, use `npm pack`; it rebuilds
the runtime. The owner-controlled release checklist is in the
[release guide](docs/RELEASING.md). Do not publish as part of setup or
contribution.

Use test projects in isolated temporary directories. Do not exercise migration,
failure or cancellation against an owner's real product. Local provider fixtures
need no account and do not qualify live providers. Do not commit credentials,
product data, private runtime state, or private source archives.

## Make a focused change

1. Describe expected behavior and relevant failure cases.
2. For substantial work, add a specification with observable criteria under
   `docs/specs/`.
3. Change the shared core and public CLI behavior, not a removed interface.
4. Add regression coverage without weakening checks, approval boundaries,
   billing consent, or failure handling.
5. Update the canonical Markdown source when behavior or commands change.

The static docs site is generated from repository Markdown. Edit the original
page, not generated content under `site/src/content/docs/docs/`.

## Checks

Start with focused tests for the change, then run the required commands in
[README](README.md#check-the-framework). The aggregate `npm test` runs the runtime,
package, static-site, tooling, catalog and exact-index security gates. The
framework has no browser workspace and does not use browser automation for its
checks. Browser checks may still be appropriate for an individual product when
that product's acceptance criteria require them.

Do not weaken gates to make a migration pass. Report checks that could not run.

## Pull requests

Explain behavior, tests, compatibility effects and limitations. Keep unrelated
formatting and generated reports out of the patch. Record source and license
notices for reused material; reference-library provenance does not imply support
or qualification.

For a security issue, follow [the security guidance](SECURITY.md) before posting
reproduction details publicly.
