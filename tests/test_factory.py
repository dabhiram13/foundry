from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import textwrap
import threading
import time
import unittest
from unittest.mock import patch


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
import os
from pathlib import Path
import sys
import time

request = json.loads(sys.stdin.read())
prompt = request["prompt"]
root = Path.cwd()
if calls_path := os.environ.get("FOUNDRY_CLI_CALLS"):
    with Path(calls_path).open("a", encoding="utf-8") as handle:
        handle.write(prompt.splitlines()[0] + "\n")
if (root / "SLOW").exists():
    time.sleep(60)
if (root / "FAIL").exists():
    print(json.dumps({"type": "error", "error": {"message": "fixture refused the request"}}))
    raise SystemExit(1)
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


TASK_FAKE = FAKE.replace('if "stage: research" in prompt:', '''with (root / "PROMPTS.log").open("a") as handle:
    handle.write(prompt.splitlines()[0] + "\\n")
if "step: tasks" in prompt:
    path = root / "docs/product/tasks.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# Build tasks\\n\\n- [ ] Add the value function\\n- [ ] Add the behavior test\\n")
elif "stage: research" in prompt:''').replace('print(json.dumps({"type": "session.started"', '''if "task " in prompt.splitlines()[0] or ((root / "ALWAYS_WRONG").exists() and "stage: build" in prompt):
    (root / "product.py").write_text("def value():\\n    return 'wrong'\\n")
print(json.dumps({"type": "session.started"''', 1)


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
            "capabilities": ["jsonl", "cancel", "permissions", "resume", "tools"], "billing_modes": ["local"]
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

    def test_snapshot_discovers_product_providers_after_switching_engines(self):
        project = self.create()
        self.factory.configure(project["id"], adapter="codex")
        snapshot = self.factory.snapshot()
        names = {item["name"] for item in snapshot["project_providers"][project["id"]]}
        self.assertIn("fixture", names)
        self.assertNotIn("fixture", {item["name"] for item in snapshot["providers"]})
        self.assertNotIn(project["id"], snapshot["provider_errors"])
        self.assertEqual(self.factory.configure(project["id"], adapter="fixture")["adapter"], "fixture")

    def test_product_custom_roles_and_stage_inputs_reach_the_prompt(self):
        project = self.advance_to_build(self.create())
        root = Path(project["path"])
        (root / ".codex/agents/custom.toml").write_text(
            'name = "product-specialist"\ndescription = "Local specialist"\n')
        project = self.factory.configure(project["id"], roles=["product-specialist"])
        prompt = self.factory._prompt(project)
        self.assertIn(".codex/agents/custom.toml", prompt)
        for stage, path in (("scope", "docs/specs/product.md"), ("design", "docs/product/design.md")):
            self.assertIn(path, prompt)
            self.assertIn(project["approved_revisions"][stage], prompt)
        self.assertIn("product-specialist", {item["name"] for item in self.factory.snapshot()["project_roles"][project["id"]]})

    def test_invalid_later_role_does_not_change_earlier_native_settings(self):
        project = self.create()
        root = Path(project["path"])
        original = (root / ".codex/agents/backend.toml").read_text()
        (root / ".codex/agents/connector.toml").unlink()
        with self.assertRaisesRegex(Error, "installed"):
            self.factory.configure(project["id"], roles={"backend": {"model": "changed"}, "connector": {"model": "changed"}})
        self.assertEqual((root / ".codex/agents/backend.toml").read_text(), original)
        self.assertEqual(self.factory._project(project["id"])["role_settings"], {})

    def test_toolless_agent_is_rejected_before_launch(self):
        project = self.create()
        root = Path(project["path"])
        config = json.loads((root / ".foundry/providers.json").read_text())
        config["adapters"][0]["capabilities"].remove("tools")
        (root / ".foundry/providers.json").write_text(json.dumps(config))
        result = self.factory.run(project["id"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("tools", result["history"][-1]["note"])
        self.assertFalse((root / ".foundry/state/providers/tasks").exists())

    def test_codex_billing_requires_an_explicit_owner_confirmation(self):
        project = self.create()
        project = self.factory.configure(project["id"], adapter="codex")
        with self.assertRaisesRegex(Error, "subscription login"):
            self.factory._request(project)
        project = self.factory.configure(project["id"], subscription_confirmed=True)
        self.assertEqual(self.factory._request(project)["billing"], {"mode": "subscription", "confirmed": True})
        self.factory.configure(project["id"], adapter="fixture")
        project = self.factory.configure(project["id"], adapter="codex")
        self.assertFalse(project["subscription_confirmed"])

    def test_factory_does_not_adopt_an_unrelated_active_lifecycle(self):
        project = self.advance_to_build(self.create())
        root = Path(project["path"])
        factory_module.foundry.start(root, "other-work", "docs/specs/product.md")
        result = self.factory.run(project["id"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("different product", result["history"][-1]["note"])
        self.assertEqual(factory_module.foundry.active(root)[1]["slug"], "other-work")

    def test_oversized_task_plan_is_rejected_not_truncated(self):
        project = self.create()
        root = Path(project["path"])
        (root / factory_module.TASKS_DOC).write_text("".join(f"- [ ] Task {index}\n" for index in range(13)))
        with self.assertRaisesRegex(Error, "at most 12"):
            self.factory._read_tasks(root)

    def test_declared_input_mutation_is_not_a_passing_task_check(self):
        project = self.create()
        root = Path(project["path"])
        (root / "product.py").write_text("before")
        check = {"name": "mutates", "command": [sys.executable, "-c", "from pathlib import Path; Path('product.py').write_text('after')"],
                 "inputs": ["product.py"]}
        with patch.object(factory_module.foundry, "checks", return_value=[check]):
            failures, _ = self.factory._run_checks(project["id"], root, "mutation")
        self.assertEqual(failures[0]["status"], "failed")

    def test_rejected_checkpoint_keeps_task_and_checklist_unfinished(self):
        self.use_task_fake()
        project = self.advance_to_build(self.create())
        root = Path(project["path"])
        hook = root / ".git/hooks/pre-commit"
        hook.write_text("#!/bin/sh\necho rejected >&2\nexit 1\n")
        hook.chmod(0o755)
        result = self.factory.run(project["id"])
        self.assertEqual((result["stage"], result["status"]), ("build", "failed"))
        self.assertIn("checkpoint", result["history"][-1]["note"])
        self.assertNotEqual(result["stage_verification"]["build"]["tasks"][0]["status"], "done")
        self.assertEqual(result["stage_verification"]["build"]["tasks"][0]["checks"], "passed")
        self.assertIn("- [ ] Add the value function", (root / factory_module.TASKS_DOC).read_text())

    def test_restart_recovers_a_committed_release(self):
        project = self.advance_to_build(self.create())
        project = self.factory.run(project["id"])
        project = self.factory.run(project["id"])
        original = self.factory._runtime
        def crash_after_complete(root, command, **kwargs):
            result = original(root, command, **kwargs)
            if command == "complete" and result.returncode == 0:
                raise SystemExit("simulated coordinator crash")
            return result
        with patch.object(self.factory, "_runtime", side_effect=crash_after_complete), self.assertRaises(SystemExit):
            self.factory.run(project["id"])
        recovered = Factory(ROOT, self.products, state_dir=self.state_dir)._project(project["id"])
        self.assertEqual((recovered["stage"], recovered["status"]), ("release", "completed"))
        self.assertEqual(self.factory.run(project["id"])["status"], "completed")

    def test_a_second_approved_lifecycle_does_not_reuse_old_ship_completion(self):
        project = self.advance_to_build(self.create())
        for _ in range(3):
            project = self.factory.run(project["id"])
        old_run = project["lifecycle_run_id"]
        root = Path(project["path"])
        spec = root / "docs/specs/product.md"
        spec.write_text(spec.read_text() + "\nA newly reviewed recovery note.\n")
        project = self.factory.run(project["id"])
        self.assertEqual(project["status"], "awaiting_approval")
        self.factory.approve(project["id"])
        project = self.factory.run(project["id"])
        self.factory.approve(project["id"])
        check = factory_module.foundry.checks(root)[0]
        factory_module.workflow.record(root, {
            "id": "ac-useful-revised", "supersedes": "ac-useful", "kind": "criterion", "title": "Revised useful behavior",
            "source": {"kind": "owner", "ref": "Owner-approved docs/specs/product.md", "observed_at": "2026-10-03"},
            "basis": "observed", "status": "accepted", "stage": "verify", "required": True,
            "method": "command", "expected": "The newly approved useful journey passes its behavior test",
            "command": check["command"], "inputs": check["inputs"],
        })
        project = self.factory.run(project["id"])
        self.assertNotEqual(project["lifecycle_run_id"], old_run)
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("release", "completed"))
        self.assertFalse(any(item["stage"] == "release" for item in project["artifacts"]))
        project = self.factory.run(project["id"])
        self.assertEqual(project["status"], "completed")
        self.assertIsNone(factory_module.foundry.active(root)[1])
        self.assertEqual(factory_module.foundry.read_json(root / ".foundry/state/last-completed.json")["run_id"],
                         project["lifecycle_run_id"])

    def test_ship_rechecks_workflow_gate_after_provider_changes(self):
        project = self.advance_to_build(self.create())
        project = self.factory.run(project["id"])
        project = self.factory.run(project["id"])
        root = Path(project["path"])
        check = factory_module.foundry.checks(root)[0]
        factory_module.workflow.record(root, {
            "id": "new-required-at-ship", "kind": "criterion", "title": "Fresh Ship criterion",
            "source": {"kind": "owner", "ref": "Owner-approved docs/specs/product.md", "observed_at": "2026-10-03"},
            "basis": "observed", "status": "accepted", "stage": "verify", "required": True,
            "method": "command", "expected": "New required behavior needs fresh workflow evidence",
            "command": check["command"], "inputs": check["inputs"],
        })
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("release", "failed"))
        self.assertIn("workflow gate", project["history"][-1]["note"])
        self.assertIsNotNone(factory_module.foundry.active(root)[1])

    def test_final_retry_repair_has_its_own_checkpoint(self):
        self.use_task_fake()
        project = self.advance_to_build(self.create())
        project = self.factory.run(project["id"])
        old_commit = project["stage_verification"]["build"]["tasks"][-1]["commit"]
        project["stage"] = "build"
        self.factory._replace(project)
        root = Path(project["path"])
        def repaired(*args):
            (root / "product.py").write_text("# verified final repair\ndef value():\n    return 'useful'\n")
        with patch.object(self.factory, "_check_and_fix", side_effect=repaired):
            self.factory._build(project["id"], None, None, None)
        updated = self.factory._project(project["id"])
        final_commit = updated["stage_verification"]["build"]["final_commit"]
        self.assertNotEqual(final_commit, old_commit)
        status = factory_module.subprocess.run(["git", "status", "--porcelain", "--", "product.py"],
                                              cwd=root, capture_output=True, text=True)
        self.assertEqual(status.stdout, "")

    def test_oversized_artifact_never_uses_an_unbounded_read(self):
        project = self.create()
        path = Path(project["path"]) / "docs/product/oversized.md"
        path.write_bytes(b"x" * (factory_module.MAX_ARTIFACT * 4))
        with patch.object(Path, "read_bytes", side_effect=AssertionError("unbounded read")), self.assertRaisesRegex(Error, "bounded"):
            self.factory.artifact_record(project["id"], "docs/product/oversized.md")

    def test_invalid_product_registry_does_not_hide_other_products(self):
        broken = self.create("Broken engine settings")
        healthy = self.create("Healthy engine settings")
        (Path(broken["path"]) / ".foundry/providers.json").write_text("{}")
        snapshot = self.factory.snapshot()
        self.assertEqual(snapshot["project_providers"][broken["id"]], [])
        self.assertIn(broken["id"], snapshot["provider_errors"])
        self.assertIn("fixture", {item["name"] for item in snapshot["project_providers"][healthy["id"]]})
        self.assertEqual(len(snapshot["projects"]), 2)

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

    def use_task_fake(self):
        self.fake.write_text(textwrap.dedent(TASK_FAKE), encoding="utf-8")

    def test_task_checks_validate_fresh_reports_and_counts(self):
        project = self.create()
        root = Path(project["path"])
        producer = (
            "import json, os; from pathlib import Path; "
            "p=Path(os.environ['FOUNDRY_TEST_REPORT']); p.parent.mkdir(parents=True,exist_ok=True); "
            "p.write_text(json.dumps({'run_id':os.environ['FOUNDRY_CHECK_ID'],'tests':COUNTS}))"
        )
        for counts, passed in ((dict(executed=1, passed=1, failed=0, skipped=0), True),
                               (dict(executed=0, passed=0, failed=0, skipped=0), False),
                               (dict(executed=1, passed=0, failed=1, skipped=0), False),
                               (dict(executed=1, passed=1, failed=0, skipped=1), False)):
            with self.subTest(counts=counts):
                check = {"name": "report", "command": [sys.executable, "-c", producer.replace("COUNTS", repr(counts))],
                         "test_report": "reports/tests.json"}
                with patch.object(factory_module.foundry, "checks", return_value=[check]):
                    failures, missing = self.factory._run_checks(project["id"], root, "report")
                self.assertIsNone(missing)
                self.assertEqual(failures == [], passed)
                if failures:
                    self.assertIn("Test report", failures[0]["log"])
        stale = {"name": "stale", "command": [sys.executable, "-c", "pass"], "test_report": "reports/tests.json"}
        with patch.object(factory_module.foundry, "checks", return_value=[stale]):
            failures, _ = self.factory._run_checks(project["id"], root, "stale")
        self.assertEqual(failures[0]["status"], "failed")
        self.assertIn("identify this execution", failures[0]["log"])

    def test_missing_task_check_command_enters_bounded_fix_loop(self):
        project = self.create()
        root = Path(project["path"])
        tasks = [{"title": "Set up tests", "status": "working"}]
        check = {"name": "missing", "command": [str(root / "missing-executable")]}
        with patch.object(factory_module.foundry, "checks", return_value=[check]), \
                patch.object(self.factory, "_dispatch") as dispatch:
            with self.assertRaisesRegex(Error, "Checks still fail after 3 fix attempts: missing") as failure:
                self.factory._check_and_fix(project["id"], root, tasks, tasks[0], True, None, None)
        self.assertIn("missing-executable", str(failure.exception))
        self.assertEqual(dispatch.call_count, 3)
        self.assertEqual(tasks[0]["status"], "failed")
        logs = list((root / factory_module.TASK_CHECKS).glob("*/missing.log"))
        self.assertEqual(len(logs), 4)
        self.assertTrue(all("missing-executable" in log.read_text() for log in logs))

    def test_provider_failure_exposes_a_bounded_redacted_cause_on_both_paths(self):
        project = self.create()
        sentinel = "fixture-private-value-not-real"
        result = {"status": "failed", "attempts": [{"error": {
            "code": "permission_denied", "message": "Review role cannot write: read-only sandbox " + sentinel + " x" * 1000,
        }}]}
        with patch.dict(factory_module.providers.os.environ, {"ACCESS_TOKEN": sentinel}):
            with self.assertRaisesRegex(Error, "permission_denied.*read-only sandbox") as failure:
                self.factory._integrate(project, result)
            self.assertNotIn(sentinel, str(failure.exception))
            self.assertIn("keep read-only review permissions", str(failure.exception))
            self.assertLess(len(str(failure.exception)), 1200)
            with patch.object(factory_module.providers, "execute", return_value=result), self.assertRaisesRegex(
                    Error, "permission_denied.*read-only sandbox"):
                self.factory._dispatch(project["id"], {"marker": "fixture", "text": ""}, None, None, None)

    def test_cancel_during_build_check_can_retry_without_restart(self):
        self.fake.write_text(textwrap.dedent(FAKE).replace(
            "import time; time.sleep(30)",
            "import time; from pathlib import Path; time.sleep(30) if Path('SLEEP_NOW').exists() else None"))
        project = self.advance_to_build(self.create("Cancelable Build"))
        root = Path(project["path"])
        (root / "SLOW_CHECK").write_text("fixture")
        (root / "SLEEP_NOW").write_text("fixture")
        outcome = []
        worker = threading.Thread(target=lambda: outcome.append(self.factory.run(project["id"])), daemon=True)
        worker.start()
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            if list((root / factory_module.TASK_CHECKS).glob("*")):
                break
            time.sleep(0.05)
        else:
            self.fail("build check did not start")
        self.factory.cancel(project["id"])
        worker.join(8)
        self.assertFalse(worker.is_alive())
        self.assertEqual(outcome[0]["status"], "interrupted")
        (root / "SLEEP_NOW").unlink()
        retried = self.factory.run(project["id"])
        self.assertEqual((retried["stage"], retried["status"]), ("verify", "completed"))

    def test_build_runs_small_tasks_with_checks_fixes_and_checkpoints(self):
        self.use_task_fake()
        project = self.advance_to_build(self.create("Task Product"))
        root = Path(project["path"])
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("verify", "completed"))
        tasks = project["stage_verification"]["build"]["tasks"]
        self.assertEqual([item["title"] for item in tasks], ["Add the value function", "Add the behavior test"])
        self.assertTrue(all(item["status"] == "done" and item["checks"] == "passed" for item in tasks))
        self.assertEqual([item.get("fix_attempts") for item in tasks], [1, 1])
        self.assertIn({"path": "docs/product/tasks.md", "stage": "build"}, project["artifacts"])
        self.assertNotIn("- [ ]", (root / "docs/product/tasks.md").read_text())
        prompts = (root / "PROMPTS.log").read_text()
        for marker in ("stage: build, step: tasks", "stage: build, task 1 of 2", "stage: build, fix 1 of 3",
                       "stage: build, task 2 of 2"):
            self.assertIn(marker, prompts)
        log = factory_module.subprocess.run(["git", "log", "--format=%s"], cwd=root, capture_output=True, text=True).stdout
        self.assertIn("Foundry build task 1: Add the value function", log)
        self.assertIn("Foundry build task 2: Add the behavior test", log)
        self.assertEqual([item["commit"] for item in tasks].count(None), 0)

        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("release", "completed"))

    def test_fix_loop_stops_after_bounded_attempts_and_resumes_the_failed_task(self):
        self.use_task_fake()
        project = self.advance_to_build(self.create("Stubborn Product"))
        root = Path(project["path"])
        (root / "ALWAYS_WRONG").write_text("fixture")
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("build", "failed"))
        self.assertIn("Checks still fail after 3 fix attempts: behavior", project["history"][-1]["note"])
        build = project["stage_verification"]["build"]
        self.assertEqual(build["status"], "needs_fix")
        self.assertEqual([item["status"] for item in build["tasks"]], ["failed", "pending"])
        self.assertEqual(build["tasks"][0]["fix_attempts"], 3)
        self.assertEqual((root / "PROMPTS.log").read_text().count("fix "), 3)

        (root / "ALWAYS_WRONG").unlink()
        project = self.factory.run(project["id"])
        self.assertEqual((project["stage"], project["status"]), ("verify", "completed"))
        self.assertEqual([item["status"] for item in project["stage_verification"]["build"]["tasks"]], ["done", "done"])

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

    def test_approval_rejects_document_changed_after_review(self):
        project = self.create("Review Revision Product")
        project = self.factory.run(project["id"])
        project = self.factory.run(project["id"])
        reviewed = self.factory.artifact_record(project["id"], "docs/specs/product.md")
        spec = Path(project["path"]) / "docs/specs/product.md"
        spec.write_text(spec.read_text() + "\n- AC-2: added after the owner read the document.\n")

        with self.assertRaisesRegex(Error, "reviewed document changed"):
            self.factory.approve(project["id"], reviewed_revision=reviewed["revision"])

        current = self.factory.snapshot()["projects"][0]
        self.assertEqual((current["stage"], current["status"]), ("scope", "awaiting_approval"))
        self.assertNotIn("scope", current["approved_stages"])
        latest = self.factory.artifact_record(project["id"], "docs/specs/product.md")
        approved = self.factory.approve(project["id"], reviewed_revision=latest["revision"])
        self.assertEqual(approved["stage"], "design")

    def test_review_revision_uses_exact_crlf_artifact_bytes(self):
        project = self.create("CRLF Review Product")
        project = self.factory.run(project["id"])
        project = self.factory.run(project["id"])
        spec = Path(project["path"]) / "docs/specs/product.md"
        spec.write_bytes(b"# Scope\r\n\r\n## Acceptance criteria\r\n\r\n- AC-1: exact bytes.\r\n")
        reviewed = self.factory.artifact_record(project["id"], "docs/specs/product.md")

        approved = self.factory.approve(project["id"], reviewed_revision=reviewed["revision"])

        self.assertEqual(approved["stage"], "design")
        self.assertEqual(approved["approved_revisions"]["scope"], reviewed["revision"])

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
