# Managed storage containment

Managed session storage holds the identity file, session database and launch
records. It must stay outside the project so project edits cannot reach it.

## Acceptance

- MS-01: Managed storage is rejected when it is the project, inside the project
  or a parent of the project. A folder name that starts with two dots, such as
  `/p/..store`, counts as inside. Paths are compared after resolving existing
  links, and the check uses the same containment rule as OpenCode runtime storage.
- MS-02: Storage that is really outside the project, such as `/other/store` or
  a sibling named `/p..store`, is still accepted.
- MS-03: Runtime, managed executor, packaging, public site, tooling, catalog and
  secret checks pass.

## Limits

No change to the default storage location, session records, profiles or the
private directory rules. Local fixtures only; no live model provider is used.
