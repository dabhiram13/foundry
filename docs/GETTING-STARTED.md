# Install and start a project

Foundry needs Node.js 24, npm and Git. No Foundry account is required.
Connect your own AI provider when you are ready to run work; installation and
help do not start AI calls.

## Install Foundry

Install once, then run `foundry` from any directory. No npm account or access
token is needed.

```sh
npm install -g @dabhiram13/foundry
foundry
```

You can now run `foundry` from any directory. In an interactive terminal it
opens the slash-command interface; without a TTY it prints help and exits.
`foundry --help` shows the explicit commands. Installation does not start AI work.

No source checkout or website build is needed. Check your installation with:

```sh
foundry --version
foundry --help
```

The `-g` flag makes the command available from any directory. The package is
already built and needs no install scripts or extra flags. Tested on Linux;
macOS and Windows have not been verified.

If `foundry` is not found, check that your npm global executable directory
(`$(npm prefix -g)/bin` on macOS/Linux) is on `PATH`. If installation reports a
permissions error, use a Node version manager or a user-writable npm prefix;
do not retry with `sudo`. See npm's [permissions guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).

## Switch from a local checkout

If you previously used `npm link`, stop active Foundry work and unlink it
before installing the registry package:

```sh
npm unlink -g @dabhiram13/foundry
npm install -g @dabhiram13/foundry
```

This replaces the command link, not your project data. Keep any local changes
in the source checkout; it is no longer required to run the installed package.

## Update or uninstall

Stop active Foundry work and back up important projects before changing
versions. Update to the latest release:

```sh
npm install -g @dabhiram13/foundry
```

To install a specific version:

```sh
npm install -g @dabhiram13/foundry@0.2.0
```

To uninstall the command:

```sh
npm uninstall -g @dabhiram13/foundry
```

Uninstalling the command does not remove the source checkout or projects in
`~/.foundry/products`.

## Build from source (optional)

For unreleased changes or development, use a POSIX shell:

```sh
git clone https://github.com/dabhiram13/foundry.git
cd foundry
npm ci --ignore-scripts
npm run build:runtime
npm link
foundry
```

The linked command points to the built files, so keep the checkout. To update,
stop active Foundry work and run `git pull --ff-only`, `npm ci --ignore-scripts`
and `npm run build:runtime` inside this checkout, not a product repository.
Resolve local changes or conflicts rather than discarding them. Remove the
link with `npm unlink -g @dabhiram13/foundry`.

See [contributor setup](../CONTRIBUTING.md#start-locally) for development and
the [release guide](RELEASING.md) for owner-controlled publication.

## Choose where projects live

By default, Foundry stores product workspaces in `~/.foundry/products`. Set
`--products-dir PATH` to choose another owner-controlled directory:

```sh
foundry list --products-dir /absolute/path/to/products
foundry new reading-list \
  --idea "A private list for saving and filtering articles." \
  --products-dir /absolute/path/to/products
```

The old package-adjacent `../products` location is not moved or deleted
automatically. Choose it explicitly with `--products-dir` if that is where your
existing workspaces live.

## Create a first project

Create a project without starting provider work, then explicitly configure
billing consent:

```sh
foundry new reading-list \
  --idea "A private reading list with links and an unread filter."
foundry configure reading-list --billing subscription --confirmed
foundry status reading-list
```

The built-in Codex adapter uses the `codex` executable on `PATH`, or the
owner-selected path in `FOUNDRY_CODEX`. Authenticate Codex separately using its
official instructions. Foundry does not copy or ask you to paste provider
credentials into a project document.

## Run, review and approve

Each explicit `run` command advances one stage. The first two commands create
Research and then Plan:

```sh
foundry run reading-list
foundry run reading-list
foundry review reading-list
foundry approve reading-list --revision EXACT_REVISION_FROM_REVIEW
```

Plan and Design require approval of the exact revision displayed by `review`.
After Plan approval, another explicit `run` reaches Design; review and approve
its displayed revision the same way. Changed content makes an earlier revision
stale. Research, Build, Test and Ship do not ask for those approvals.

The terminal's `/run` continues through stages until an approval, completion or
failure boundary. `/review` and `/approve` use the same saved documents and
revision checks. Ship writes a local summary only; it does not publish, deploy,
or create an external release.

## Add Foundry to an existing repository

`init` installs the managed runtime in an existing repository without replacing
unmanaged documents or history:

```sh
foundry init --project /path/to/repository
foundry work status --project /path/to/repository
foundry work start improve-search \
  --spec docs/specs/improve-search.md \
  --project /path/to/repository
```

Use the scoped `work` commands for a bounded repository change rather than
inventing a six-stage product plan. See [existing repositories and migration](RUNTIME.md).
