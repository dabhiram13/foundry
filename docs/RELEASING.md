# Publish Foundry

This guide covers maintainer releases of the Foundry CLI to npm.

## Package

The public package name is [`@dabhiram13/foundry`](https://www.npmjs.com/package/@dabhiram13/foundry).
The examples below use `0.5.1`; substitute the intended
version for later releases.

## Publishing access

Publishing requires the owner's npm access. Sign in locally or use a short-lived,
package-scoped token for the approved release. Revoke temporary tokens afterward.

A GitHub or website update does not update the installed npm package. Publish
a new version for package changes, including changes to the README shown on
npm. Do not reuse an already published version.

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

   The contributor install skips dependency hooks. Normal `npm pack` then
   runs `prepack`, which builds the runtime. Do not skip this build step.
4. Pack the exact candidate tarball and inspect its contents:

   ```sh
   mkdir -p release-artifacts
   npm pack --pack-destination ./release-artifacts
   ```

5. Test that exact tarball with normal npm installation in a temporary folder.
   Do not disable install scripts: this must test the same behavior users get.
   Run it outside the checkout, then uninstall it:

   ```sh
   PREFIX="$(mktemp -d)"
   TARBALL="./release-artifacts/dabhiram13-foundry-0.5.1.tgz"
   npm install -g --prefix "$PREFIX" "$TARBALL"
   (
     cd "$HOME"
     PATH="$PREFIX/bin:$PATH" foundry --version
     PATH="$PREFIX/bin:$PATH" foundry --help
     PATH="$PREFIX/bin:$PATH" foundry roles
   )
   npm uninstall -g --prefix "$PREFIX" @dabhiram13/foundry
   ```

   Confirm the version, one executable, and retained fixture/user project data.
   The package test performs an isolated version of this smoke test.
   Publishing a tarball does not run the source package's
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
   npm publish ./release-artifacts/dabhiram13-foundry-0.5.1.tgz \
     --access public \
     --registry=https://registry.npmjs.org/
   ```

   This requires the owner's explicit authorization, not just a successful
   build or a request to prepare a release. Publishing is
   irreversible in the ordinary release lifecycle: do not unpublish as a
   rollback.
8. Verify the registry result, then install that exact version in a clean
   prefix and repeat the version/help/roles checks:

   ```sh
   npm view @dabhiram13/foundry@0.5.1 version dist.tarball
   PREFIX="$(mktemp -d)"
   npm install -g --prefix "$PREFIX" @dabhiram13/foundry@0.5.1
   (
     cd "$HOME"
     PATH="$PREFIX/bin:$PATH" foundry --version
     PATH="$PREFIX/bin:$PATH" foundry --help
     PATH="$PREFIX/bin:$PATH" foundry roles
   )
   npm uninstall -g --prefix "$PREFIX" @dabhiram13/foundry
   ```

   Keep the README, landing and Getting started installation commands aligned.
   Include the current README in the tested tarball. Check its links and
   banner on both GitHub and npm. Announce availability
   only after registry verification, then tag the approved source commit as
   `v0.5.1` and publish matching release notes.

## Recovery and rollback

Package versions are immutable releases; do not unpublish to roll back. Stop
active Foundry work and back up projects before changing versions. Install a
known compatible earlier version only if one has actually been published.
Installing an earlier CLI does not automatically reverse project-data
migrations. Do not claim that a previous registry version exists until it has
been verified.
