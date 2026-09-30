# Codex hooks

Product Foundry uses one small dispatcher, `scripts/hooks.py`, for each configured lifecycle event. The dispatcher is optional guidance around the explicit workflow in `docs/WORKFLOW.md`; it is not the workflow engine and missing hooks never prove a run complete.

## Enable and review

Codex discovers `.codex/hooks.json` after the project layer is trusted. Open `/hooks` in Codex, inspect the exact command definitions, and trust the current hash. A changed hook is skipped until its new definition is reviewed. There is intentionally no trust bypass.

The hook command resolves the Git root before launching the dispatcher, and the dispatcher independently walks upward from the event `cwd` until it finds `.foundry/project.json`. The installer therefore requires Git, initializes a local `main` repository for a fresh standalone target, and rejects targets nested under a different repository. It does not add a remote or change Git hook settings. This keeps events started from project subdirectories attached to the right project.

## Behavior

- `SessionStart` and `PostCompact` point Codex to `docs/WORKFLOW.md`, the active `.foundry` run, and `python3 scripts/foundry.py status`.
- `PreCompact` atomically saves a small `checkpoint.json` beside the active run state. It does not copy the transcript or emit unsupported context.
- `Stop` reports a still-active run as a warning. It never claims success and never forces another model turn.
- `Interrupt` exits immediately without a continuation decision, so user interruption is always honored.
- `PreToolUse` parses native `apply_patch` `Add`, `Update`, `Delete`, and `Move to` headers. It denies paths that resolve outside the project. While a run is active, an optional `brief_budget.include` list in `.foundry/project.json` limits edits to matching shell-style path patterns.
- `PreToolUse` also denies a deliberately narrow set of destructive Git commands: hard reset, destructive clean, force push, history filters, and reflog expiry.

Codex sends `apply_patch` as `tool_name: "apply_patch"` with the patch text in `tool_input.command`. The dispatcher returns the documented `hookSpecificOutput.permissionDecision: "deny"` shape only when it has a definite policy match. Malformed input and dispatcher failures print a short error to stderr and exit zero without a decision.

## Secret scanning

`.githooks/pre-commit` runs `scripts/security_scan.py --staged`. Framework tests run in this repository's verification checks rather than in every installed product commit. The scanner reads exact blobs from Git's index, including paths with spaces. A working-tree edit cannot hide a different staged secret. Output contains only path, line number, secret family, and `[REDACTED]`.

For a release audit, run:

```sh
python3 scripts/security_scan.py --whole-tracked
```

The scanner uses high-confidence provider key signatures and private-key headers. It intentionally does not guess whether arbitrary `password=`, `token=`, URLs, fixtures, or prose are secrets.

Activate the versioned Git hook once per clone with:

```sh
git config core.hooksPath .githooks
```

## Limits

Hooks are local guardrails, not a security boundary. Codex documents that tool-hook errors, timeouts, malformed responses, some specialized tools, and untrusted or disabled project hooks can proceed without a block. The Codex sandbox, approval policy, repository permissions, review, and explicit runtime verification remain authoritative. Shell parsing is intentionally limited to ordinary command segments; aliases, generated scripts, interpreters, and semantic equivalents can bypass the Git recognizer. The secret scanner detects known token formats, not every credential.

Reference: [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks).
