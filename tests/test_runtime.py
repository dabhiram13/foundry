from __future__ import annotations

import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("foundry_runtime", ROOT / "scripts/foundry.py")
assert SPEC and SPEC.loader
foundry = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(foundry)


def git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


def tree(root: Path) -> dict[str, tuple[str, bytes | str | int]]:
    result = {}
    if not root.exists():
        return result
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root).as_posix()
        if path.is_symlink():
            result[rel] = ("link", os.readlink(path))
        elif path.is_file():
            result[rel] = ("file", path.read_bytes(), path.stat().st_mode & 0o777)
        else:
            result[rel] = ("dir", 0)
    return result


class RuntimeTests(unittest.TestCase):
    def make_project(self, base: Path, checks=None) -> Path:
        root = (base / "product").resolve()
        (root / ".foundry").mkdir(parents=True)
        (root / "docs").mkdir()
        (root / "backend").mkdir()
        (root / "docs/spec.md").write_text("# Spec\n\n- acceptance: works\n", encoding="utf-8")
        (root / "backend/config.ini").write_text("mode=local\n", encoding="utf-8")
        if checks is None:
            checks = [
                {
                    "name": "behavior",
                    "command": [sys.executable, "-c", "print('ok')"],
                    "cwd": ".",
                    "timeout": 2,
                    "required": True,
                }
            ]
        (root / ".foundry/project.json").write_text(
            json.dumps({"name": "Test", "checks": checks}), encoding="utf-8"
        )
        git(root, "init", "-q")
        git(root, "config", "user.email", "test@example.invalid")
        git(root, "config", "user.name", "Test")
        git(root, "add", ".")
        git(root, "commit", "-qm", "base")
        return root

    def start(self, root: Path, slug="feature") -> dict:
        with redirect_stdout(io.StringIO()):
            foundry.start(root, slug, "docs/spec.md")
        return foundry.active(root)[1]

    def test_one_active_run_pause_resume_and_collision_free_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp).resolve())
            first = uuid.UUID("00000000-0000-4000-8000-000000000001")
            second = uuid.UUID("00000000-0000-4000-8000-000000000002")
            with mock.patch.object(foundry.uuid, "uuid4", return_value=first):
                state = self.start(root)
            run_id = state["run_id"]
            with redirect_stdout(io.StringIO()):
                foundry.resume_or_pause(root, True)
            self.assertEqual(foundry.active(root)[1]["status"], "paused")
            with redirect_stdout(io.StringIO()):
                foundry.resume_or_pause(root, False)
            self.assertEqual(foundry.active(root)[1]["run_id"], run_id)
            with self.assertRaises(foundry.Error):
                self.start(root, "another")

            (root / ".foundry/state/active.json").unlink()
            with mock.patch.object(foundry.uuid, "uuid4", side_effect=[first, second]):
                newer = self.start(root, "newer")
            self.assertEqual(newer["run_id"], str(second))
            self.assertTrue((root / ".foundry/state/runs" / str(first) / "state.json").is_file())

    def test_coordinator_lock_is_nonblocking_between_processes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp).resolve())
            lock_path = root / ".foundry/state/coordinator.lock"
            lock_path.parent.mkdir(parents=True)
            code = (
                "import fcntl,sys,time; "
                "f=open(sys.argv[1],'a+'); fcntl.flock(f,fcntl.LOCK_EX); "
                "print('locked',flush=True); time.sleep(10)"
            )
            proc = subprocess.Popen(
                [sys.executable, "-c", code, str(lock_path)],
                stdout=subprocess.PIPE,
                text=True,
            )
            try:
                self.assertEqual(proc.stdout.readline().strip(), "locked")
                started = time.monotonic()
                with self.assertRaises(foundry.Error):
                    with foundry.lock(root):
                        pass
                self.assertLess(time.monotonic() - started, 1)
            finally:
                proc.terminate()
                proc.wait(timeout=3)
                proc.stdout.close()

    def test_every_required_check_failure_mode_blocks_completion(self):
        cases = {
            "missing": [],
            "failed": [{"name": "required", "command": [sys.executable, "-c", "raise SystemExit(7)"], "required": True}],
            "unavailable": [{"name": "required", "command": ["definitely-not-a-real-foundry-command"], "required": True}],
            "timeout": [{"name": "required", "command": [sys.executable, "-c", "import time; time.sleep(5)"], "timeout": 0.05, "required": True}],
        }
        for name, configured in cases.items():
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                root = self.make_project(Path(tmp).resolve(), configured)
                self.start(root)
                if name == "missing":
                    with self.assertRaises(foundry.Error):
                        foundry.verify(root)
                else:
                    with redirect_stdout(io.StringIO()):
                        self.assertEqual(foundry.verify(root), 1)
                    self.assertEqual(foundry.active(root)[1]["status"], "building")
                with self.assertRaises(foundry.Error):
                    foundry.complete(root)

    def test_fresh_receipts_source_changes_and_evidence_tampering(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp).resolve())
            self.start(root)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
            root.joinpath("backend/config.ini").write_text("mode=changed\n", encoding="utf-8")
            with self.assertRaisesRegex(foundry.Error, "stale"):
                foundry.complete(root)

            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
            state = foundry.active(root)[1]
            evidence_path = root / state["verification"]
            evidence = foundry.read_json(evidence_path)
            evidence["checks"][0]["command"] = [sys.executable, "-c", "print('different')"]
            foundry.atomic_json(evidence_path, evidence)
            with self.assertRaisesRegex(foundry.Error, "configured check"):
                foundry.complete(root)

            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
            state = foundry.active(root)[1]
            evidence = foundry.read_json(root / state["verification"])
            (root / evidence["checks"][0]["log"]).write_text("tampered", encoding="utf-8")
            with self.assertRaisesRegex(foundry.Error, "missing or changed"):
                foundry.complete(root)

            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
            state = foundry.active(root)[1]
            evidence = foundry.read_json(root / state["verification"])
            (root / evidence["checks"][0]["log"]).unlink()
            with self.assertRaisesRegex(foundry.Error, "missing or changed"):
                foundry.complete(root)

            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
                self.assertEqual(foundry.complete(root), 0)
            self.assertIsNone(foundry.active(root)[1])

    def test_gitignored_foundry_config_and_active_spec_remain_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp).resolve())
            git(root, "rm", "--cached", ".foundry/project.json", "docs/spec.md")
            (root / ".gitignore").write_text(".foundry/project.json\ndocs/spec.md\n", encoding="utf-8")
            git(root, "add", ".gitignore")
            git(root, "commit", "-qm", "ignore local foundry inputs")
            self.start(root)
            paths = {path.relative_to(root).as_posix() for path in foundry.source_files(root)}
            self.assertIn(".foundry/project.json", paths)
            self.assertIn("docs/spec.md", paths)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
            (root / "docs/spec.md").write_text("# Changed ignored spec\n", encoding="utf-8")
            with self.assertRaisesRegex(foundry.Error, "stale"):
                foundry.complete(root)

    def make_source(self, base: Path) -> Path:
        source = (base / "source").resolve()
        (source / "payload").mkdir(parents=True)
        (source / "scripts").mkdir()
        (source / "payload/file.txt").write_text("framework-v1\n", encoding="utf-8")
        (source / "scripts/foundry.py").write_text("# runtime\n", encoding="utf-8")
        (source / "scripts/foundry.py").chmod(0o755)
        return source

    def test_install_and_update_preserve_product_content(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            foundry, "MANAGED", ["payload", "scripts/foundry.py"]
        ):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            target = base / "target"
            target.mkdir()
            (target / "AGENTS.md").write_text("# My product\n\nKeep this rule.\n", encoding="utf-8")
            (target / "README.md").write_text("product data\n", encoding="utf-8")
            (target / "LICENSE").write_text("Product's own license\n", encoding="utf-8")
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, False), 0)
            installed_root = subprocess.run(
                ["git", "-C", str(target), "rev-parse", "--show-toplevel"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            branch = subprocess.run(
                ["git", "-C", str(target), "branch", "--show-current"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            self.assertEqual(Path(installed_root), target)
            self.assertEqual(branch, "main")
            self.assertEqual(
                subprocess.run(
                    ["git", "-C", str(target), "remote"], capture_output=True, text=True, check=True
                ).stdout,
                "",
            )
            agents = (target / "AGENTS.md").read_text(encoding="utf-8")
            self.assertIn("Keep this rule.", agents)
            self.assertEqual(agents.count(foundry.AGENTS_START), 1)
            self.assertEqual((target / "README.md").read_text(), "product data\n")
            self.assertEqual((target / "LICENSE").read_text(), "Product's own license\n")

            (source / "payload/file.txt").write_text("framework-v2\n", encoding="utf-8")
            (target / "payload/file.txt").write_text("product customization\n", encoding="utf-8")
            before = tree(target)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, True), 1)
            self.assertEqual(tree(target), before)

            (target / "payload/file.txt").write_text("framework-v1\n", encoding="utf-8")
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, True), 0)
            self.assertEqual((target / "payload/file.txt").read_text(), "framework-v2\n")
            self.assertIn("Keep this rule.", (target / "AGENTS.md").read_text())

    def test_update_preserves_local_managed_mode_changes(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            foundry, "MANAGED", ["payload", "scripts/foundry.py"]
        ):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            target = base / "target"
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, False), 0)
            script = target / "scripts/foundry.py"
            manifest = json.loads((target / ".foundry/install.json").read_text())
            self.assertEqual(manifest["modes"]["scripts/foundry.py"], 0o755)
            self.assertEqual(script.stat().st_mode & 0o777, 0o755)

            script.chmod(0o644)
            before = tree(target)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, True), 1)
            self.assertEqual(tree(target), before)

            script.chmod(0o755)
            (source / "scripts/foundry.py").write_text("# runtime v2\n", encoding="utf-8")
            (source / "scripts/foundry.py").chmod(0o755)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, True), 0)
            self.assertEqual(script.read_text(), "# runtime v2\n")
            self.assertEqual(script.stat().st_mode & 0o777, 0o755)

            script.chmod(0o644)
            before = tree(target)
            with mock.patch.object(foundry, "MANAGED", ["payload"]), redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, True), 1)
            self.assertEqual(tree(target), before)

    def test_install_preserves_existing_repository_settings(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            foundry, "MANAGED", ["payload", "scripts/foundry.py"]
        ):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            target = base / "existing-repo"
            target.mkdir()
            git(target, "init", "-q", "-b", "product-branch")
            git(target, "config", "core.hooksPath", "product-hooks")
            git(target, "config", "product.owner", "kept")
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.install(source, target, False), 0)
            branch = subprocess.run(
                ["git", "branch", "--show-current"], cwd=target, check=True, capture_output=True, text=True
            ).stdout.strip()
            self.assertEqual(branch, "product-branch")
            self.assertEqual(
                subprocess.run(
                    ["git", "config", "core.hooksPath"], cwd=target, check=True, capture_output=True, text=True
                ).stdout.strip(),
                "product-hooks",
            )
            self.assertEqual(
                subprocess.run(
                    ["git", "config", "product.owner"], cwd=target, check=True, capture_output=True, text=True
                ).stdout.strip(),
                "kept",
            )

    def test_install_rejects_missing_git_and_nested_repository_without_mutation(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            foundry, "MANAGED", ["payload", "scripts/foundry.py"]
        ):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            no_git = base / "no-git"
            no_git.mkdir()
            (no_git / "sentinel.txt").write_text("untouched\n")
            before = tree(no_git)
            with mock.patch.object(foundry.shutil, "which", return_value=None):
                with self.assertRaisesRegex(foundry.Error, "Git is required"):
                    foundry.install(source, no_git, False)
            self.assertEqual(tree(no_git), before)

            parent = base / "parent-repo"
            parent.mkdir()
            git(parent, "init", "-q", "-b", "main")
            nested = parent / "nested-product"
            nested.mkdir()
            (nested / "sentinel.txt").write_text("untouched\n")
            before = tree(nested)
            with self.assertRaisesRegex(foundry.Error, "nested inside a different Git repository"):
                foundry.install(source, nested, False)
            self.assertEqual(tree(nested), before)

    def test_install_preflight_rejects_bad_metadata_without_mutation(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            foundry, "MANAGED", ["payload", "scripts/foundry.py"]
        ):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            setups = {
                "agents": lambda t: (t / "AGENTS.md").write_text(foundry.AGENTS_START + "\nbroken\n"),
                "config": lambda t: ((t / ".foundry").mkdir(), (t / ".foundry/project.json").write_text("[]")),
            }
            for name, setup in setups.items():
                with self.subTest(name=name):
                    target = base / f"bad-{name}"
                    target.mkdir()
                    (target / "sentinel.txt").write_text("untouched\n")
                    setup(target)
                    before = tree(target)
                    with self.assertRaises(foundry.Error):
                        foundry.install(source, target, False)
                    self.assertEqual(tree(target), before)
                    self.assertFalse((target / "payload/file.txt").exists())

            outside = base / "outside"
            outside.mkdir()
            target = base / "bad-gitignore"
            target.mkdir()
            (target / ".gitignore").symlink_to(outside / "ignore")
            before = tree(target)
            with self.assertRaises(foundry.Error):
                foundry.install(source, target, False)
            self.assertEqual(tree(target), before)

    def test_target_managed_and_project_input_symlink_boundaries(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            foundry, "MANAGED", ["payload", "scripts/foundry.py"]
        ):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            outside = base / "outside"
            outside.mkdir()

            target_link = base / "target-link"
            target_link.symlink_to(outside, target_is_directory=True)
            with self.assertRaises(foundry.Error):
                foundry.install(source, target_link, False)

            parent = base / "parent"
            parent.mkdir()
            (parent / "linked").symlink_to(outside, target_is_directory=True)
            with self.assertRaises(foundry.Error):
                foundry.install(source, parent / "linked/product", False)

            target = base / "managed-link"
            target.mkdir()
            (target / "payload").symlink_to(outside, target_is_directory=True)
            before = tree(target)
            with self.assertRaises(foundry.Error):
                foundry.install(source, target, False)
            self.assertEqual(tree(target), before)
            self.assertEqual(list(outside.iterdir()), [])

            project = self.make_project(base / "project-case")
            real_spec = base / "external-spec.md"
            real_spec.write_text("# Outside\n")
            (project / "docs/spec.md").unlink()
            (project / "docs/spec.md").symlink_to(real_spec)
            with self.assertRaises(foundry.Error):
                foundry.start(project, "unsafe", "docs/spec.md")


if __name__ == "__main__":
    unittest.main()
