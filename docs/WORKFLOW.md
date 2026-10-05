# The Foundry workflow

Foundry has two work sizes backed by the same TypeScript core. A new product
uses Research → Plan → Design → Build → Test → Ship. A bounded existing-repo
change uses scoped `work` commands and does not pretend to have completed the
six-stage product process.

## New product

Research captures context and risks. Plan records the product direction and
criteria. Design defines an implementation approach. The owner reviews and
approves the exact Plan and Design revisions before implementation proceeds.
Build works in bounded tasks, runs configured checks, and allows limited repair.
Test verifies current evidence. Ship writes a local validated summary only; it
does not publish or deploy.

Each explicit `foundry run PROJECT` performs one stage. Interactive `/run`
continues until an approval, completion or failure boundary. Status reflects
saved stage, tasks, provider work, checks and review findings rather than
invented token progress.

## Scoped repository work

Start a scoped run with an existing local spec:

```sh
foundry work start SLUG --spec docs/specs/change.md --project /path/to/repository
foundry work status --project /path/to/repository
foundry work verify --project /path/to/repository
foundry work complete --project /path/to/repository
```

`verify` runs configured checks and reports nested active, check, review and
task state. `complete` records local completion only when evidence permits it.
Pause, resume, stop and recover are explicit. An interrupted or failed command
does not become a pass because a later command returned successfully.

## Roles and review

The neutral role catalog supplies instructions and permission requests to
providers. Roles are policies, not a running agent swarm. A model response does
not grant approval or change the project's billing and check rules. Read-only
review reports findings; owners or authorized implementers decide and repair.

See [saved workflow contracts](WORKFLOW-CONTRACTS.md),
[project customization](CUSTOMIZATION.md), and [provider capabilities](PROVIDERS.md).
