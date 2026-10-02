# Compact stage workspace verification

Verified locally on 2026-10-02 against the approved neutral redesign and selected
option 3 refinement in [the specification](specs/neutral-ui-redesign.md). The owner
authorized scoped commit/push and exact-commit GitHub CI verification. Deployment,
account changes, purchases and live provider runs remain outside this work.
Baseline: `b4d8da4b1f4251c08f6bb09a2978e395ace57a90`, existing `main` checkout.

## Reference and implementation

The exact annotation (`libfile_2f625c6386bc8191822dc27712d9e26a`, version 0,
422×154) and refined option 3 (`libfile_b9f75ed9a7c88191974a50742ff2e913`,
version 1) were materialized on the implementing Mac, their Library metadata
preserved and their pixels inspected. The annotation rejects the permanent black
left selection stripe in the reference. The implemented stages use no stripe,
connector line or heavy selected outline.

The wide layout has a 200px stage column with 56px rows and 22px markers. Gray
selection, label weight and status icons show the viewed stage; `aria-current`
identifies the real runtime stage and `aria-pressed` the inspected stage. Keyboard
focus alone has a 2px outline. Narrow layouts retain compact rows in a horizontal
scroll region. The right side is one white, fine-border, 12px-radius panel with
header, 24px body padding, light action band and separated documents. Previous and
upcoming stage inspection replaces its content without advancing the runtime.

## Fresh checks

| Requirement | Direct evidence |
|---|---|
| NF-1–3 foundation and portraits | Existing neutral/Figtree/Lucide foundation, canonical mark and all 28 portrait assets retained. Independent review confirmed all portrait/font bytes inline in the generated panel and no separate asset paths. |
| NF-4 motion | Real Chrome screencast shows stage selection, tabs, review, settings and specialist filtering. Reduced motion computed 0s. Existing reduced-motion dialog exit and stable approval controls remain covered. |
| NF-5 state and recovery | Full real HTTP/Factory browser journey passes: account simulation, pointer/repeated create, stop/interruption/retry, provider failure/retry, failed settings draft/recovery/inheritance, sanitization, exact/changed/stale approval, reload, delayed initial and stale polling snapshots, Home/Back navigation, and MCP bridge routing. |
| NF-6 responsive/panel | Captured 1440 desktop, 1024/900/768 tablet and 480/390/360 narrow layouts with no page overflow. Review footer and labels fit at 390/360. Actual generated panel runs through real SDK initialization/tool calls in a controlled 360px iframe host, with no broken images, separate asset requests or script errors. 720 CSS pixels checks 1440-at-200% layout equivalence. |
| NF-7 review and build | Independent code and visual reviews report no material remaining findings. `npx tsc --noEmit`, `git diff --check`, focused UI/server tests and browser journey pass. Two consecutive builds produce identical bytes. The cold aggregate result is recorded by the lifecycle CLI below. |
| NF-8 compact selection | Browser asserts 6 stages, 56px row height, exact settled gray selection, no permanent border/shadow/pseudo-element stripe, and a 2px keyboard-only focus outline. Source/visual audit found no equivalent permanent stripe elsewhere. |
| NF-9 panel/navigation | Browser exercises future/past/current selection, no future execution or past approval, and no nested surfaces. Delayed document responses after stage and tab navigation are invalidated. Independent reviewer reproduced the prior defect and reran both repairs successfully. |
| NF-10 publication | Scope is the existing approved neutral redesign plus this refinement. Publication uses a reviewed staged diff, exact-index secret scan, safe main fast-forward and exact-SHA GitHub workflow checks; the delivery report identifies the resulting SHA and run. |

An initial browser run exposed a concrete navigation focus race: the name field
contained the beginning of the brief and the idea field stayed empty. Explicit
New product navigation and its later hashchange each queued name focus. Focus is
now applied once after rendering; the hashchange cannot repeat it. Rapid input
assertions retain the exact field values, and an independent 390px check confirms
focus stays in the idea field after the navigation sheet closes. This establishes
the observed failure mechanism without claiming every historical timeout had the
same cause.

The initial added tests needed two test-only corrections: stage numbers are
decorative and absent from accessible names; computed color is asserted after
the approved selection transition settles. No product requirement was weakened.

## Cold aggregate

The final source is verified through the normal lifecycle command, with the
existing project virtual environment first on PATH so Python child checks load
the declared dependencies. No requirements are removed or receipts reused.

```sh
PATH="$PWD/.venv/bin:$PATH" \
FOUNDRY_PYTHON="$PWD/.venv/bin/python" \
MARKETCRAFT_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
.venv/bin/python scripts/marketcraft.py verify
.venv/bin/python scripts/marketcraft.py complete
```

Required checks: behavior, factory-ui, catalog, web-app, evaluation-contract,
saas-journey and secrets. Run ID: `10b6d2e1-0be0-469b-aa31-0de52e4583bb`.
The runtime-generated [build record](built/compact-stage-workspace.md), produced
only on successful fresh completion, is authoritative for the aggregate.

Reproducible SHA256 values:

```text
16620e9b1f43cb96d506afdb8482b71b9fa684932ea12f6b86acc1cc856d7a89 app/app.js
ae8b06746343d55e6382801b951a3804fd2808eb3af7ce6669f6c3dbc8de40e4 app/style.css
061caac733efd974edda47b0acc97cd14b6625026ba27eeed22253428df7fb0c app/panel.html
```

## Captures and limits

Final DPR1 screenshots, real interaction recording and measurement JSON are saved
in `output/playwright/refined-final/` locally, with selected deliverables saved to
the owner's private Library. They use isolated synthetic products and controlled
runtime doubles. The owner's existing preview at 127.0.0.1:8766 was preserved.

Native installed-host qualification, native browser zoom, screen-reader
conformance, live sign-in/inference, deployed verification and owner design
acceptance are not established by these local fixtures. No new paid dependencies
or services were introduced. An optional visual polish remains: document paths
can wrap mid-token at some intermediate widths; they remain readable and unclipped.

The earlier [neutral verification record](NEUTRAL-UI-VERIFICATION.md) preserves
historical foundation evidence and its original limitations; this report and the
new build record supersede its app hashes and stage-layout evidence.
