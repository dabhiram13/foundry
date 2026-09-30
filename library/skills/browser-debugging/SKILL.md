---
name: browser-debugging
description: >
  Reproduce and diagnose browser-visible problems fast. Use for "browser debugging", "console error",
  "network issue", "UI bug", "reproduce in browser", "take a screenshot", "playwright debug",
  or when web behavior must be verified visually instead of guessed.
---

# Browser Debugging

Use this as the router for browser-visible problems.

## What This Skill Does

It decides which browser surface to use:

- `agent-browser` for interactive inspection, screenshots, form flows, session reuse
- `testing` for scripted reproduction against the real dev server (`@playwright/test`, `webapp/playwright.config.ts`)
- `fix-test` when the bug is already captured in a failing flow

## Core Rules

1. Reproduce before theorizing.
2. Prefer the smallest tool that exposes the real problem.
3. Capture evidence: trace, screenshot, console, network, semantic DOM state, or video.
4. Keep the loop short: reproduce -> isolate -> fix path.
5. Wait for observable application state, never a blanket `networkidle` or fixed delay.
6. If the issue is already represented by a test failure, use `fix-test` to classify whether the
   defect is in the product, test, data, or environment.

## Standard Workflow

1. Read `references/tool-selection.md`
2. Read `references/reproduction-loop.md`; for an intermittent or CI-only failure, inspect the
   retained Playwright trace before changing code
3. Pull in `references/console-and-network.md` if the bug is runtime/data related
4. Pull in `references/evidence-capture.md` if screenshots or video help

## References

- `references/tool-selection.md`
- `references/reproduction-loop.md`
- `references/console-and-network.md`
- `references/evidence-capture.md`
