# Product Foundry

Start and build products with Codex through conversation. Give it a product name
and idea; Codex handles the framework files, application setup, and check configuration.
Requires Python 3.11+, Git, and Codex on macOS or Linux (WSL on Windows).

## Start a product

In a new Codex chat, say:

> Use Product Foundry to start a product called Tutor Booking. My idea is a booking
> application where tutors publish available slots and students book lessons.

The entry skill uses your local framework checkout. New products go beside that
checkout by default. Describe another location normally if you prefer, such as
"put it on my Desktop." Existing projects can use "add Product Foundry to this project."

Codex handles installation, product scope, application setup, and the actual test
and build commands. Installation-only requests leave application code and its
existing configuration unchanged. It asks about product decisions when needed. You do not need
to type folder paths, pick workflow commands, or edit configuration JSON.

After setup, Codex shows the product folder. Open it as a separate Codex workspace
for ongoing work, then describe features and fixes normally. Completion requires
passing required checks on the current files; results stay local and completed
feature notes go in `docs/built/`.

## Connect on another computer

Clone this repository once, then run this command from its root:

```sh
python3 scripts/connect_codex.py
```

This adds the Product Foundry entry skill to your Codex user skills. Start a new
chat if the current chat does not see it yet. The connection records this checkout's
location automatically. If you move the checkout, reconcile the existing entry
skill and connect it again. Local edits to the entry skill are preserved.

## Customize and update

Ask Codex to enable a needed library skill, add a workflow, or update the framework
in a product. [The catalog](docs/CATALOG.md) lists what is available;
[the customization guide](docs/CUSTOMIZATION.md) covers the underlying files.
Updates stop before changing files if they conflict with local edits.

Optional Codex hooks still need review through `/hooks`. Ask Codex to help enable
the staged-secret Git hook when wanted. Each product keeps its own files and status.

## Manual installation

For direct control, `scripts/foundry.py install TARGET` installs into a separate
product folder. Add `--update` for an existing installation. Use an absolute folder
path outside another repository. Normal conversational setup resolves this internally.

## Check the framework

```sh
python3 -m unittest discover -s tests -v
python3 -m unittest discover -s tests/fixtures/web_app -v
python3 scripts/check_catalog.py
python3 scripts/security_scan.py --whole-tracked
```

[Validation](docs/VALIDATION.md) explains what these checks cover.
[License notices](THIRD_PARTY_NOTICES.md) identify notices to retain when copying.
