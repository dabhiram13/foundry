# Provenance

This note records facts checked in this repository's Git history. It is not a legal
opinion or a conclusion about rights beyond the retained notices.

- Commit `358806f` ("Initialize independent Codex-native Product Foundry") recorded
  a local delivery of BuildThisNow CodeKit 0.3.0. Its
  `upstream/LICENSE-codekit.md` contained an MIT license with copyright
  "2026 Speedy Devv". Its `.foundry/references/PROVENANCE.md` described migration
  of supplied framework recipes and a Codex-native lifecycle.
- That commit's `upstream/provenance.json` recorded the supplied framework and CLI
  archives as reference data, not active runtime dependencies, and explicitly
  stated that no vendor SaaS skeleton was included. The historical provenance
  note distinguished the separately advertised skeleton and its separate terms.
- Commit `d2980d4` ("Simplify framework docs and remove unused import material")
  removed the archives, old reference commands, licensing/provenance notes, and
  audit exports from the current tree. Removal is not evidence of new authorship
  or a change to any license. The material remains inspectable in local history.

Current framework notices remain in `LICENSE`, `THIRD_PARTY_NOTICES.md`, and the
installed copies under `.foundry/`. Bundled skills have mixed provenance;
`library/provenance.json` retains supplied source evidence and acknowledges missing
upstream revisions. Missing origin information is not proof of ownership, and a
local integrity hash is not an upstream revision or license determination.

Foundry is the current product name. Marketcraft and Product Foundry are historical
names retained in instruction aliases and persisted records, not separate runtime
entry points. Renaming does not alter origin or licensing.
Preserve notices with copied material. Any future adoption needs an identified
source/revision, applicable notices, dependency review, and a demonstrated use case;
this change imports no additional skills or proprietary skeleton.
