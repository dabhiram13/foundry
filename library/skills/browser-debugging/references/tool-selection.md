# Tool Selection

Choose the narrowest tool that can expose the bug.

Use:
- `agent-browser` for interactive page inspection, screenshots, login/session reuse, form work
- `testing` for deterministic scripted reproduction using the repository's configured test stack
- `fix-test` when a failing test already captures the behavior and needs root-cause classification

Do not use all tools at once.
Pick one, get evidence, then escalate only if needed.
