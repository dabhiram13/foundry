"""Exercise the report producer as an actual unittest subprocess."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class TestRunnerTests(unittest.TestCase):
    def run_suite(self, body):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'test_sample.py').write_text('import unittest\n' + body)
            report = root / 'report.json'
            result = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] /
                'scripts/test_runner.py'), '--start', str(root)], capture_output=True,
                text=True, env={**os.environ, 'FOUNDRY_TEST_REPORT': str(report),
                                'FOUNDRY_CHECK_ID': 'execution-identity'}, timeout=10)
            data = json.loads(report.read_text())
            self.assertEqual(data['run_id'], 'execution-identity')
            return result.returncode, data['tests']

    def test_pass_and_empty_suite(self):
        code, counts = self.run_suite('class Sample(unittest.TestCase):\n def test_ok(self): self.assertEqual(2 + 2, 4)\n')
        self.assertEqual((code, counts), (0, dict(executed=1, passed=1, failed=0, skipped=0)))
        code, counts = self.run_suite('')
        self.assertEqual(code, 1)
        self.assertEqual(counts['executed'], 0)

    def test_multiple_failing_subtests_count_one_failed_case(self):
        code, counts = self.run_suite('class Sample(unittest.TestCase):\n def test_bad(self):\n  for i in range(2):\n   with self.subTest(i=i): self.assertEqual(i, 3)\n')
        self.assertEqual((code, counts), (1, dict(executed=1, passed=0, failed=1, skipped=0)))

    def test_multiple_skipped_subtests_never_make_negative_counts(self):
        code, counts = self.run_suite('class Sample(unittest.TestCase):\n def test_skip(self):\n  for i in range(2):\n   with self.subTest(i=i): self.skipTest("missing capability")\n')
        self.assertEqual((code, counts), (1, dict(executed=0, passed=0, failed=0, skipped=1)))

    def test_expected_failure_is_not_passing_coverage(self):
        code, counts = self.run_suite('class Sample(unittest.TestCase):\n @unittest.expectedFailure\n def test_known_bad(self): self.fail("unfixed")\n')
        self.assertEqual((code, counts), (1, dict(executed=0, passed=0, failed=0, skipped=1)))

    def test_project_package_import_matches_module_discovery(self):
        code, counts = self.run_suite('from scripts.check_catalog import validate\n'
            'class Sample(unittest.TestCase):\n def test_import(self): self.assertTrue(callable(validate))\n')
        self.assertEqual((code, counts), (0, dict(executed=1, passed=1, failed=0, skipped=0)))
