#!/usr/bin/env python3
"""Small Codex hook dispatcher for Marketcraft projects."""

from __future__ import annotations

import fnmatch
import json
import os
import re
import shlex
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MARKER = Path(".foundry/project.json")
PATCH_PATH = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$")
PATCH_MOVE = re.compile(r"^\*\*\* Move to: (.+)$")


def project_root(data: dict[str, Any]) -> Path:
    """Find the project from the hook cwd, even when Codex starts below root."""
    raw = data.get("cwd")
    start = Path(raw).expanduser() if isinstance(raw, str) and raw else Path.cwd()
    try:
        start = start.resolve()
    except OSError:
        start = Path.cwd().resolve()
    for candidate in (start, *start.parents):
        if (candidate / MARKER).is_file():
            return candidate
    # The hook is part of the project, so this is a stable fallback in tests and
    # before `foundry init` creates its marker.
    return Path(__file__).resolve().parent.parent


def deny(reason: str) -> dict[str, Any]:
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


def patch_paths(command: str) -> list[str]:
    paths: list[str] = []
    for line in command.splitlines():
        match = PATCH_PATH.match(line) or PATCH_MOVE.match(line)
        if match:
            paths.append(match.group(1).strip())
    return paths


def within_root(root: Path, raw: str) -> bool:
    if not raw or raw == "/dev/null":
        return True
    target = Path(raw).expanduser()
    if not target.is_absolute():
        target = root / target
    try:
        target.resolve(strict=False).relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def _active_state(root: Path) -> tuple[Path, dict[str, Any]] | None:
    active_path = root / ".foundry/state/active.json"
    try:
        active = json.loads(active_path.read_text(encoding="utf-8"))
        run_id = active.get("run_id")
        if not isinstance(run_id, str) or not run_id:
            return None
        uuid.UUID(run_id)
        state_path = root / ".foundry/state/runs" / run_id / "state.json"
        state = json.loads(state_path.read_text(encoding="utf-8"))
        if state.get("run_id") != run_id:
            return None
        return state_path, state
    except (OSError, ValueError, TypeError):
        return None


def _brief_allows(root: Path, paths: list[str]) -> str | None:
    """Apply an optional run-local path budget; absent budget means unrestricted."""
    if not _active_state(root):
        return None
    try:
        project = json.loads((root / MARKER).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None
    budget = project.get("brief_budget") if isinstance(project, dict) else None
    if not isinstance(budget, dict):
        return None
    include = budget.get("include")
    if not isinstance(include, list) or not include:
        return None
    patterns = [item for item in include if isinstance(item, str) and item]
    if not patterns:
        return None
    for raw in paths:
        target = Path(raw)
        if target.is_absolute():
            try:
                relative = target.resolve(strict=False).relative_to(root.resolve()).as_posix()
            except (OSError, ValueError):
                continue
        else:
            relative = Path(os.path.normpath(raw)).as_posix()
        if not any(fnmatch.fnmatchcase(relative, pattern) for pattern in patterns):
            return f"Patch path {relative!r} is outside this run's optional brief_budget.include paths."
    return None


def _command_segments(command: str) -> list[list[str]]:
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
        lexer.whitespace_split = True
        lexer.commenters = ""
        tokens = list(lexer)
    except ValueError:
        return []
    segments: list[list[str]] = [[]]
    for token in tokens:
        if token and all(char in ";&|" for char in token):
            if segments[-1]:
                segments.append([])
        else:
            segments[-1].append(token)
    return [segment for segment in segments if segment]


def destructive_git(command: str) -> str | None:
    """Recognize a deliberately small set of irreversible Git commands."""
    for words in _command_segments(command):
        while words:
            if words[0] == "sudo" or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[0]):
                words = words[1:]
                continue
            break
        if not words or Path(words[0]).name != "git":
            continue
        args = words[1:]
        if len(args) >= 2 and args[0] == "reset" and "--hard" in args[1:]:
            return "Product Foundry blocked git reset --hard because it discards uncommitted work."
        if args and args[0] == "clean":
            flags = "".join(flag.lstrip("-") for flag in args[1:] if flag.startswith("-"))
            if "f" in flags and ("d" in flags or "x" in flags):
                return "Product Foundry blocked destructive git clean; review untracked files explicitly."
        if args and args[0] == "push" and any(
            flag == "-f" or flag.startswith("--force") for flag in args[1:]
        ):
            return "Product Foundry blocked force push because it can overwrite remote history."
        if args and args[0] in {"filter-branch", "filter-repo"}:
            return f"Product Foundry blocked git {args[0]} because it rewrites repository history."
        if len(args) >= 2 and args[:2] == ["reflog", "expire"]:
            return "Product Foundry blocked git reflog expire because it removes recovery history."
    return None


