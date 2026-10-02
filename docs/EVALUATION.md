# Journey evaluation

Foundry's SaaS evaluation exercises a real local application and preserves
revision-bound HTTP and browser evidence. The application is a **fixed disposable
fixture**. A green result does not prove that a native agent generated the app,
selected the right skills, or delivered a production integration.

## Run the evaluation

```sh
python3 scripts/evaluate_journey.py
```

Default behavior requires both HTTP and browser stages. `--http-only` and
`--browser-only` are deliberate narrower checks: the omitted stage remains
`UNVERIFIED` and is not required **for that scoped run**. Do not describe an
HTTP-only pass as browser validation.

Every invocation makes a unique directory beneath `output/playwright/journey/`
and prints the path to `report.json`. Use `--output-dir PATH` to select another
parent directory; existing evidence is not overwritten. Exit codes are:

| Exit | Result | Meaning |
|---|---|---|
| 0 | PASS | All stages required by this invocation passed |
| 1 | FAIL | A required behavior, evidence contract or execution failed |
| 2 | UNVERIFIED | Required runtime/browser/process capability was unavailable |

Real-provider qualification and native-agent delivery always remain explicitly
`UNVERIFIED` in this report. They require separate evidence rather than a more
optimistic fixture label.

## Existing browser dependencies

Requirements: Python 3.11+, Git, POSIX process groups and `ps` (macOS/Linux/WSL),
IPv4 loopback permission, Node.js, an existing Playwright or playwright-core package,
and Chromium/Chrome. No evaluation command installs or downloads anything.

Container verification requires an init process that reaps orphaned descendants.
CI uses Docker `--init`. For an existing container whose PID 1 does not reap
children, run checks beneath an available Tini subreaper, for example
`/usr/local/bin/docker-init -s -g -- python3 scripts/marketcraft.py verify`
for an active run, or the same prefix before a unittest command. Use the actual
installed Tini path. This preserves the child-termination assertions; a terminated
but unreaped zombie still has a PID and must not be called successful cleanup.

After checkout, CI adds only `$GITHUB_WORKSPACE` to the job user's global
`safe.directory` list. The pinned checkout action uses temporary global Git
configuration for its own commands and removes it before later steps. The explicit
job entry lets the index scanner inspect the mounted checkout despite container
ownership differences; it does not trust unrelated repositories or disable Git's
ownership checks. The scanner inherits the job environment unchanged.

When the package and browser are installed conventionally, Node resolves the
package and Playwright uses its matching installed Chromium. Explicit overrides
support existing installations without hardcoding a developer's filesystem:

```sh
export MARKETCRAFT_PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright
export MARKETCRAFT_BROWSER_EXECUTABLE=/absolute/path/to/chromium
python3 scripts/evaluate_journey.py
```

Equivalent flags are `--playwright-module PATH` and `--browser-executable PATH`.
`--node PATH` or `MARKETCRAFT_NODE` selects Node. Missing packages, failed browser
launch, blocked loopback or missing process-inspection permission are reported;
there is no success-producing skipped browser test.

