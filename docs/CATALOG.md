# Roles and reference catalog

Foundry ships a neutral role catalog at `.foundry/roles.json`. `foundry roles`
lists the roles available to the runtime. Stage assignments are project
configuration; each role describes work and requested permissions.

The 28 role definitions are not 28 automatically running agents. Adapter mode
uses relevant stage roles through your selected provider. Connected work sends
the selected role's instructions, inputs and expected output to your existing
coding client, which may follow them sequentially or use native subagents.
The same client reporting several roles is not independent model verification.
See [the product workflow](WORKFLOW.md) and [connected setup](CONNECTED-CLIENT.md).

The repository includes optional skills and recipes for contributors. Read their
source and license before adopting them. Select and invoke them explicitly.

`node scripts/check_catalog.mjs` checks the active skill inventory, native role
TOML, provenance references, explicit-invocation policy, and minimum retained
reference catalog. Current counts and licensing evidence are preserved in
`library/provenance.json` and `docs/PROVENANCE.md`.
