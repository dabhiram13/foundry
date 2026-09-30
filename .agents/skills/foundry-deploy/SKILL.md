---
name: foundry-deploy
description: Run the Product Foundry deploy workflow explicitly in Codex.
---

# Deploy

Read `docs/WORKFLOW.md` first. Identify the existing deployment target and its required checks. Build and test locally, inspect the diff and configuration, then request any still-required publish authority immediately before deployment; verify the resulting health and revision. Use `scripts/foundry.py` for lifecycle state; do not handcraft state or receipts.