The checked-in CI workflow uses Playwright 1.63.0 with the matching
`mcr.microsoft.com/playwright:v1.63.0-noble` image and `npm ci --ignore-scripts`
from the committed lockfile. Package checksums were checked against the public
npm registry. CI was configured but was not executed in this local change.
For an explicitly authorized local setup, `npm ci --ignore-scripts` followed by
`node node_modules/playwright/cli.js install chromium` provisions that pinned
tooling. Existing compatible tooling can be selected with the overrides above.
Normal verification invokes only the evaluator and never performs setup. See
[Playwright's CI documentation](https://playwright.dev/docs/ci) for host dependencies.

The browser suite blocks requests to origins other than its own loopback server.
It creates synthetic accounts and an isolated SQLite database, restarts that
server for persistence checks, then closes its browser and deletes the database.
Timeout and interruption cleanup handles the owned process group and observed
detached child groups (Chromium uses one). Process arguments from unrelated apps
are not collected. An interrupted run does not start the next stage.

## Acceptance-to-evidence matrix

| Requirement | Direct behavior | Evidence |
|---|---|---|
| Session authentication | Register/login, wrong-password denial, authenticated routes, logout revocation | `test_app.py`; browser `AUTH-EMPTY` |
| Tenant boundary | Account B cannot list, read or mutate account A's brief; no debit on denied access | HTTP negative tests; browser `TENANT-UI` |
| Persistence | Saved outline, balance and session survive a real server restart | HTTP restart and browser `RETURN-RESTART` |
| Entitlement | Free plan denied; demo plan grants three credits once; exhausted balance denied | HTTP tests; browser `ENTITLEMENT` |
| Retry integrity | Concurrent duplicate IDs produce one debit; key reuse across resources conflicts; lost committed response replays after restart | Real HTTP/SQLite tests |
| Refresh after commit | Abort the session or brief-list GET after a successful outline POST; visible retry preserves the request key, response and actual balance | Browser `REFRESH-RETRY-SESSION`, `REFRESH-RETRY-LIST`; screenshots `09`–`11` |
| Failure recovery | Deterministic provider failure saves no result and consumes no credit; same request can retry | HTTP test; browser `PROVIDER-FAILURE` and `SAVE-RETRY` |
| Input/security boundary | CSRF/Host/Origin checks, malformed bodies, limits, invalid keys/routes, safe user-text rendering | HTTP negatives; browser runtime observation |
| Empty/loading/error UI | Useful empty state, live loading status, disabled pending action, focused error with retry | Screenshots `01` through `05`; browser criteria |
| Keyboard and mobile | Keyboard signup/save/retry, skip link, logical result/error focus, labelled inputs, 44px buttons, no 375px overflow | Browser `UX-LOADING-KEYBOARD`, `MOBILE-A11Y`; mobile screenshot |
| Guided review and recovery | Review, back/edit, reload draft resume, invalid-title focus and save recovery | Browser `GUIDED-EDIT-RESUME`; review screenshot |
| Meaningful activation | First committed outline once per account; retry/restart/concurrent/later saves cannot duplicate it; rollback emits nothing | 14 HTTP tests in total; browser `ACTIVATION-ONCE` |
| Evidence honesty | Missing browser cannot pass; empty success without report fails; canceled/timed-out detached children stop | `test_evaluator.py` |

The provider and plan are controlled doubles. Authentication, tenant filtering,
SQLite commits, sessions, HTTP requests, rendering and keyboard navigation are real.
The local ledger establishes exactly-once debit for this deterministic operation;
it does not certify an arbitrary external provider's exactly-once effects.

## Evidence and review

`report.json` records the Git revision, dirty-worktree state, fixture/runner content
digest, exact commands, per-stage exit status and elapsed time, and evidence paths.
It rejects source changes during a run. Artifact receipts include file size and
SHA-256. The browser report includes browser/Node/Playwright versions, criterion
results, expected versus unexpected failed requests, console/page errors and
targeted accessibility observations.

The browser directory retains thirteen screenshots, `trace.zip`, `browser.json` and
the local server log. Inspect the screenshots for visual coherence, content and
layout; replay the trace for step-by-step behavior using the already installed
Playwright trace viewer. Automated checks cannot substitute for that judgment,
customer usability research or a complete accessibility audit.

Mobile screenshots use actual viewport captures: `07-mobile-keyboard.png` shows
the top/form focus, and `07b-mobile-result.png` shows the saved result below. Capture
metadata records viewport dimensions, scroll position and document height. This
avoids intermittent stale-tile artifacts observed with tall full-page captures in
the local Chrome build; it does not stitch or alter screenshot pixels.

Run evaluator-contract tests separately (they do not need browser dependencies):

```sh
python3 -m unittest discover -s tests/fixtures/saas_app -p test_evaluator.py -v
```

Those tests still need process-inspection/control permission to prove child cleanup.
Keep evidence private: traces contain deliberately synthetic credentials. Do not
reuse this fixture with real accounts or unrelated product data.

## Native delivery evaluation remains a separate gate

A future native-delivery campaign must start with independent fixed prompts and
fresh product repositories. Include a new product, existing-product change,
reproduced bug, interruption/resume, unavailable integration and planning-only
request. Include a non-Next.js product. Preserve the requested model/permissions,
activation and handoff events, revision-bound artifacts, owner interventions,
rework and available usage. Unknown usage stays unknown.

Evaluate routing/activation, instruction adherence, resulting product behavior and
efficiency separately. Repeat representative journeys on independent fresh runs;
negative cases should remain blocked or unverified. A generated app can reuse
these **criteria**, but must configure checks against its own implementation.
Running this fixed fixture alongside an unrelated broken application is not
evidence that the application works.

The current full journey has 13 browser criteria. Use the [UX rubric](UX-RUBRIC.md)
for visual and interaction review, keeping automated observations distinct from
human judgment. Activation data uses a synthetic local event and no analytics
vendor; it does not establish acquisition, retention or commercial demand.
