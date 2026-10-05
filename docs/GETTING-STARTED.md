# Install and start a project

Foundry runs on Node.js 24 and npm. It does not need Python, a browser service or
a Foundry account. Git is required for product checkpoints. Provider requirements
are separate, and no provider runs during installation or help.

## Install from source

There is no public npm-registry installation promise. Build the current source:

```sh
git clone https://github.com/dabhiram13/foundry.git
cd foundry
npm ci --ignore-scripts
npm run build
npm start -- --help
```

`npm start` runs the package's single `foundry` executable. `./foundry` is the
same Node launcher. In an interactive terminal, bare `foundry` opens the
readline-based terminal. Without a TTY it prints help and exits.

Examples elsewhere abbreviate the executable as `foundry`; use `./foundry`
from this checkout. To make that command available from other directories,
run `npm link --ignore-scripts` after building. This links the local checkout;
it does not download or publish a registry package.

To create a local package tarball for private testing, use `npm pack` after the
build. The package is marked private; do not publish it to a registry.

## Choose where projects live

By default, Foundry stores product workspaces in `~/.foundry/products`. Set
`--products-dir PATH` to choose another owner-controlled directory:

```sh
./foundry list --products-dir /absolute/path/to/products
./foundry new reading-list \
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
./foundry new reading-list \
  --idea "A private reading list with links and an unread filter."
./foundry configure reading-list --billing subscription --confirmed
./foundry status reading-list
```

The built-in Codex adapter uses the `codex` executable on `PATH`, or the
owner-selected path in `FOUNDRY_CODEX`. Authenticate Codex separately using its
official instructions. Foundry does not copy or ask you to paste provider
credentials into a project document.

## Run, review and approve

Each explicit `run` command advances one stage. The first two commands create
Research and then Plan:

```sh
./foundry run reading-list
./foundry run reading-list
./foundry review reading-list
./foundry approve reading-list --revision EXACT_REVISION_FROM_REVIEW
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
./foundry init --project /path/to/repository
./foundry work status --project /path/to/repository
./foundry work start improve-search \
  --spec docs/specs/improve-search.md \
  --project /path/to/repository
```

Use the scoped `work` commands for a bounded repository change rather than
inventing a six-stage product plan. See [existing repositories and migration](RUNTIME.md).
