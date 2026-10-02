from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import textwrap
import threading
import time
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("factory_runtime", ROOT / "scripts/factory.py")
assert SPEC and SPEC.loader
factory_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(factory_module)
Factory = factory_module.Factory
Error = factory_module.Error


FAKE = r'''
import json
from pathlib import Path
import sys

request = json.loads(sys.stdin.read())
prompt = request["prompt"]
root = Path.cwd()
if "stage: research" in prompt:
    path = root / "docs/product/research.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# Research\n\nAccessed 2026-10-01. Source: https://example.com/reference\n\nThis fixture URL is only a reference, not customer proof.\n")
elif "stage: scope" in prompt:
    path = root / "docs/specs/product.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# Product scope\n\n## Acceptance criteria\n\n- AC-1: running product.py prints useful.\n\n## Non-goals\n\n- Publishing.\n")
elif "stage: design" in prompt:
    path = root / "docs/product/design.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# Design\n\nOne quiet command flow with explicit success and error output.\n")
elif "stage: build" in prompt:
    (root / "product.py").write_text("def value():\n    return 'useful'\n")
    (root / "test_product.py").write_text("import unittest\nfrom product import value\nclass T(unittest.TestCase):\n def test_value(self): self.assertEqual(value(), 'useful')\n")
    if not (root / "NO_CHECKS").exists():
        command = ([sys.executable, "-c", "import time; time.sleep(30)"] if (root / "SLOW_CHECK").exists()
                   else [sys.executable, "-m", "unittest", "test_product.py", "-v"])
        (root / ".foundry/project.json").write_text(json.dumps({
            "name": "Fixture", "checks": [{"name": "behavior", "command": command, "cwd": ".", "timeout": 40, "required": True,
                "inputs": ["product.py", "test_product.py", "docs/specs/product.md"]}]
        }))
        sys.path.insert(0, str(root / "scripts"))
        import workflow
        if not any(item["id"] == "ac-useful" for item in workflow.context(root)["records"]):
            workflow.record(root, {
                "id": "ac-useful", "kind": "criterion", "title": "Useful behavior",
                "source": {"kind": "owner", "ref": "Owner-approved docs/specs/product.md", "observed_at": "2026-10-01"},
                "basis": "observed", "status": "accepted", "stage": "verify", "required": True,
                "method": "command", "expected": "The approved useful journey passes its behavior test",
                "command": command,
                "inputs": ["product.py", "test_product.py", "docs/specs/product.md"]
            })
elif "stage: release" in prompt:
    path = root / "docs/product/release.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# Release readiness\n\nLocal checks are recorded. Publication and deployment are not authorized.\n")

print(json.dumps({"type": "session.started", "session_id": "fixture-session"}))
print(json.dumps({"type": "result", "status": "completed", "output": {"summary": "fixture stage finished"}}))
'''


class FactoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.state_dir = self.base / "factory-data"
        self.products = self.base / "products"
        self.factory = Factory(ROOT, self.products, state_dir=self.state_dir)
        self.fake = self.base / "fake_provider.py"
        self.fake.write_text(textwrap.dedent(FAKE), encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def create(self, name="Proof Product"):
        project = self.factory.create(name, "Help an owner prove one useful local journey.")
        root = Path(project["path"])
        (root / ".foundry/providers.json").write_text(json.dumps({"adapters": [{
            "name": "fixture", "kind": "agent-runtime", "command": [sys.executable, str(self.fake)],
            "capabilities": ["jsonl", "cancel", "permissions", "resume"], "billing_modes": ["local"]
        }]}), encoding="utf-8")
        return self.factory.configure(project["id"], adapter="fixture")

    def advance_to_build(self, project):
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("scope", "completed"))
        project = self.factory.run(project["id"])
        self.assertEqual(project["status"], "awaiting_approval")
        project = self.factory.approve(project["id"])
        self.assertEqual(project["stage"], "design")
        project = self.factory.run(project["id"])
        self.assertEqual(project["status"], "awaiting_approval")
        project = self.factory.approve(project["id"])
        self.assertEqual(project["stage"], "build")
        return project

    def test_fake_provider_end_to_end_uses_real_lifecycle_gate(self):
        project = self.advance_to_build(self.create())
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("verify", "completed"))
        active = factory_module.foundry.active(Path(project["path"]))[1]
        self.assertEqual(active["status"], "building")

        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("release", "completed"))
        active = factory_module.foundry.active(Path(project["path"]))[1]
        self.assertEqual(active["status"], "verified")
        self.assertTrue(active.get("verification"))

        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("release", "completed"))
        self.assertEqual(project["publication"], "not_authorized")
        self.assertIsNone(factory_module.foundry.active(Path(project["path"]))[1])
        self.assertIn("Publication and deployment are not authorized", self.factory.artifact(project["id"], "docs/product/release.md"))
        self.assertGreaterEqual(len(project["events"]), 6)

    def test_committed_completion_wins_cancel_race_and_terminal_cancel_is_idempotent(self):
        project = self.advance_to_build(self.create("Completion Race Product"))
        project = self.factory.run(project["id"])
        project = self.factory.run(project["id"])
        self.assertEqual(project["stage"], "release")

        original_runtime = self.factory._runtime
        def cancel_after_complete(root, command, **kwargs):
            result = original_runtime(root, command, **kwargs)
            if command == "complete" and result.returncode == 0:
                factory_module.providers._write(
                    factory_module.providers._path(root, factory_module.CANCEL),
                    {"project_id": project["id"], "requested_at": factory_module._now()})
            return result
        self.factory._runtime = cancel_after_complete

        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("release", "completed"))
        self.assertIsNone(factory_module.foundry.active(Path(project["path"]))[1])
        history_length = len(project["history"])
        cancelled = self.factory.cancel(project["id"])
        self.assertEqual((cancelled["stage"], cancelled["status"]), ("release", "completed"))
        self.assertEqual(len(cancelled["history"]), history_length)

    def test_paths_approvals_roles_and_empty_checks_fail_closed(self):
        project = self.create("Guarded Product")
        with self.assertRaisesRegex(Error, "not awaiting"):
            self.factory.approve(project["id"])
        with self.assertRaisesRegex(Error, "limited"):
            self.factory.artifact(project["id"], "../AGENTS.md")
        with self.assertRaisesRegex(Error, "already exists"):
            self.factory.create("Guarded Product", "duplicate")

        project = self.factory.configure(project["id"], roles={"backend": {"model": "fixture-model", "reasoning": "high"}})
        role = Path(project["path"]) / ".codex/agents/backend.toml"
        self.assertIn('model = "fixture-model"', role.read_text())
        self.assertIn('model_reasoning_effort = "high"', role.read_text())
        project = self.factory.configure(project["id"], model="global-model", reasoning="medium",
                                         roles={"backend": {"model": None, "reasoning": None}})
        project = self.factory.configure(project["id"], model=None, reasoning=None)
        self.assertIsNone(project["model"])
        self.assertIsNone(project["reasoning"])
        self.assertNotIn("backend", project["role_settings"])
        self.assertNotIn("model =", role.read_text())
        self.assertNotIn("model_reasoning_effort =", role.read_text())

        project = self.advance_to_build(project)
        (Path(project["path"]) / "NO_CHECKS").write_text("fixture")
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("build", "failed"))
        self.assertIn("configure at least one required", project["history"][-1]["note"])

    def test_unsupported_billing_fails_before_running_state(self):
        project = self.create("Billing Boundary Product")
        root = Path(project["path"])
        config = json.loads((root / ".foundry/providers.json").read_text())
        config["adapters"].append({
            "name": "paid", "kind": "agent-runtime", "command": [sys.executable, str(self.fake)],
            "capabilities": ["jsonl", "cancel"], "billing_modes": ["api"]
        })
        (root / ".foundry/providers.json").write_text(json.dumps(config))
        project = self.factory.configure(project["id"], adapter="paid")
        project = self.factory.run(project["id"])
        self.assertEqual(project["status"], "failed")
        self.assertIn("will not infer", project["history"][-1]["note"])
        self.assertNotEqual(project["history"][-1]["status"], "running")

    def test_stale_running_state_recovers_as_interrupted(self):
        project = self.create("Recoverable Product")
        project["status"] = "running"
        project["history"].append({"at": factory_module._now(), "stage": "research", "status": "running", "note": "simulated process loss"})
        self.factory._replace(project)
        recovered = Factory(ROOT, self.products, state_dir=self.state_dir).snapshot()["projects"]
        current = next(item for item in recovered if item["id"] == project["id"])
        self.assertEqual(current["status"], "interrupted")
        self.assertIn("not treated as integrated", current["history"][-1]["note"])

    def test_lifecycle_cancel_stops_check_and_live_factory_is_not_recovered(self):
        project = self.advance_to_build(self.create("Cancelable Product"))
        root = Path(project["path"])
        (root / "SLOW_CHECK").write_text("fixture")
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("verify", "completed"))

        outcome = []
        worker = threading.Thread(target=lambda: outcome.append(self.factory.run(project["id"])), daemon=True)
        worker.start()
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            current = self.factory.snapshot()["projects"][0]
            active = factory_module.foundry.active(root)[1]
            if current["status"] == "running" and active and active.get("status") == "verifying":
                break
            time.sleep(0.05)
        else:
            self.fail("slow lifecycle verification did not start")

        second = Factory(ROOT, self.products, state_dir=self.state_dir)
        current = next(item for item in second.snapshot()["projects"] if item["id"] == project["id"])
        self.assertEqual(current["status"], "running")
        with self.assertRaises(factory_module.providers.Error):
            second.configure(project["id"], model="must-not-race")
        requested = second.cancel(project["id"])
        self.assertEqual(requested["status"], "running")
        self.assertIn("must confirm interruption", requested["history"][-1]["note"])
        worker.join(8)
        self.assertFalse(worker.is_alive(), "cancelled lifecycle check was left running")
        self.assertEqual(len(outcome), 1)
        self.assertEqual(outcome[0]["status"], "interrupted")
        self.assertIn("cancellation", outcome[0]["history"][-1]["note"].lower())
        self.assertNotEqual(factory_module.foundry.active(root)[1].get("status"), "verifying")

    def test_changed_approved_scope_returns_to_owner_review(self):
        project = self.create("Approval Product")
        project = self.factory.run(project["id"])
        project = self.factory.run(project["id"])
        project = self.factory.approve(project["id"])
        spec = Path(project["path"]) / "docs/specs/product.md"
        spec.write_text(spec.read_text() + "\n- AC-2: changed after approval.\n")
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("scope", "awaiting_approval"))
        self.assertNotIn("scope", project["approved_stages"])
        self.assertIn("changed", project["history"][-1]["note"])

    def test_products_directory_symlink_is_rejected(self):
        actual = self.base / "actual"
        actual.mkdir()
        link = self.base / "linked"
        link.symlink_to(actual, target_is_directory=True)
        with self.assertRaises(factory_module.foundry.Error):
            Factory(ROOT, link)

    def test_plugin_data_owns_state_while_framework_remains_the_source(self):
        project = self.create("Plugin Data Product")
        state = self.state_dir / factory_module.STATE
        self.assertTrue(state.is_file())
        self.assertEqual(self.factory.snapshot()["projects"][0]["id"], project["id"])
        self.assertEqual(self.factory.root, ROOT)
        self.assertEqual(self.factory.storage_root, self.state_dir)


if __name__ == "__main__":
    unittest.main()
