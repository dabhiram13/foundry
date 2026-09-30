from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


hooks = load("foundry_hooks", ROOT / "scripts/hooks.py")


class HookTests(unittest.TestCase):
    def project(self, base: Path) -> Path:
        base = base.resolve()
        (base / ".foundry").mkdir()
        (base / ".foundry/project.json").write_text("{}\n", encoding="utf-8")
        return base

    def test_patch_paths_and_subdirectory_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.project(Path(tmp))
            nested = root / "src/deep"
            nested.mkdir(parents=True)
            patch = """*** Begin Patch
*** Add File: src/a.py
*** Update File: docs/old.md
*** Move to: docs/new.md
*** Delete File: obsolete.txt
*** End Patch
"""
            self.assertEqual(
                hooks.patch_paths(patch),
                ["src/a.py", "docs/old.md", "docs/new.md", "obsolete.txt"],
            )
            data = {"cwd": str(nested), "hook_event_name": "PreToolUse"}
            self.assertEqual(hooks.project_root(data), root)
            allowed = {**data, "tool_name": "apply_patch", "tool_input": {"command": patch}}
            self.assertIsNone(hooks.pre_tool_use(allowed, root))
            escaped = {
                **data,
                "tool_name": "apply_patch",
                "tool_input": {"command": "*** Add File: ../escape.txt"},
            }
            result = hooks.pre_tool_use(escaped, root)
            self.assertEqual(
                result["hookSpecificOutput"]["permissionDecision"], "deny"
            )

    def test_guard_is_narrow(self):
        self.assertIn("reset --hard", hooks.destructive_git("cd x && git reset --hard HEAD"))
        self.assertIn("force push", hooks.destructive_git("git push origin main --force-with-lease"))
        self.assertIsNone(hooks.destructive_git("printf 'git reset --hard'"))
        self.assertIsNone(hooks.destructive_git("git reset --soft HEAD~1"))
        self.assertIsNone(hooks.destructive_git("git push origin main"))

    def test_malformed_input_fails_open(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts/hooks.py")],
            input="{broken",
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("failed open", result.stderr)

    def test_interrupt_never_continues(self):
        self.assertIsNone(hooks.dispatch({"hook_event_name": "Interrupt", "cwd": str(ROOT)}))

    def test_active_run_budget_checkpoint_and_stop_are_advisory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.project(Path(tmp))
            (root / ".foundry/project.json").write_text(
                json.dumps({"brief_budget": {"include": ["src/**"]}}), encoding="utf-8"
            )
            run_id = "00000000-0000-4000-8000-000000000001"
            run_dir = root / ".foundry/state/runs" / run_id
            (root / ".foundry/state").mkdir()
            run_dir.mkdir(parents=True)
            (root / ".foundry/state/active.json").write_text(
                json.dumps({"run_id": run_id, "slug": "demo"}), encoding="utf-8"
            )
            (run_dir / "state.json").write_text(
                json.dumps(
                    {
                        "run_id": run_id,
                        "status": "in-progress",
                    }
                ),
                encoding="utf-8",
            )
            blocked = hooks.dispatch(
                {
                    "hook_event_name": "PreToolUse",
                    "cwd": str(root),
                    "tool_name": "apply_patch",
                    "tool_input": {"command": "*** Add File: docs/outside.md"},
                }
            )
            self.assertEqual(blocked["hookSpecificOutput"]["permissionDecision"], "deny")
            self.assertEqual(
                hooks.dispatch(
                    {
                        "hook_event_name": "PreCompact",
                        "cwd": str(root),
                        "turn_id": "turn-1",
                        "trigger": "auto",
                    }
                ),
                {},
            )
            checkpoint = json.loads((run_dir / "checkpoint.json").read_text(encoding="utf-8"))
            self.assertEqual(checkpoint["turn_id"], "turn-1")
            stop = hooks.dispatch({"hook_event_name": "Stop", "cwd": str(root)})
            self.assertIn("remains in-progress", stop["systemMessage"])
            self.assertNotIn("decision", stop)

    def test_staged_blob_wins_over_worktree_and_redacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
            target = repo / "file with spaces.txt"
            target.write_text("clean\n", encoding="utf-8")
            subprocess.run(["git", "add", "--", target.name], cwd=repo, check=True)
            subprocess.run(["git", "commit", "-qm", "base"], cwd=repo, check=True)
            secret = "sk-proj-" + "livefixture_123456789012345678901234"
            target.write_text(secret + "\n", encoding="utf-8")
            subprocess.run(["git", "add", "--", target.name], cwd=repo, check=True)
            target.write_text("clean working tree\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts/security_scan.py"), "--root", str(repo)],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn('"file with spaces.txt":1: OpenAI API key [REDACTED]', result.stderr)
            self.assertNotIn(secret, result.stdout + result.stderr)

    def test_docs_examples_do_not_match(self):
        examples = b"OPENAI_API_KEY=sk-your-key-here\ntoken=example\npassword=changeme\n"
        self.assertFalse(any(pattern.search(examples) for pattern in hooks_placeholder_patterns()))


def hooks_placeholder_patterns():
    scanner = load("foundry_security_scan", ROOT / "scripts/security_scan.py")
    return scanner.PATTERNS.values()


if __name__ == "__main__":
    unittest.main()
