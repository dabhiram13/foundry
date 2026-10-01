# Project record templates

The coordinator fills these from the actual request and observed artifacts, saves
the result in the product's documents, then uses `record --file` or `feedback --file`.
Do not copy placeholder values into the ledger. In particular, supply real source
references, dates, existing record IDs and project-relative paths. Templates use
proposed status so an example cannot silently become an owner decision.

Read [the contract](../WORKFLOW-CONTRACTS.md) for field meanings and gate limits.

- `intake.json`: saved owner context and adaptive task depth.
- `market-evidence.json`: dated claim, segment, workflow and counterevidence.
- `assumption.json` and `decision.json`: uncertain beliefs versus owner decisions.
- `handoff.json`: an artifact with revision inputs, exit criteria and next action.
- `criterion.json` and `observation.json`: behavior requirement and direct evidence.
- `experiment.json` and `feedback.json`: bounded learning and scoped followups.
- `opportunity-thesis.md`: commercial case and disconfirming experiment.
- `design-handoff.md`: six UX handoffs at appropriate depth.
- `release-maintenance.md`: authorized release, recovery and outcome loop.
