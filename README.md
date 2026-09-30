# Product Foundry

An independently maintained **Codex-native product development framework**.
Use it with a new or existing web app, SaaS, API or other product. It supplies
development workflows, role instructions, reusable expertise and local verification;
each application's behavior, stack and production integrations remain product work.

No BuildThisNow CLI, account, subscription, license-cache hook or Claude runtime is
required. Python 3.11+, Git and Codex are the local tools. The runtime uses the
Python standard library. Linux and macOS are supported; Windows needs WSL for the
coordinator file lock.

## Start a product

Clone this private framework once, then install it into a separate product folder:

```sh
git clone https://github.com/dabhiram13/product-foundry.git
cd product-foundry
python3 scripts/foundry.py install ../my-product
```

Open `my-product` in Codex. Ask it to use `$foundry-start` with your product idea.
Use `$foundry-spec` for a bounded feature or `$foundry-mvp-spec` for an initial
product slice. Existing product instructions and prior authorization remain in effect.
The full workflow is in [docs/WORKFLOW.md](docs/WORKFLOW.md).

A fresh product gets a standalone local Git repository with no remote. Existing
repositories retain their branch and Git settings. Choose a folder outside another
repository so native hooks resolve the correct product root.

Configure **real required checks** in the product's `.foundry/project.json`. A fresh
installation deliberately starts without checks and cannot claim verification:

```json
{
  "name": "My product",
  "checks": [
    {"name": "test", "command": ["npm", "test"], "cwd": ".", "timeout": 180, "required": true},
    {"name": "build", "command": ["npm", "run", "build"], "cwd": ".", "timeout": 180, "required": true}
  ]
}
```

Adjust those commands to the application's real package and behavior tests. Then:

```sh
python3 scripts/foundry.py start first-feature --spec docs/specs/first-feature.md
python3 scripts/foundry.py status
python3 scripts/foundry.py pause
python3 scripts/foundry.py resume
python3 scripts/foundry.py verify
python3 scripts/foundry.py complete
```

Completion requires fresh passing required checks on the current checkout. Changing
source or check configuration invalidates earlier results. Logs and receipts live in
`.foundry/state/runs/<run-id>/` and stay out of Git by default. Completion writes a
durable `docs/built/` note. The reports are local evidence, not tamper-proof records
or automatic owner approval.

## Reuse and customize

[docs/CATALOG.md](docs/CATALOG.md) maps all 34 original command workflows, 28 native
roles and 67 optional skill bundles. Explicit skills use `$foundry-…`; Codex's native
skill selector provides the command surface. Native lifecycle helpers include finish,
resume and verify. Add your own skills in `.agents/skills/<name>/SKILL.md`.

Enable an optional bundle when a product needs it:

```sh
python3 scripts/foundry.py enable-skill frontend-design
```

The library remains directly readable without enabling every skill in Codex's
initial catalog. Agent roles inherit your configured model. Provider-specific
references describe optional app integrations; they do not change the coding harness.

Review optional native hooks through `/hooks` in Codex. New or changed definitions
need native trust review. Explicit verification works even if hooks are disabled.
See [docs/HOOKS.md](docs/HOOKS.md) and [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md).
Opt into the staged-secret Git hook in each product with
`git config core.hooksPath .githooks` after reviewing it.

Updates come from **our Git repository**. Pull the desired framework version, then
run `python3 scripts/foundry.py install ../my-product --update`. The installer rejects
conflicts before changing files and preserves local managed-file edits for manual
reconciliation. Product AGENTS instructions are retained with a small Foundry block.
It does not change Git hook configuration, create accounts or deploy products.

## Verify the framework

```sh
python3 -m unittest discover -s tests -v
python3 scripts/migrate-catalog.py --check
python3 scripts/security_scan.py --whole-tracked
```

The independently authored [local web example](examples/idea-board/README.md) supplies
an app acceptance target. [docs/VALIDATION.md](docs/VALIDATION.md) records the actual
checks performed, live Codex evidence and remaining limits.

## Preservation and next improvements

Original framework and CLI source, all local inventory hashes and the complete
documentation review are preserved under `upstream/` and `docs/audit/`. Read
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before redistribution. The separately
licensed vendor SaaS skeleton is excluded.

This foundation can later gain our own stack starters, richer acceptance checks,
isolated multi-product dashboards or a management app. The immediate extension points
are ordinary skills, roles, hooks, workflows and project checks; no management service
is needed to build products today.
