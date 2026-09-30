# Workflow

The owner describes the product or change normally. Codex selects skills, handles
paths and configuration, and runs the commands below. Product Foundry's entry
skill handles first installation; an installed product follows its own instructions.

1. Understand the request with `foundry-start`, respecting existing project context.
2. Write scope and acceptance criteria in `docs/specs/`. Use `foundry-spec` for a
   feature or `foundry-mvp-spec` for the first working product version.
3. Track work with `python3 scripts/foundry.py start SLUG --spec PATH`.
4. Inspect the existing application or create the accepted starter. Configure its
   actual behavior tests and build commands in `.foundry/project.json` before
   verification. Handle this yourself rather than asking the owner to edit JSON.
   Preserve existing checks and other configuration. Use commands that exist in
   the selected application; add missing behavior tests when required by the scope.
   Keep absent checks or tools as explicit blockers rather than passing placeholders.
5. Build with `foundry-mvp-build` or the relevant workflow skill. Use
   `python3 scripts/foundry.py resume` to continue the same work after a pause.
6. Run `python3 scripts/foundry.py verify`, resolve required failures, then run
   `python3 scripts/foundry.py complete`. Completion requires current passing results
   for every required check and writes a completed-feature note in `docs/built/`.

Use `status` to inspect current work and `pause` to pause it. The runtime maintains
`.foundry/state/`; skills and agents use its commands rather than editing that state.

Keep product context in `docs/project/`, specifications in `docs/specs/`, and work
notes in `dev/active/`. A document or a finished agent task does not replace checks.
Saved check results are local review evidence, not automatic owner acceptance.

Follow the owner's existing authorization. Ask before spending, connecting accounts,
publishing, sending messages, or changing an external system unless already authorized.
Honor interruptions; hooks must never force work to continue.
