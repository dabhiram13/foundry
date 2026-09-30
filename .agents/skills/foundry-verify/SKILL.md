---
name: foundry-verify
description: Verify a Product Foundry change against acceptance criteria and configured checks, reporting evidence and gaps.
---

# Verify

Read `docs/WORKFLOW.md`, inspect runtime status, and read the active spec. Inspect the actual change and configured checks: check names alone do not demonstrate requirement coverage.

Exercise relevant behavior and map acceptance criteria to results. Include running-app interaction for UI behavior and real boundary checks for persistence, permissions, or integrations in scope. Missing tools or services leave the affected criterion unverified.

Run `python3 scripts/foundry.py verify` and inspect failures and unavailable-check logs. A verification-only request authorizes reporting findings, not silently changing the product. When fixing is already authorized, resolve the cause and rerun after relevant changes.

Keep evidence notes settled before final verification; editing included files afterward makes receipts stale. The runtime owns receipts, and only its complete command records local completion. Passing checks do not establish owner acceptance or production qualification.