def pre_tool_use(data: dict[str, Any], root: Path) -> dict[str, Any] | None:
    tool = data.get("tool_name")
    tool_input = data.get("tool_input")
    if not isinstance(tool_input, dict):
        return None
    command = tool_input.get("command")
    if not isinstance(command, str):
        return None
    if tool == "apply_patch":
        paths = patch_paths(command)
        escaped = next((path for path in paths if not within_root(root, path)), None)
        if escaped:
            return deny(f"Product Foundry blocked patch path outside the project: {escaped}")
        budget_error = _brief_allows(root, paths)
        if budget_error:
            return deny(budget_error)
    elif tool == "Bash":
        reason = destructive_git(command)
        if reason:
            return deny(reason)
    return None


def context(event: str, root: Path) -> dict[str, Any]:
    active = _active_state(root)
    active_note = "no active Foundry run"
    if active:
        state_path, state = active
        active_note = f"active run {state.get('run_id', state_path.parent.name)!s} at {state_path.relative_to(root)}"
    message = (
        f"Marketcraft: read docs/WORKFLOW.md; {active_note}. "
        "Use `python3 scripts/marketcraft.py status` for run state and "
        "`python3 scripts/marketcraft.py context` for saved decisions, evidence and freshness. "
        "These records are context; the owner's current request governs authorization."
    )
    if event == "SessionStart":
        return {
            "hookSpecificOutput": {
                "hookEventName": event,
                "additionalContext": message,
            }
        }
    # PostCompact documents common output fields, including systemMessage, but
    # does not document a hook-specific additionalContext shape.
    return {"systemMessage": message}


def checkpoint(data: dict[str, Any], root: Path) -> None:
    found = _active_state(root)
    if not found:
        return
    state_path, state = found
    payload = {
        "run_id": state.get("run_id", state_path.parent.name),
        "status": state.get("status", "unknown"),
        "turn_id": data.get("turn_id"),
        "trigger": data.get("trigger"),
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "resume": "python3 scripts/marketcraft.py status",
        "context": "python3 scripts/marketcraft.py context",
        "spec": state.get("spec"),
        "verification": state.get("verification"),
    }
    state_path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="checkpoint-", suffix=".json", dir=state_path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temp_name, state_path.parent / "checkpoint.json")
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass


def stop_report(root: Path) -> dict[str, Any]:
    found = _active_state(root)
    if not found:
        return {}
    state_path, state = found
    status = state.get("status", "unknown")
    if status in {"complete", "completed", "verified"}:
        return {}
    run_id = state.get("run_id", state_path.parent.name)
    return {
        "systemMessage": (
            f"Product Foundry run {run_id} remains {status}; this is a status report only. "
            "Resume with `python3 scripts/foundry.py status`."
        )
    }


def dispatch(data: dict[str, Any]) -> dict[str, Any] | None:
    event = data.get("hook_event_name")
    if not isinstance(event, str):
        return None
    root = project_root(data)
    if event == "PreToolUse":
        return pre_tool_use(data, root)
    if event == "SessionStart":
        return context(event, root)
    if event == "PreCompact":
        checkpoint(data, root)
        return {}
    if event == "PostCompact":
        return context(event, root)
    if event == "Stop":
        return stop_report(root)
    if event == "Interrupt":
        # Interrupt is always honored. It must not emit a continuation decision.
        return None
    return None


def main() -> int:
    try:
        data = json.load(sys.stdin)
        if not isinstance(data, dict):
            raise TypeError("hook input must be an object")
        output = dispatch(data)
        if output is not None:
            json.dump(output, sys.stdout, separators=(",", ":"))
            sys.stdout.write("\n")
    except Exception as exc:  # Hook faults must not impersonate a policy decision.
        print(f"product-foundry hook failed open: {type(exc).__name__}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
