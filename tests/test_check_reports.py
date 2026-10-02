"""Configured test checks must prove a fresh, nonempty execution report."""
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

import test_runtime as runtime

foundry = runtime.foundry


class CheckReportTests(unittest.TestCase):
    def exercise(self, producer, previous=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        check = {'name': 'behavior', 'command': [sys.executable, '-c', producer],
                 'test_report': '.foundry/state/tests.json', 'inputs': ['backend/config.ini']}
        root = runtime.RuntimeTests.make_project(self, Path(temporary.name), [check])
        runtime.RuntimeTests.start(self, root)
        if previous is not None:
            (root / '.foundry/state/tests.json').write_text(json.dumps(previous))
        with redirect_stdout(io.StringIO()):
            code = foundry.verify(root)
        receipt = foundry.read_json(root / foundry.active(root)[1]['verification'])['checks'][0]
        return code, receipt, root

    def producer(self, tests, exit_code=0, run_id=None):
        return ('import json,os,pathlib,sys; '
                f'tests={tests!r}; '
                f'run_id={run_id!r} if {run_id is not None!r} else os.environ["FOUNDRY_CHECK_ID"]; '
                'pathlib.Path(os.environ["FOUNDRY_TEST_REPORT"]).write_text('
                'json.dumps({"run_id":run_id,"tests":tests})); '
                f'sys.exit({exit_code})')

    def test_success_without_report_cannot_pass(self):
        code, receipt, _ = self.exercise('print("success without tests")')
        self.assertEqual(code, 1)
        self.assertEqual(receipt['status'], 'failed')
        self.assertIn('test_report_error', receipt)

    def test_stale_report_cannot_be_reused_by_noop(self):
        code, receipt, _ = self.exercise('pass', {'run_id': 'old', 'tests':
            {'executed': 1, 'passed': 1, 'failed': 0, 'skipped': 0}})
        self.assertEqual(code, 1)
        self.assertNotIn('tests', receipt)

    def test_zero_skipped_inconsistent_and_noninteger_counts_fail(self):
        cases = [dict(executed=0, passed=0, failed=0, skipped=0),
                 dict(executed=1, passed=1, failed=0, skipped=1),
                 dict(executed=2, passed=1, failed=0, skipped=0),
                 dict(executed=True, passed=1, failed=0, skipped=0),
                 dict(executed=1, passed=1, failed=-1, skipped=0)]
        for counts in cases:
            with self.subTest(counts=counts):
                code, _, _ = self.exercise(self.producer(counts))
                self.assertEqual(code, 1)

    def test_real_execution_pins_report_and_counts(self):
        counts = dict(executed=1, passed=1, failed=0, skipped=0)
        code, receipt, root = self.exercise(self.producer(counts))
        self.assertEqual(code, 0)
        self.assertEqual(receipt['tests'], counts)
        self.assertGreaterEqual(receipt['duration_seconds'], 0)
        report = root / receipt['test_report']
        self.assertEqual(receipt['test_report_sha256'], foundry.digest(report.read_bytes()))
        self.assertEqual(json.loads(report.read_text())['run_id'], receipt['check_run_id'])

    def test_completion_requires_unchanged_retained_test_report(self):
        counts = dict(executed=1, passed=1, failed=0, skipped=0)
        for mutation in ("missing", "changed"):
            with self.subTest(mutation=mutation):
                code, receipt, root = self.exercise(self.producer(counts))
                self.assertEqual(code, 0)
                report = root / receipt["test_report"]
                if mutation == "missing":
                    report.unlink()
                else:
                    report.write_text(report.read_text() + " ")
                with self.assertRaisesRegex(foundry.Error, "test report missing or changed"):
                    foundry.complete(root)

    def test_completion_rechecks_nonce_counts_and_required_pass(self):
        counts = dict(executed=1, passed=1, failed=0, skipped=0)
        for mutation in ("nonce", "receipt_counts", "zero", "failed", "skipped", "boolean"):
            with self.subTest(mutation=mutation):
                code, receipt, root = self.exercise(self.producer(counts))
                self.assertEqual(code, 0)
                report = root / receipt["test_report"]
                data = json.loads(report.read_text())
                evidence_path = root / foundry.active(root)[1]["verification"]
                evidence = foundry.read_json(evidence_path)
                saved = evidence["checks"][0]
                if mutation == "nonce":
                    data["run_id"] = "different-execution"
                elif mutation == "receipt_counts":
                    saved["tests"] = dict(executed=2, passed=2, failed=0, skipped=0)
                else:
                    replacements = {
                        "zero": dict(executed=0, passed=0, failed=0, skipped=0),
                        "failed": dict(executed=1, passed=0, failed=1, skipped=0),
                        "skipped": dict(executed=1, passed=1, failed=0, skipped=1),
                        "boolean": dict(executed=True, passed=1, failed=0, skipped=0),
                    }
                    data["tests"] = replacements[mutation]
                    saved["tests"] = data["tests"]
                report.write_text(json.dumps(data))
                saved["test_report_sha256"] = foundry.digest(report.read_bytes())
                evidence_path.write_text(json.dumps(evidence))
                with self.assertRaisesRegex(foundry.Error, "[Tt]est report"):
                    foundry.complete(root)

    def test_optional_missing_report_does_not_block_completion(self):
        with tempfile.TemporaryDirectory() as temporary:
            checks = [
                {"name": "required", "command": [sys.executable, "-c", "pass"]},
                {"name": "optional", "command": [sys.executable, "-c", "raise SystemExit(1)"],
                 "required": False, "test_report": ".foundry/state/optional.json"},
            ]
            root = runtime.RuntimeTests.make_project(self, Path(temporary), checks)
            runtime.RuntimeTests.start(self, root)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
                self.assertEqual(foundry.complete(root), 0)

    def test_optional_retained_report_still_rejects_tampering(self):
        with tempfile.TemporaryDirectory() as temporary:
            checks = [
                {"name": "required", "command": [sys.executable, "-c", "pass"]},
                {"name": "optional", "command": [sys.executable, "-c", self.producer(
                    dict(executed=1, passed=0, failed=1, skipped=0), exit_code=1)],
                 "required": False, "test_report": ".foundry/state/optional.json"},
            ]
            root = runtime.RuntimeTests.make_project(self, Path(temporary), checks)
            runtime.RuntimeTests.start(self, root)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(foundry.verify(root), 0)
            state = foundry.active(root)[1]
            foundry.completion_evidence(root, state)
            receipt = foundry.read_json(root / state["verification"])["checks"][1]
            (root / receipt["test_report"]).unlink()
            with self.assertRaisesRegex(foundry.Error, "test report missing or changed"):
                foundry.complete(root)

    def test_valid_retained_test_report_allows_completion(self):
        code, _, root = self.exercise(self.producer(dict(executed=1, passed=1, failed=0, skipped=0)))
        self.assertEqual(code, 0)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(foundry.complete(root), 0)

    def test_failing_execution_retains_red_counts(self):
        counts = dict(executed=1, passed=0, failed=1, skipped=0)
        code, receipt, _ = self.exercise(self.producer(counts, exit_code=1))
        self.assertEqual(code, 1)
        self.assertEqual(receipt['tests'], counts)
        self.assertEqual(receipt['exit_code'], 1)

    def test_report_path_cannot_escape_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = runtime.RuntimeTests.make_project(self, Path(tmp), [
                {'name':'unsafe', 'command':[sys.executable, '-c', 'pass'],
                 'test_report':'../outside.json'}])
            with self.assertRaises(foundry.Error):
                foundry.checks(root)
