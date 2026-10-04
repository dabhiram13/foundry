from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
import time
import unittest

from test_factory import FAKE


ROOT = Path(__file__).resolve().parents[1]
WRAPPER = """
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / "scripts"))
from factory_cli import main
raise SystemExit(main(sys.argv[2:], root=Path.cwd(), state_dir=Path(sys.argv[1])))
"""


class FactoryCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="foundry cli-")
        self.base = Path(self.temp.name)
        self.products = self.base / "products"
        self.state = self.base / "factory-data"
        self.calls = self.base / "provider-calls.log"
        self.fake = self.base / "fake_provider.py"
        self.fake.write_text(FAKE, encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def cli(self, *arguments):
        environment = os.environ.copy()
        environment["FOUNDRY_CLI_CALLS"] = str(self.calls)
        return subprocess.run(
            [sys.executable, "-c", WRAPPER, str(self.state), *map(str, arguments)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=30,
            env=environment,
        )

    def projects(self):
        path = self.state / ".foundry/state/factory/projects.json"
        return json.loads(path.read_text(encoding="utf-8"))["projects"]

    def project(self, slug):
        return next(item for item in self.projects() if item["slug"] == slug)

    def configure_fixture(self, slug):
        product = Path(self.project(slug)["path"])
        (product / ".foundry/providers.json").write_text(json.dumps({"adapters": [{
            "name": "fixture",
            "kind": "agent-runtime",
            "command": [sys.executable, str(self.fake)],
            "capabilities": ["jsonl", "cancel", "permissions", "resume", "tools"],
            "billing_modes": ["local"],
        }]}), encoding="utf-8")
        configured = self.cli("--products-dir", self.products, "configure", slug, "--provider", "fixture")
        self.assertEqual(configured.returncode, 0, configured.stderr)

    def new_project(self, name="CLI Proof"):
        result = self.cli(
            "--products-dir", self.products, "new", name,
            "--idea", "Keep one useful local journey understandable.",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        self.assertEqual(self.project(slug)["slug"], slug)
        self.assertIn("Research ready", result.stdout)
        self.assertIn("Location:", result.stdout)
        self.assertIn("Next:", result.stdout)
        self.configure_fixture(slug)
        return slug

    def test_help_and_factory_state_are_shared_with_browser_service(self):
        for arguments in ([], ["--help"]):
            help_result = subprocess.run(
                [str(ROOT / "foundry"), *arguments],
                cwd=ROOT, text=True, capture_output=True, timeout=30,
            )
            self.assertEqual(help_result.returncode, 0, help_result.stderr)
            self.assertNotIn("127.0.0.1", help_result.stdout)
        for command in ("new", "list", "status", "configure", "run", "review", "approve", "stop", "providers"):
            self.assertIn(command, help_result.stdout)
        self.assertIn("./foundry ui", help_result.stdout)
        for arguments in (
            ["ui", "--help"],
            ["--products-dir", str(self.products), "ui", "--help"],
        ):
            ui_help = subprocess.run(
                [str(ROOT / "foundry"), *arguments],
                cwd=ROOT, text=True, capture_output=True, timeout=30,
            )
            self.assertEqual(ui_help.returncode, 0, ui_help.stderr)
            self.assertIn("--products-dir", ui_help.stdout)
            self.assertIn("--port", ui_help.stdout)
        bad_command = subprocess.run(
            [str(ROOT / "foundry"), "--products-dir", str(self.products), "not-a-command"],
            cwd=ROOT, text=True, capture_output=True, timeout=30,
        )
        self.assertEqual(bad_command.returncode, 2)
        self.assertIn("invalid choice", bad_command.stderr)

        slug = self.new_project()
        initial = self.cli("--products-dir", self.products, "status", slug)
        self.assertEqual(initial.returncode, 0, initial.stderr)
        self.assertIn("Research ready", initial.stdout)
        uuid_result = self.cli("--products-dir", self.products, "status", self.project(slug)["id"])
        self.assertEqual(uuid_result.returncode, 0, uuid_result.stderr)
        unknown = self.cli("--products-dir", self.products, "status", "not-a-project")
        self.assertEqual(unknown.returncode, 2)
        self.assertIn("exact slug or UUID", unknown.stderr)

        omitted = self.cli("--products-dir", self.products, "configure", slug, "--model", "fixture-model", "--reasoning", "high")
        self.assertEqual(omitted.returncode, 0, omitted.stderr)
        before = self.project(slug)
        unchanged = self.cli("--products-dir", self.products, "configure", slug, "--provider", "fixture")
        self.assertEqual(unchanged.returncode, 0, unchanged.stderr)
        self.assertEqual(self.project(slug)["model"], before["model"])
        self.assertEqual(self.project(slug)["reasoning"], before["reasoning"])
        empty = self.cli("--products-dir", self.products, "configure", slug, "--model", "", "--reasoning", "")
        self.assertEqual(empty.returncode, 0, empty.stderr)
        self.assertIsNone(self.project(slug)["model"])
        self.assertIsNone(self.project(slug)["reasoning"])

        research = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(research.returncode, 0, research.stderr)
        self.assertIn("Plan ready", research.stdout)
        calls = self.calls.read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(calls), 1)
        plan = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(plan.returncode, 0, plan.stderr)
        self.assertIn("awaiting approval", plan.stdout)
        review_before_stop = self.cli("--products-dir", self.products, "review", slug)
        self.assertEqual(review_before_stop.returncode, 0, review_before_stop.stderr)
        revision_before_stop = re.search(
            r"Revision \(SHA-256\): ([0-9a-f]{64})", review_before_stop.stdout,
        ).group(1)
        before_stop = self.project(slug)
        stopped = self.cli("--products-dir", self.products, "stop", slug)
        self.assertEqual(stopped.returncode, 0, stopped.stderr)
        self.assertIn("Project state is unchanged", stopped.stdout)
        self.assertEqual(self.project(slug)["status"], "awaiting_approval")
        self.assertEqual(self.project(slug)["history"], before_stop["history"])
        review_after_stop = self.cli("--products-dir", self.products, "review", slug)
        self.assertEqual(review_after_stop.returncode, 0, review_after_stop.stderr)
        revision_after_stop = re.search(
            r"Revision \(SHA-256\): ([0-9a-f]{64})", review_after_stop.stdout,
        ).group(1)
        self.assertEqual(revision_after_stop, revision_before_stop)
        blocked = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(blocked.returncode, 2)
        self.assertEqual(len(self.calls.read_text(encoding="utf-8").splitlines()), 2)

        review = self.cli("--products-dir", self.products, "review", slug)
        self.assertEqual(review.returncode, 0, review.stderr)
        revision = re.search(r"Revision \(SHA-256\): ([0-9a-f]{64})", review.stdout).group(1)
        self.assertIn("--revision", review.stdout)
        self.assertIn(shlex.quote(str(self.products.resolve())), review.stdout)
        other_document = self.cli("--products-dir", self.products, "review", slug, "--path", "docs/product/research.md")
        self.assertEqual(other_document.returncode, 0, other_document.stderr)
        blocked_path = self.cli("--products-dir", self.products, "review", slug, "--path", "../.foundry/providers.json")
        self.assertEqual(blocked_path.returncode, 2)
        document = Path(self.project(slug)["path"]) / "docs/specs/product.md"
        document.write_text(document.read_text(encoding="utf-8") + "\nOwner revision.\n", encoding="utf-8")
        stale = self.cli("--products-dir", self.products, "approve", slug, "--revision", revision)
        self.assertEqual(stale.returncode, 2)
        self.assertIn("changed", stale.stderr)
        self.assertEqual(self.project(slug)["status"], "awaiting_approval")
        current = self.cli("--products-dir", self.products, "review", slug)
        current_revision = re.search(r"Revision \(SHA-256\): ([0-9a-f]{64})", current.stdout).group(1)
        approved = self.cli("--products-dir", self.products, "approve", slug, "--revision", current_revision)
        self.assertEqual(approved.returncode, 0, approved.stderr)
        self.assertIn("Design ready", approved.stdout)
        self.assertEqual(self.project(slug)["stage"], "design")

        sys.path.insert(0, str(ROOT / "scripts"))
        from factory_ui import Service
        snapshot = Service(root=ROOT, products_dir=self.products, data_dir=self.state).snapshot()
        self.assertEqual(snapshot["projects"][0]["stage"], "design")

        listed = self.cli("--products-dir", self.products, "list")
        self.assertIn(f"{slug}\t", listed.stdout)
        metadata = self.cli("--products-dir", self.products, "providers", slug)
        self.assertEqual(metadata.returncode, 0, metadata.stderr)
        self.assertIn("fixture (agent-runtime)", metadata.stdout)
        self.assertIn("not live-validated", metadata.stdout)

    def test_codex_subscription_confirmation_is_required_before_dispatch(self):
        result = self.cli(
            "--products-dir", self.products, "new", "Unconfirmed Codex",
            "--idea", "Keep one useful local journey understandable.",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        slug = "unconfirmed-codex"
        before = self.project(slug)
        run = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(run.returncode, 2)
        self.assertIn("confirm the Codex subscription login", run.stderr)
        self.assertIn("configure", run.stdout)
        self.assertEqual(self.project(slug)["status"], "completed")
        self.assertEqual(self.project(slug)["history"], before["history"])
        tasks = Path(before["path"]) / ".foundry/state/providers/tasks"
        self.assertFalse(tasks.exists() and list(tasks.iterdir()))

    def test_cli_completes_all_six_steps_and_reports_ship_only_after_matching_receipt(self):
        slug = self.new_project("Six Step Proof")
        product = Path(self.project(slug)["path"])

        research = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(research.returncode, 0, research.stderr)
        self.assertIn("Plan ready", research.stdout)
        plan = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(plan.returncode, 0, plan.stderr)
        self.assertIn("Plan awaiting approval", plan.stdout)
        plan_review = self.cli("--products-dir", self.products, "review", slug)
        plan_revision = re.search(r"Revision \(SHA-256\): ([0-9a-f]{64})", plan_review.stdout).group(1)
        plan_approval = self.cli("--products-dir", self.products, "approve", slug, "--revision", plan_revision)
        self.assertEqual(plan_approval.returncode, 0, plan_approval.stderr)
        self.assertIn("Design ready", plan_approval.stdout)

        design = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(design.returncode, 0, design.stderr)
        self.assertIn("Design awaiting approval", design.stdout)
        design_review = self.cli("--products-dir", self.products, "review", slug)
        design_revision = re.search(r"Revision \(SHA-256\): ([0-9a-f]{64})", design_review.stdout).group(1)
        design_approval = self.cli("--products-dir", self.products, "approve", slug, "--revision", design_revision)
        self.assertEqual(design_approval.returncode, 0, design_approval.stderr)
        self.assertIn("Build ready", design_approval.stdout)

        build = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(build.returncode, 0, build.stderr)
        self.assertIn("Test ready", build.stdout)
        self.assertEqual(self.project(slug)["stage"], "verify")

        test = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(test.returncode, 0, test.stderr)
        self.assertIn("Ship ready", test.stdout)
        self.assertIn(f"--products-dir {shlex.quote(str(self.products.resolve()))} run {slug}", test.stdout)
        self.assertEqual(self.project(slug)["stage_verification"].get("release"), None)

        ship = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(ship.returncode, 0, ship.stderr)
        self.assertIn("Current state: Ship completed", ship.stdout)
        self.assertIn("No further factory stage", ship.stdout)
        self.assertTrue((product / "docs/product/release.md").is_file())
        completed = self.project(slug)
        release = completed["stage_verification"]["release"]
        self.assertEqual(release["status"], "passed")
        self.assertTrue(completed["lifecycle_run_id"])
        self.assertEqual(release["run_id"], completed["lifecycle_run_id"])

    def test_stop_failed_run_and_registered_adapter_do_not_fallback(self):
        slug = self.new_project("Failure Proof")
        product = Path(self.project(slug)["path"])
        before = self.project(slug)
        stop = self.cli("--products-dir", self.products, "stop", slug)
        self.assertEqual(stop.returncode, 0, stop.stderr)
        self.assertIn("Project state is unchanged", stop.stdout)
        self.assertEqual(self.project(slug)["status"], "completed")
        self.assertEqual(self.project(slug)["history"], before["history"])
        (product / "FAIL").write_text("", encoding="utf-8")
        failed = self.cli("--products-dir", self.products, "run", slug)
        self.assertEqual(failed.returncode, 1, failed.stderr)
        self.assertIn("failed", failed.stdout.lower())
        self.assertEqual(self.project(slug)["adapter"], "fixture")
        task_files = list((product / ".foundry/state/providers/tasks").glob("*.json"))
        self.assertTrue(task_files)
        self.assertTrue(all(json.loads(path.read_text(encoding="utf-8"))["settings"]["adapter"] == "fixture"
                            for path in task_files))

    def test_stop_live_provider_returns_cancellation_exit_code(self):
        slug = self.new_project("Cancellation Proof")
        product = Path(self.project(slug)["path"])
        (product / "SLOW").write_text("", encoding="utf-8")
        command = [sys.executable, "-c", WRAPPER, str(self.state), "--products-dir", str(self.products), "run", slug]
        process = subprocess.Popen(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and self.project(slug)["status"] != "running":
                time.sleep(0.05)
            self.assertEqual(self.project(slug)["status"], "running")
            stop = self.cli("--products-dir", self.products, "stop", slug)
            self.assertEqual(stop.returncode, 0, stop.stderr)
            stdout, stderr = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 130, f"{stdout}\n{stderr}")
            self.assertEqual(self.project(slug)["status"], "interrupted")
        finally:
            if process.poll() is None:
                self.cli("--products-dir", self.products, "stop", slug)
                try:
                    process.communicate(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    unittest.main()
