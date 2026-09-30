# Workflow

1. Use `$foundry-start` to discuss the product or current request.
2. Write scope and acceptance criteria in `docs/specs/`. Use `$foundry-spec` for a
   feature or `$foundry-mvp-spec` for the first working product version.
3. Track the work with `python3 scripts/foundry.py start SLUG --spec PATH`.
4. Build with `$foundry-mvp-build` or the relevant workflow skill. Use
   `python3 scripts/foundry.py resume` to continue the same work after a pause.
5. Run `python3 scripts/foundry.py verify`. It executes checks from
   `.foundry/project.json` and saves their results and logs.
6. Run `python3 scripts/foundry.py complete`. It requires current passing results
   for every required check and writes a completed-feature note in `docs/built/`.

Use `status` to inspect current work and `pause` to pause it. The runtime maintains
`.foundry/state/`; skills and agents must use its commands rather than edit that state.

Keep product context in `docs/project/`, specifications in `docs/specs/`, and work
notes in `dev/active/`. A document or a finished agent task does not replace checks.
Saved check results are local review evidence, not automatic owner acceptance.

Follow the owner's existing authorization. Ask before spending, connecting accounts,
publishing, sending messages, or changing an external system unless already authorized.
Honor interruptions; hooks must never force work to continue.
