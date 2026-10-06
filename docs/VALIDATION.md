# Testing Foundry

Framework verification uses Node 24, local fixtures, and static site checks. It
does not run paid AI or contact provider accounts.

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
package test builds and installs a local candidate tarball globally with normal
npm script handling outside the checkout. It checks the public bin, version
command, excluded files and installed assets, then uninstalls it without
removing the fixture project. The `prepack` hook builds the runtime for a normal
`npm pack`.

Research fixtures cover source limits, public-address checks, redirects,
cancellation, snapshot changes and matching quotations. Network responses use
controlled fixtures.

## Test an integration

Use the [provider integration checklist](QUALIFICATION.md) to test an adapter
with an authorized account. Keep fixture and live results separate, with
reproducible commands and the versions tested.
