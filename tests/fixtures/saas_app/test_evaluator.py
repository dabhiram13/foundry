"""The evidence runner must not turn unavailable or failing browser checks green."""

import json
import importlib.util
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("journey_evaluator", ROOT / "scripts/evaluate_journey.py")
evaluator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluator)


class EvidenceRunnerTests(unittest.TestCase):
    def evaluate(self, node):
        with tempfile.TemporaryDirectory() as temporary:
            run = subprocess.run([sys.executable, str(ROOT / "scripts/evaluate_journey.py"),
                                  "--browser-only", "--node", node, "--output-dir", temporary],
                                 capture_output=True, text=True, timeout=15)
            report = json.loads(next(Path(temporary).glob("*/report.json")).read_text())
        return run, report

    def test_absent_node_is_unverified_and_nonzero(self):
        run, report = self.evaluate("/nonexistent-marketcraft-test-node")
        self.assertEqual(run.returncode, 2, run.stderr)
        self.assertEqual(report["status"], "UNVERIFIED")
        browser = next(stage for stage in report["stages"] if stage["name"] == "browser")
        self.assertEqual(browser["status"], "UNVERIFIED")
        self.assertTrue(browser["required"])
        self.assertEqual(next(stage for stage in report["stages"] if stage["name"] == "native_agent_delivery")["status"], "UNVERIFIED")

    def test_failed_executable_is_not_a_pass(self):
        run, report = self.evaluate(sys.executable)  # Python cannot execute the CJS browser suite.
        self.assertEqual(run.returncode, 1, run.stderr)
        self.assertEqual(report["status"], "FAIL")
        self.assertTrue(report["artifact_receipts"])

    def test_zero_exit_without_browser_evidence_is_a_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            executable = Path(temporary) / "empty-browser"
            executable.write_text("#!/bin/sh\nexit 0\n")
            executable.chmod(0o755)
            run, report = self.evaluate(str(executable))
        self.assertEqual(run.returncode, 1, run.stderr)
        self.assertEqual(report["status"], "FAIL")
        browser = next(stage for stage in report["stages"] if stage["name"] == "browser")
        self.assertIn("no evidence", browser["reason"])

    def sleeper(self, temporary):
        directory = Path(temporary)
        pid_file, executable = directory / "grandchild.pid", directory / "sleeping-browser"
        child_code = "import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(60)"
        executable.write_text(f"#!{sys.executable}\nimport subprocess,sys,time\nfrom pathlib import Path\n"
                              f"child = subprocess.Popen([sys.executable, '-c', {child_code!r}], start_new_session=True)\n"
                              f"Path({str(pid_file)!r}).write_text(str(child.pid))\ntime.sleep(60)\n")
        executable.chmod(0o755)
        return executable, pid_file

    def assert_stopped(self, pid):
        # An adopted zombie is terminated even if the host's init has not reaped it.
        for _ in range(40):
            process = subprocess.run(["ps", "-p", str(pid), "-o", "stat="], capture_output=True, text=True)
            if process.returncode != 0 or process.stdout.strip().startswith("Z"):
                return
            time.sleep(.05)
        try:
            os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        self.fail("Timed-out evaluator leaked its detached child process")

    def cleanup_sleeper(self, pid_file):
        if pid_file.exists():
            try:
                os.killpg(int(pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass

    def test_timeout_terminates_detached_browser_grandchild(self):
        with tempfile.TemporaryDirectory() as temporary:
            executable, pid_file = self.sleeper(temporary)
            try:
                result = evaluator.run_stage("timeout", [str(executable)], Path(temporary), os.environ.copy(), 1)
                self.assertEqual(result["status"], "FAIL")
                self.assertTrue(result["cleanup"]["descendant_inventory_available"])
                self.assert_stopped(int(pid_file.read_text()))
            finally:
                self.cleanup_sleeper(pid_file)

    def test_sigterm_terminates_detached_browser_grandchild_and_saves_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            executable, pid_file = self.sleeper(temporary)
            output = Path(temporary) / "reports"
            child = subprocess.Popen([sys.executable, str(ROOT / "scripts/evaluate_journey.py"),
                                      "--browser-only", "--node", str(executable), "--output-dir", str(output)],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                deadline = time.monotonic() + 5
                while not pid_file.exists() and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertTrue(pid_file.exists(), "Browser double did not start")
                child.terminate()
                _stdout, stderr = child.communicate(timeout=10)
                self.assertEqual(child.returncode, 1, stderr)
                report = json.loads(next(output.glob("*/report.json")).read_text())
                self.assertEqual(report["status"], "FAIL")
                self.assert_stopped(int(pid_file.read_text()))
            finally:
                if child.poll() is None:
                    child.kill()
                    child.wait()
                self.cleanup_sleeper(pid_file)


if __name__ == "__main__":
    unittest.main()
