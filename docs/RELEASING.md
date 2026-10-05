# npm release guide

Foundry's product **Ship** command writes a local summary; it does not publish
the product or this framework. Publishing the Foundry CLI is a separate,
owner-controlled release decision.

## Package and release notes

The public package name is [`@dabhiram13/foundry`](https://www.npmjs.com/package/@dabhiram13/foundry).
Use [Getting started](GETTING-STARTED.md) for installation. Repository version
metadata is not proof of publication; verify the exact version in npm before
announcing a release. The examples below use `0.2.0`; substitute the intended
version for later releases.

- One Node 24 `foundry` executable provides the interactive terminal and
  explicit commands through the same TypeScript core.
- Package checks cover the installed CLI, version/help/roles commands, and
  isolated project creation without Python or provider credentials.
- The static landing page and documentation site are separate from the CLI
  tarball.
- A release does not establish additional provider or platform qualification.

## Owner release checklist

Do not publish until each item is checked:

1. Review the exact source commit on `main`; require green CI and approved
   release notes.
2. Confirm `package.json` and `package-lock.json` carry the intended version.
   Check the package file allowlist and notices; ensure the tarball contains no
   credentials, private state, unrelated files, or unintended dependencies.
3. Use Node 24. From a clean checkout run:

   ```sh
   npm ci --ignore-scripts
   npm test
   ```

   Normal `npm pack` runs `prepack`, which builds the runtime. Do not use
   `--ignore-scripts` for this build step: it skips `prepack` and can pack a
   missing or stale runtime.
4. Pack the exact candidate tarball and inspect its contents:

   ```sh
   mkdir -p release-artifacts
   npm pack --pack-destination ./release-artifacts
   ```

5. Smoke-test that exact tarball globally in a disposable prefix with scripts
   disabled. Run it outside the checkout, then uninstall it:

   ```sh
   PREFIX="$(mktemp -d)"
   TARBALL="./release-artifacts/dabhiram13-foundry-0.2.0.tgz"
   npm install --global --ignore-scripts --prefix "$PREFIX" "$TARBALL"
   (
     cd "$HOME"
     PATH="$PREFIX/bin:$PATH" foundry --version
     PATH="$PREFIX/bin:$PATH" foundry --help
     PATH="$PREFIX/bin:$PATH" foundry roles
   )
   npm uninstall --global --ignore-scripts --prefix "$PREFIX" @dabhiram13/foundry
   ```

   Confirm the version, one executable, and retained fixture/user project data.
   The package test performs an isolated version of this smoke test without
   Python. Publishing a tarball does not run the source package's
   `prepublishOnly` test hook, so the checks above are mandatory.
6. The owner authenticates locally with npm, verifies scope ownership and
   publish rights, and confirms the account's 2FA requirements. For example:

   ```sh
   npm login --registry=https://registry.npmjs.org/
   npm whoami --registry=https://registry.npmjs.org/
   ```

   Do not store npm tokens in this repository or CI. Optional trusted publishing
   would require the owner to configure the npm package and a specific workflow;
   it is not set up here.
7. Only after reviewing the exact tested tarball and confirming the package
   scope may the owner publish it explicitly:

   ```sh
   npm publish ./release-artifacts/dabhiram13-foundry-0.2.0.tgz \
     --access public \
     --registry=https://registry.npmjs.org/
   ```

   This is a manual owner action, not an automated workflow. Publishing is
   irreversible in the ordinary release lifecycle: do not unpublish as a
   rollback.
8. Verify the registry result, then install that exact version in a clean
   prefix and repeat the version/help/roles checks:

   ```sh
   npm view @dabhiram13/foundry@0.2.0 version dist.tarball
   PREFIX="$(mktemp -d)"
   npm install --global --ignore-scripts --prefix "$PREFIX" @dabhiram13/foundry@0.2.0
   (
     cd "$HOME"
     PATH="$PREFIX/bin:$PATH" foundry --version
     PATH="$PREFIX/bin:$PATH" foundry --help
     PATH="$PREFIX/bin:$PATH" foundry roles
   )
   npm uninstall --global --ignore-scripts --prefix "$PREFIX" @dabhiram13/foundry
   ```

   Keep the README, landing and Getting started installation commands aligned.
   Include the npm-ready README in the tested tarball so the package page does
   not inherit obsolete source-only setup instructions. Announce availability
   only after registry verification, then tag the approved source commit as
   `v0.2.0` and publish matching release notes.

## Recovery and rollback

Package versions are immutable releases; do not unpublish to roll back. Stop
active Foundry work and back up projects before changing versions. Install a
known compatible earlier version only if one has actually been published.
Installing an earlier CLI does not automatically reverse project-data
migrations. Do not claim that a previous registry version exists until it has
been verified.
