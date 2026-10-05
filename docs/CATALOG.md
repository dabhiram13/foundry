# Roles and reference catalog

Foundry ships a neutral role catalog at `.foundry/roles.json`. `foundry roles`
lists the roles available to the runtime. Stage assignments are project
configuration; a role describes work and requested permissions, not an
independent execution engine.

The repository also retains vendor skills and recipes as optional reference
material. They are not downloaded, automatically installed, or executed as
plugins. Read their source and license before adopting a practice; copy or adapt
only material that the project owner has selected. No removed Python skill
installer or browser/MCP integration is available.

`node scripts/check_catalog.mjs` checks the active skill inventory, native role
TOML, provenance references, explicit-invocation policy, and minimum retained
reference catalog. Current counts and licensing evidence are preserved in
`library/provenance.json` and `docs/PROVENANCE.md`; inventory counts
do not prove a capability is supported or qualified.
