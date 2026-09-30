---
name: foundry-mvp-build
description: Run the Product Foundry mvp-build workflow explicitly in Codex.
---

# Mvp Build

Read `docs/WORKFLOW.md` first. Run `python3 scripts/foundry.py resume`, then implement the active accepted spec in small verified increments. Preserve user changes. Run `python3 scripts/foundry.py verify`; fix failures before asking the runtime to complete. Resume the current in-progress run rather than selecting a new pending item.
