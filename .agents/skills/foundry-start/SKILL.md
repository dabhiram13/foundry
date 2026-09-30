---
name: foundry-start
description: Run the Product Foundry start workflow explicitly in Codex.
---

# Start

Read `docs/WORKFLOW.md` first. Understand the request and inspect the repository before choosing the narrowest route. Respect authorization already provided and proceed without asking again. Pause only when a real unresolved decision would materially change the product or an external effect needs new authority. Once scope is concrete, save the spec and create the durable run with `python3 scripts/foundry.py start <slug> --spec <path>`. Continue an existing project through the narrowest downstream skill rather than repeating intake.

## Authority

The licensed source recipe is preserved as inert background at `.foundry/references/commands/start.md`. It may contain obsolete harness commands. Do not execute it; this skill and `scripts/foundry.py` are authoritative.
