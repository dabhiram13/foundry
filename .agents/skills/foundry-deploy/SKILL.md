---
name: foundry-deploy
description: Prepare and execute an authorized product release, checking the deployed revision and relevant behavior.
---

# Deploy

Read `docs/WORKFLOW.md`, the active request, application configuration, and the actual deployment target. Determine existing release authority. A request to prepare a release does not itself authorize publishing.

Inspect the diff and required checks. Prepare configuration, secrets handling, migration order, and recovery/rollback steps appropriate to the change. Use the existing provider tooling and current official documentation; do not connect accounts or provision paid resources implicitly.

Complete locally required checks and make the exact result reviewable before requesting any still-missing publish authority. If already authorized, proceed within that scope. After deployment, check the revision, health, and a meaningful changed user journey. A provider's successful upload message alone is insufficient.

Record the actual release result and blockers in the product's existing release/work notes. Failed release does not erase local verification, and local verification does not prove production success. Recurring monitoring needs its own request.
