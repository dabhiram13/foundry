# Validation and limits

Framework verification uses Node 24, local fixtures, and static site checks. It
does not run paid AI, contact provider accounts, or test a browser workspace.

## Required project gates

The standard aggregate is `npm test`. It runs each of these groups once:

- `npm run check:runtime`: runtime typecheck/build/tests and isolated package test.
- `npm run check:site`: site typecheck/build/content and local-link checks.
- `node --test tests/tooling.test.mjs`: exact-index secret-scanner and catalog
  regression fixtures.
- `node scripts/check_catalog.mjs`: active catalog integrity.
- `node scripts/security_scan.mjs --whole-tracked`: high-confidence secret scan
  over tracked files.

CI uses the same Node-only runtime and static checks with pinned actions. The
package test builds and installs the private tarball outside the checkout with
Python absent; it checks the one public bin, excluded files and installed
assets. Framework browser, Python and MCP test paths have been removed, not
silently skipped.

## What results mean

Local fixtures verify contracts and deterministic behavior only. They do not
qualify live provider inference, payment behavior, external services or
deployment. A successful local Ship summary is not publication. Product
acceptance still requires the product's own relevant behavior and accessibility
checks.

Current qualification boundaries are listed in [qualification status](QUALIFICATION.md).
