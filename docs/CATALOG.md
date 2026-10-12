# Roles and reference catalog

Foundry includes 28 specialist roles in `.foundry/roles.json`. Run `foundry roles`
to list them. Each role defines a job and the permissions it asks for.

Roles do not run all at once. From the terminal, your chosen provider follows
the roles needed for each stage. In OpenCode, your coding tool receives the
selected role's instructions, inputs and expected result. It can do the work
itself or use its own subagents. Multiple role reports from the same coding
tool are not independent reviews.
See [the product workflow](WORKFLOW.md) and [connected setup](CONNECTED-CLIENT.md).

The repository includes optional skills and recipes for contributors. Read their
source and license before adopting them. Select and invoke them explicitly.

`node scripts/check_catalog.mjs` checks the active skill inventory, native role
TOML, provenance references, explicit-invocation policy, and minimum retained
reference catalog. Current counts and licensing evidence are preserved in
`library/provenance.json` and `docs/PROVENANCE.md`.
