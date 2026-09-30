# Workflow

Product Foundry separates conversation, project artifacts, and machine-owned run state.

1. Use `foundry-start` for first intake or a deliberate reroute. It respects authorization already provided and pauses only when a real unresolved decision or external effect needs new authority.
2. Write the concrete scope under `docs/specs/`. Use `foundry-spec` for a bounded change or `foundry-mvp-spec` for the first end-to-end product slice.
3. Start the durable run with `python3 scripts/foundry.py start SLUG --spec PATH`.
4. Implement through `foundry-mvp-build` or the narrowest domain skill. `python3 scripts/foundry.py resume` always resumes the active in-progress run.
5. Run `python3 scripts/foundry.py verify`. The runtime executes the checks declared in `.foundry/project.json` and records receipts.
6. Run `python3 scripts/foundry.py complete`. Completion succeeds only when every required check has a fresh passing receipt for the current source snapshot.

Use `status` to inspect the active run and `pause` to pause it. Runtime files under `.foundry/state/` and `.foundry/state/runs/` are authoritative and must not be edited by skills or agents.

`docs/project/` holds durable product context, `docs/specs/` accepted specifications, `docs/built/` completed feature notes, and `dev/active/` human work notes. A file's existence is context, not proof; verification receipts are the proof used by completion.

User authorization still governs external effects. Ask before spending, connecting accounts, publishing, sending messages, or changing another system. An interrupt pauses work; no hook or workflow may trap the user in an autonomous loop.
