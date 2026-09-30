# Product Foundry

Build products with Codex using reusable workflows and recorded checks.

Read `README.md` for setup and `docs/WORKFLOW.md` before product work. Follow the
owner's existing instructions, scope, and stack. Use `docs/CATALOG.md` to choose
skills and roles; read only what the task needs.

Use `python3 scripts/foundry.py` to install the framework, track work, and run
checks. Resume existing work before starting another feature. Delegate independent
tasks with separate write boundaries and wait for their results. Keep scope in
`docs/specs/`, product decisions in product documents, and check results in the
runtime's saved reports. Skills and agents must not edit `.foundry/state/` directly.

Run relevant behavior tests and configured required checks before completion.
Preserve user edits and records, honor interruptions, and report missing evidence.
Get authorization for spending, connecting accounts, and publishing; existing user
authorization remains valid. Use the user's configured model. Preserve copyright
and license notices when copying bundled material.

For framework changes, run the commands under "Check the framework" in `README.md`.
Keep framework development separate from product repositories. Each product needs
its own checks for application behavior and service integrations.
