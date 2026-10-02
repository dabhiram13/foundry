# Neutral UI verification record

This is the historical foundation verification before the approved compact-stage
refinement. See [the current verification](STAGE-WORKSPACE-VERIFICATION.md) and
[its build record](built/compact-stage-workspace.md) for the final stage layout,
navigation repairs, build hashes and publication scope.

Implemented locally on 2026-10-02 in the existing Foundry checkout at
`/Users/sridurga/Documents/ChatGPT/product-foundry`, branch `main`, starting from
`b4d8da4b1f4251c08f6bb09a2978e395ace57a90` with a clean tree. No reset, commit, push,
deployment, account change, purchase or live provider run was performed.
All product screenshots below use isolated controlled browser-test products.

## Scope and baseline

The approved Library board, PDF and exact JSON/CSS tokens were materialized on this
executor, their metadata preserved, and their actual pixels inspected. The
[specification](specs/neutral-ui-redesign.md) retains the seven Library IDs and NF-1–7.
The implementation keeps React/shadcn/Tailwind, canonical mark and Factory/provider
semantics; the only server change is a finite static-asset allowlist for bundled
fonts and portraits. Host/origin/token checks remain intact.

Baseline: 173 Python tests passed (eight loopback tests required the permitted
execution context), 12 web fixture tests, five evaluator-contract tests, TypeScript,
catalog and tracked-secret checks passed. The original browser journey also passed.
Bundled Playwright Chromium was absent, so browser runs use installed Google Chrome
through the repository's documented executable override. No lint script is configured.

## Focused final evidence

| Criterion | Evidence |
|---|---|
| NF-1 neutral foundation | Exact rendered dominant pixels include #F1F1F1, #FFFFFF, #E2E2E2, #D4D4D4, #1B1B1B, #777777, #000000 and #474747. Figtree 400/500/600 loaded locally; Lucide source geometry retained. Independent board/render comparison passed. |
| NF-2 real surfaces | Landing CTA, workspace/examples/creation, sidebar, six-stage board, document/activity tabs and account/runtime/specialist settings exercise existing APIs. Stage selection never mutates runtime state. |
| NF-3 portraits | All 28 IDs match configured role files; 18 silhouettes and 28 shape/accessory combinations. All assets decoded. Deterministic re-export produced identical PNG bytes. No per-role activity is invented. |
| NF-4 motion | Actual 13-second, 1280×900 H264 Chrome screencast shows tabs, page navigation, document review, dialogs and specialist filtering. Reduced motion computes 0s; switching it during dialog exit no longer leaves a modal trapping focus. Approval busy state preserves its label and icon width. |
| NF-5 behavior | Full factory browser journey passed: account simulation, examples, two products, sanitized documents, changed-digest and changed-stage rejection, successful approval followed by run failure, missing-check failure/retry, stop/interrupted/retry, failed settings draft, role override/inheritance, reload and keyboard focus. Added delayed artifact Home/Back, 2.6s initial snapshot, old poll after new product creation and real-pointer/repeated-create checks. |
| NF-6 responsive/panel | No page overflow at 1440, 1024, 900, 768, 480, 390 or 360 CSS px. Long document footer remains visible. 390/360 approval labels fit after stacking actions. Mobile toolbar and breadcrumb targets are at least 44px. A 720 CSS-px layout checks the reflow equivalent of a 1440px window at 200%; native browser-zoom behavior was not separately qualified. |
| NF-7 review/build | Independent code review closed navigation/polling/focus findings and reports no material findings. Independent visual review compared source board, actual renders and bot references; final responsive captures supplement it. Typecheck and diff checks passed. Second build produced identical standalone script/CSS and panel bytes. |

The original intermittent second-product timeout did not yield a proven single
root cause. A real stale-snapshot ordering weakness was identified and repaired;
its consequence now has a deterministic regression, and the normal pointer path
is retained. This is not claimed as a proven diagnosis of every earlier timeout.

## Cold aggregate and authoritative result

The final unchanged-source aggregate runs through the normal lifecycle CLI, with
no reused check receipts. All seven configured checks are required: behavior,
factory-ui, catalog, web-app, evaluation-contract, saas-journey and secrets.

```sh
PATH="$PWD/.venv/bin:$PATH" \
FOUNDRY_PYTHON="$PWD/.venv/bin/python" \
MARKETCRAFT_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
.venv/bin/python scripts/marketcraft.py verify
.venv/bin/python scripts/marketcraft.py complete
```

An initial aggregate used the system `python3` child command and could not import
`jwt` and `mcp`; its behavior check failed while the other six checks passed.
The final aggregate prefixes the existing project virtual environment on PATH so
all Python child checks use the installed project dependencies. No dependency or
check requirement was removed.

The CLI creates [the final build record](built/neutral-ui-redesign.md) only after
fresh successful receipts match settled source. That generated record, with its
receipt path and input digest, is the authoritative aggregate outcome; this report
does not replace lifecycle evidence. Run ID: `0366ae33-ac3f-4996-83da-0bff7dc9885e`.

Reproducible output SHA256:

```text
7b7ea5ad5ac2f0cc876bec75cd78f607ce7c5c7baf582c1779ea6128b7f9ab7e  app/app.js
2377b08003ed88b3ba3fcacb50773d3ba220b9901db79d9e0dddbd8d7bf9e4d1  app/style.css
c969014f12af9b5619cbe98b08158f014e00bc8b70838c1dfd9358d714b78502  app/panel.html
```

## Screens and recording

The local preview is `http://127.0.0.1:8766`. Its empty/recent product content comes
from the owner's real local state. The screenshots and video use isolated synthetic
products (Fixture runtime), not fabricated live provider results. Captures are
DPR1 and wait for fonts and transition completion.

- [Landing](../output/playwright/neutral-final/foundry-landing-desktop.png)
- [Stage workspace](../output/playwright/neutral-final/foundry-stage-desktop.png)
- [Exact document review](../output/playwright/neutral-final/foundry-review-desktop.png)
- [Runtime settings](../output/playwright/neutral-final/foundry-runtime-desktop.png)
- [Specialist settings](../output/playwright/neutral-final/foundry-specialists-desktop.png)
- [Mobile review](../output/playwright/neutral-final/foundry-review-390.png)
- [Actual embedded panel, 360px](../output/playwright/neutral-final/foundry-embedded-panel-360.png)
- [Real interaction recording](../output/playwright/neutral-final/foundry-ui-motion.mp4)
- [Capture measurements](../output/playwright/neutral-final/verification-metrics.json)

## Practical limits

The untouched generated `panel.html` was exercised in a controlled postMessage
host using the real MCP Apps SDK handshake and tool calls, in addition to controller
bridge tests. It requests no separate assets, has no broken images, and reports no
browser script errors. It was not installed or qualified in the native Codex host.
Live sign-in, live inference, deployed verification and owner design acceptance
remain separate from these local checks.

Ordinary unthrottled startup was compared using three fresh browser contexts per
version, identical empty state and the real SDK handshake at 360×850. Baseline
HEAD: 889/705/764ms (median 764ms); redesigned: 794/894/832ms (median 832ms).
Both had zero script errors and no separate asset requests. See
[startup comparison](../output/playwright/neutral-final/panel-startup-comparison.json).

A separate cold 360px stress profile with 4× CPU throttling took 11.97s to show its stage
action. Startup long tasks measured 308, 296, 66 and 108ms; the self-contained panel
is about 2.7MB. This is a measured startup limitation, not a production performance
qualification. The runtime renders static images rather than 28 canvas renderers
or continuous avatar loops. No work was published or paid services enabled.
