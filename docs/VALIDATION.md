# Testing Foundry

Framework verification uses Node 24 and 25, local fixtures, and static site checks. It
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

Connected fixtures also exercise source-backed Research, Plan and Design
approvals, dependent tasks, criterion-level review, altered artifacts, stale
approvals and cancellation-safe source capture. CLI and real stdio MCP journeys
include continuation in a second client and installed candidate-package behavior.
These are local protocol tests, **not a live-model product trial** or proof that
the model follows each role correctly.

## Public website checks

Static checks validate every generated page, local link and anchor, search
assets, metadata, identity and asset budgets. UI-driven checks separately inspect
the landing and docs at narrow mobile, tablet and desktop widths, including
long commands/tables, navigation, search, theme controls, keyboard focus and
reduced motion. Reflow at browser zoom should not clip controls or force page-wide
horizontal scrolling; code and tables may scroll inside their own containers.

Browser results are supporting website evidence, not a replacement for framework
verification. Record browser versions and widths, and leave untested engines
and physical devices unverified.

## Test an integration

Use the [provider integration checklist](QUALIFICATION.md) to test an adapter
with an authorized account. Keep fixture and live results separate, with
reproducible commands and the versions tested.
