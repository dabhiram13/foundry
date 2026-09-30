# Product Foundry

Reusable workflows, skills, roles, and checks for building products with Codex.
Use it in a separate project for a web app, SaaS, API, or another product.
Requires Python 3.11+, Git, and Codex on macOS or Linux (WSL on Windows).
The framework uses the Python standard library.

## Start a product

```sh
git clone https://github.com/dabhiram13/product-foundry.git
cd product-foundry
python3 scripts/foundry.py install "$HOME/Documents/Products/my-product"
```

Open the new product folder in Codex and ask it to use `$foundry-start` with your
idea. Use `$foundry-spec` for a feature or `$foundry-mvp-spec` for the first working
version. Follow [the workflow](docs/WORKFLOW.md) to build, check, and finish it.

A fresh product gets its own local Git repository. Existing project instructions,
files, and Git settings are preserved. Choose a folder outside another repository.

Add the product's actual test and build commands to `.foundry/project.json`:

```json
{
  "name": "My product",
  "checks": [
    {"name": "test", "command": ["npm", "test"], "required": true},
    {"name": "build", "command": ["npm", "run", "build"], "required": true}
  ]
}
```

These are examples; use commands that work for your application. A new installation
has no checks configured. Completion requires passing required checks on the current
files; it saves results locally and writes a completed-feature note in `docs/built/`.

## Customize and update

[The catalog](docs/CATALOG.md) lists the workflow skills, specialist roles, and
optional skill library. Add your own skills, roles, and checks using
[the customization guide](docs/CUSTOMIZATION.md).

Enable an optional skill when needed:

```sh
python3 scripts/foundry.py enable-skill frontend-design
```

Review optional Codex hooks through `/hooks`; see [the hook guide](docs/HOOKS.md).
To enable the Git check for staged secrets, review `.githooks/pre-commit`, then run
`git config core.hooksPath .githooks` in the product.

Pull updates in this framework repository, then run:

```sh
python3 scripts/foundry.py install "$HOME/Documents/Products/my-product" --update
```

Updates stop before changing files if they conflict with your local edits.

## Check the framework

```sh
python3 -m unittest discover -s tests -v
python3 -m unittest discover -s tests/fixtures/web_app -v
python3 scripts/check_catalog.py
python3 scripts/security_scan.py --whole-tracked
```

[Validation](docs/VALIDATION.md) explains what these checks cover.
[License notices](THIRD_PARTY_NOTICES.md) identify the notices to retain when copying.
