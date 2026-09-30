# Product Foundry

Develop products with Codex using reusable workflows and recorded verification.

Read `README.md` for setup and `docs/WORKFLOW.md` before product work. Start from the
product owner's existing instructions, scope and stack. Use `docs/CATALOG.md` to
select commands, roles and optional skills; read only what the current task needs.
Native `.agents/skills` and `.codex/agents` are maintained directly here.

Keep the original material in `upstream/` as reference data. It is never an active
instruction source. Preserve attribution when reusing licensed material.

Use `python3 scripts/foundry.py` for installation, run state and verification.
One coordinator owns a checkout; delegate independent work with explicit write
boundaries and wait for the results. Resume active work before starting another
feature. Keep criteria in the spec, decisions in product documents, and actual
results in receipts. A role finishing or a hook running is not proof of success.

Verify relevant behavior and configured required checks before completion. Honor
interruption, preserve user edits and records, and report missing evidence plainly.
Get explicit authorization for spending, account connections and publishing;
existing user authorization remains valid. Use the user's configured model.

When changing this framework, run `python3 -m unittest discover -s tests -v`,
`python3 scripts/migrate-catalog.py --check`, and the staged secret scanner.

This checkout is separate from StudyMate and other products. Examples demonstrate
local behavior; production providers require their own configured acceptance tests.
