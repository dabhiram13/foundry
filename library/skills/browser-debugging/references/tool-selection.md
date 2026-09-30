# Tool Selection

Choose the narrowest tool that can expose the bug.

Use:
- `agent-browser` for interactive page inspection, screenshots, login/session reuse, form work
- `testing` for deterministic scripted reproduction (`@playwright/test` against the real dev server)
- `fix-test` when the failure is already represented by a broken test

Do not use all tools at once.
Pick one, get evidence, then escalate only if needed.
