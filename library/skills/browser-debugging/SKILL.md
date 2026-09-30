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
3. Capture evidence: screenshot, console, network, DOM state, or video.
4. Keep the loop short: reproduce -> isolate -> fix path.
5. If the issue is actually a test failure, hand off to `fix-test`.

## Standard Workflow

1. Read `references/tool-selection.md`
2. Read `references/reproduction-loop.md`
3. Pull in `references/console-and-network.md` if the bug is runtime/data related
4. Pull in `references/evidence-capture.md` if screenshots or video help

## References

- `references/tool-selection.md`
- `references/reproduction-loop.md`
- `references/console-and-network.md`
- `references/evidence-capture.md`
