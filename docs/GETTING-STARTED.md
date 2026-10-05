# Install and start a project

Foundry runs on Node.js 24 and npm. It does not need Python, a browser service or
a Foundry account. Git is required for product checkpoints. Provider requirements
are separate, and no provider runs during installation or help.

## Install the CLI

Foundry is an npm CLI package with one command: `foundry`. It is not published
to npm yet, so a registry install is not available. On macOS or Linux, build
from source and register the command once:

```sh
git clone https://github.com/dabhiram13/foundry.git
cd foundry
npm ci --ignore-scripts
npm run build:runtime
npm link --ignore-scripts
foundry
```

You can now run `foundry` from any directory. In an interactive terminal it
opens the slash-command interface; without a TTY it prints help and exits.
`foundry --help` shows the explicit commands. Installation does not start AI work.

`npm link` points the command at this checkout, so keep the folder. It does not
download or publish a registry package. The runtime build does not build the
website. Native Windows installation is not yet qualified.

If `foundry` is not found, check that your npm global executable directory
(`$(npm prefix -g)/bin` on macOS/Linux) is on `PATH`. If linking reports a
permissions error, use a Node version manager or a user-writable npm prefix;
do not retry with `sudo`. See npm's [permissions guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).

## Update or uninstall

To update, run these commands **inside the Foundry checkout**, not a product
repository. Stop active Foundry work first. If Git reports local changes or a
conflict, resolve them rather than discarding them:

```sh
git pull --ff-only
npm ci --ignore-scripts
npm run build:runtime
```

The existing command link uses the rebuilt files. To remove the global command:

```sh
npm unlink --global --ignore-scripts @dabhiram13/foundry
```

This does not remove the checkout or your projects in `~/.foundry/products`.
Building Foundry or its website for development is covered in
[contributing](../CONTRIBUTING.md#start-locally).

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
