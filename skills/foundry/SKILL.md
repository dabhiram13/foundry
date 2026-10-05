---
name: foundry
description: Guide an idea, feature, or fix through Foundry with adaptive depth, evidence, UX handoffs, scoped implementation, and real checks.
---

# Foundry

The framework checkout is `{{FRAMEWORK_ROOT}}`. Read its `docs/WORKFLOW.md`,
`docs/WORKFLOW-CONTRACTS.md`, `docs/COMMANDS.md`, and `docs/PROVIDERS.md`. Foundry
is one Node 24 executable; its source-built CLI, installed CLI, and interactive
terminal share the same core.

1. Read the idea/change and workspace instructions. The owner makes product decisions;
   choose the next useful action at small, feature, or product depth. A planning or
   review request authorizes that scope only. Use the guide for a read-only next
   step, not as permission to implement, spend, connect, or publish.
2. Continue in the existing product when requested. New products default to the
   caller-owned `~/.foundry/products` directory. Use an owner-provided path when
   supplied; `--products-dir PATH` explicitly selects another location. Do not
   move legacy `../products` automatically. Resolve an ambiguous target before
   creating anything.
3. Build the framework checkout with Node 24, then initialize an existing
   repository with `./foundry init --project ABSOLUTE_PATH`. Normal init refuses
   an existing unmarked `.foundry`; inspect legacy data with
   `./foundry migrate --project ABSOLUTE_PATH --dry-run` before explicit `--apply`.
   Use `init --recover` only for a pending installer. Preserve owner files,
   settings and checks; managed updates refuse edited files unless recovered safely.
4. Installation-only requests end with the setup result. For authorized product
   work, use the shared workflow: `./foundry run PROJECT` advances one stage;
   terminal `/run` continues to an approval, completion or failure boundary.
   Review and approve the exact Plan or Design revision shown. Research only
   decision-changing uncertainty: dated evidence and assumptions feed the product
   brief and criteria. Competitor offers and synthetic personas are not
   demonstrated customer demand. Reuse valid existing product artifacts.
5. For UI work follow the six UX handoffs at the selected depth. Keep the adopted
   product direction authoritative over generic aesthetic recipes. Configure real
   project checks and use native scoped delegation where available. Reviewers are
   read-only; the coordinator owns integration and final lifecycle transitions.
6. Report the selected product folder, implemented or reviewed outcome, actual
   evidence, and blockers. A separate Codex workspace may require opening that
   folder. Distinguish local verification, deployed verification, and owner
   acceptance. Preserve model and reasoning inheritance, and inspect
   project-supplied agent commands before running them.

Existing authorization remains valid. Missing capabilities never authorize a new
account, paid API, subscription change, or publishing action. Billing always
requires explicit owner consent. If the framework checkout is unavailable,
explain how to reconnect its current location. Do not fetch a substitute
framework or change unrelated projects.

Historical names such as `marketcraft` and `product-foundry` identify retained
instruction entries only; they do not select a Python runtime. Do not invoke
removed Python, browser-panel or MCP commands.
