import json
import io
import os
from pathlib import Path
import sys
import tempfile
import unittest
from contextlib import redirect_stdout


ROOT = Path(__file__).resolve().parents[1]


sys.path.insert(0, str(ROOT / "scripts"))
import foundry
import providers
import workflow


class TypeScriptOwnershipGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        (self.root / ".foundry").mkdir()
        (self.root / ".foundry/project.json").write_text("{}")
        (self.root / ".foundry/runtime.json").write_text(json.dumps({
            "schema_version": 1,
            "runtime": "typescript",
            "runtime_version": "1",
            "installed_at": "2026-01-01T00:00:00+00:00",
            "source_pin": "a" * 64,
        }))

    def tearDown(self):
        self.temp.cleanup()

    def test_legacy_lifecycle_and_provider_mutations_fail_before_state_changes(self):
        calls = [
            lambda: foundry.start(self.root, "fixture", "spec.md"),
            lambda: foundry.resume_or_pause(self.root, True),
            lambda: foundry.verify(self.root),
            lambda: foundry.complete(self.root),
            lambda: foundry.recover(self.root),
            lambda: workflow.record(self.root, {}),
            lambda: providers.execute(self.root, {}),
            lambda: providers.cancel(self.root, "not-a-task"),
            lambda: providers.reconcile(self.root, "not-a-task"),
        ]
        for call in calls:
            with self.subTest(call=call):
                with self.assertRaisesRegex(foundry.Error, "TypeScript-owned"):
                    call()
        self.assertEqual(set((self.root / ".foundry").iterdir()), {
            self.root / ".foundry/project.json",
            self.root / ".foundry/runtime.json",
        })

    def test_legacy_install_refuses_typed_target(self):
        with self.assertRaisesRegex(foundry.Error, "TypeScript-owned"):
            foundry.install(ROOT, self.root, False)
        pending = self.root / ".foundry/install-pending.json"
        pending.write_text(json.dumps({
            "version": 1,
            "started_at": foundry.now(),
            "source_pin": "a" * 64,
            "previous": {},
        }))
        with self.assertRaisesRegex(foundry.Error, "TypeScript-owned"):
            foundry.install(ROOT, self.root, True)

    def test_incomplete_unknown_and_future_runtime_markers_fail_closed(self):
        valid = json.loads((self.root / ".foundry/runtime.json").read_text())
        variants = [
            {"schema_version": 1, "runtime": "typescript"},
            {**valid, "runtime": "future-runtime"},
            {**valid, "schema_version": 2},
            {**valid, "unexpected": True},
        ]
        for marker in variants:
            with self.subTest(marker=marker):
                (self.root / ".foundry/runtime.json").write_text(json.dumps(marker))
                with self.assertRaisesRegex(foundry.Error, "runtime marker"):
                    foundry.start(self.root, "fixture", "spec.md")

    def test_pending_installation_blocks_legacy_mutations(self):
        pending = self.root / ".foundry/install-pending.json"
        pending.write_text(json.dumps({"schema_version": 1, "runtime": "typescript"}))
        with self.assertRaisesRegex(foundry.Error, "interrupted TypeScript installation"):
            foundry.start(self.root, "fixture", "spec.md")
        self.assertEqual(set((self.root / ".foundry").iterdir()), {
            self.root / ".foundry/project.json",
            self.root / ".foundry/runtime.json",
            pending,
        })

    def test_legacy_update_resumes_its_validated_journal_and_preserves_owner_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve() / "product"
            with redirect_stdout(io.StringIO()):
                foundry.install(ROOT, target, False)
            manifest_path = target / ".foundry/install.json"
            manifest = foundry.read_json(manifest_path)
            owner_file = target / "owner-notes.md"
            owner_file.write_text("keep this owner edit\n", encoding="utf-8")
            project_path = target / ".foundry/project.json"
            owner_project = '{"name":"Owner product","checks":[]}\n'
            project_path.write_text(owner_project, encoding="utf-8")
            managed = next(iter(manifest["files"]))
            (target / managed).unlink()
            pending = target / ".foundry/install-pending.json"
            foundry.atomic_json(pending, {
                "version": 1,
                "started_at": foundry.now(),
                "source_pin": manifest["source_pin"],
                "previous": manifest,
            })
            with self.assertRaisesRegex(foundry.Error, "install journal blocks legacy mutation"):
                foundry.start(target, "fixture", "spec.md")
            with redirect_stdout(io.StringIO()):
                foundry.install(ROOT, target, True)
            self.assertFalse(pending.exists())
            self.assertTrue((target / managed).is_file())
            self.assertEqual(owner_file.read_text(encoding="utf-8"), "keep this owner edit\n")
            self.assertEqual(project_path.read_text(encoding="utf-8"), owner_project)

    def test_update_rejects_malformed_and_future_install_journals(self):
        variants = [
            {"version": 2, "started_at": foundry.now(), "source_pin": "a" * 64, "previous": {}},
            {"version": 1, "started_at": foundry.now(), "source_pin": "a" * 64, "previous": {}, "runtime": "typescript"},
            {"version": 1, "started_at": foundry.now(), "source_pin": "bad", "previous": {}},
        ]
        for journal in variants:
            with self.subTest(journal=journal), tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary).resolve() / "product"
                (target / ".foundry").mkdir(parents=True)
                (target / ".foundry/project.json").write_text("{}\n", encoding="utf-8")
                pending = target / ".foundry/install-pending.json"
                pending.write_text(json.dumps(journal), encoding="utf-8")
                with self.assertRaises(foundry.Error):
                    foundry.install(ROOT, target, True)
                self.assertEqual(pending.read_text(encoding="utf-8"), json.dumps(journal))

    def test_shared_install_guard_reclaims_dead_owner_and_fails_closed_on_malformed_guards(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve() / "product"
            guard = foundry.install_guard_path(target)
            reclaim = Path(f"{guard}.reclaim")
            guard.mkdir()
            foundry.atomic_json(guard / "owner.json", {
                "pid": os.getpid() + 1_000_000,
                "token": "dead-owner-token-1234",
                "started_at": foundry.now(),
            })
            with foundry.shared_install_guard(target):
                owner = foundry.read_json(guard / "owner.json")
                self.assertEqual(owner["pid"], os.getpid())
            self.assertFalse(guard.exists())
            self.assertFalse(reclaim.exists())

            reclaim.mkdir()
            with self.assertRaisesRegex(foundry.Error, "reclamation guard"):
                with foundry.shared_install_guard(target):
                    pass
            self.assertTrue(reclaim.is_dir())
            reclaim.rmdir()

            guard.mkdir()
            (guard / "owner.json").write_text("{}\n", encoding="utf-8")
            with self.assertRaisesRegex(foundry.Error, "Malformed shared install guard"):
                with foundry.shared_install_guard(target):
                    pass
            self.assertTrue(guard.is_dir())
            self.assertFalse(reclaim.exists())


if __name__ == "__main__":
    unittest.main()
