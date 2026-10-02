"""Executed local qualification regressions; subprocess evaluators inspect real artifacts."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import qualification as q


class QualificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write("old.txt", "3")
        self.write("new.txt", "4")
        self.spec = {"cases": [{"id": "value", "probe": "local", "minimum_score": 1}]}
        self.write("cases.json", json.dumps(self.spec))
        self.good = '''import json,sys
from pathlib import Path
request=json.load(sys.stdin)
score=float(Path(request['artifact']).read_text())
print(json.dumps({'cases':[{'id':'value','executed':True,'passed':score>=1,'score':score,'cost':None}]}))
'''
        self.write("evaluator.py", self.good)
        q.register(self.root, "old", "old.txt")
        q.register(self.root, "new", "new.txt")

    def write(self, path, value):
        (self.root / path).write_text(value)

    def evaluate(self, identity="old", run="run-1"):
        return q.evaluate(self.root, identity, "cases.json", "evaluator.py", run)

    def test_qualified_baseline_persists_restart_and_requires_explicit_selection(self):
        with self.assertRaises(q.Error):
            q.select(self.root, "old", "run-1")
        receipt = self.evaluate()
        self.assertEqual(receipt["status"], "qualified")
        self.assertIsNone(receipt["cost"])
        self.assertIsNone(q.load(self.root)["active"])
        q.select(self.root, "old", "run-1")
        # New Python process proves baseline is disk-backed, not an in-memory metric.
        code = "import qualification,json; print(json.dumps(qualification.load(__import__('pathlib').Path(__import__('sys').argv[1]))))"
        result = subprocess.run([sys.executable, "-c", code, str(self.root)],
            env={"PYTHONPATH": str(Path(q.__file__).parent)}, text=True, capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)["active"], "old")
        self.evaluate("new")
        selection = q.select(self.root, "new", "run-1")
        self.assertEqual(selection["incumbent_evaluation"], receipt["id"])

    def test_registration_is_idempotent_and_content_bound(self):
        original = q.register(self.root, "old", "old.txt")
        self.evaluate()
        self.assertEqual(len(q.register(self.root, "old", "old.txt")["evaluations"]), 1)
        self.write("old.txt", "5")
        with self.assertRaises(q.Error):
            q.register(self.root, "old", "old.txt")
        with self.assertRaises(q.Error):
            self.evaluate()
        self.assertEqual(original["artifact"]["path"], "old.txt")

    def test_rejected_and_regressing_candidates_never_replace_active(self):
        self.evaluate()
        q.select(self.root, "old", "run-1")
        self.write("bad.txt", "0")
        q.register(self.root, "bad", "bad.txt")
        self.assertEqual(self.evaluate("bad")["status"], "rejected")
        with self.assertRaises(q.Error):
            q.select(self.root, "bad", "run-1")
        self.write("lower.txt", "2")
        q.register(self.root, "lower", "lower.txt")
        self.assertEqual(self.evaluate("lower")["status"], "qualified")
        with self.assertRaises(q.Error):
            q.select(self.root, "lower", "run-1")
        self.assertEqual(q.load(self.root)["active"], "old")
        self.assertEqual(q.load(self.root)["selections"][-1]["status"], "rejected")

    def test_empty_missing_duplicate_nonfinite_and_false_pass(self):
        invalid = ["{}", '{"cases":[]}', '{"cases":[{"id":"value","executed":true,"passed":true,"score":NaN}]}',
                   '{"cases":[{"id":"value","executed":false,"passed":true,"score":4}]}',
                   '{"cases":[{"id":"value","executed":true,"passed":"true","score":4}]}',
                   '{"cases":[{"id":"value","executed":true,"passed":true,"score":4,"cost":Infinity}]}',
                   '{"cases":[{"id":"other","executed":true,"passed":true,"score":4}]}']
        for payload in invalid:
            with self.subTest(payload=payload):
                self.write("evaluator.py", "print(" + repr(payload) + ")")
                self.assertEqual(self.evaluate()["status"], "blocked")
        self.write("evaluator.py", "print('{\"cases\":[{\"id\":\"value\",\"executed\":true,\"passed\":true,\"score\":0}]}')")
        self.assertEqual(self.evaluate()["status"], "rejected")
        with self.assertRaises(q.Error):
            q.select(self.root, "old", "run-1")

    def test_changed_test_set_evaluator_and_run_require_requalification(self):
        self.evaluate()
        q.select(self.root, "old", "run-1")
        self.spec["cases"][0]["minimum_score"] = 2
        self.write("cases.json", json.dumps(self.spec))
        self.evaluate("new")
        with self.assertRaises(q.Error):
            q.select(self.root, "new", "run-1")
        self.evaluate()
        self.write("evaluator.py", self.good + "\n# changed identity\n")
        self.evaluate("new")
        with self.assertRaises(q.Error):
            q.select(self.root, "new", "run-1")
        self.evaluate()
        with self.assertRaises(q.Error):
            q.select(self.root, "new", "run-2")
        q.select(self.root, "new", "run-1")

    def test_live_and_invalid_test_sets_block_without_execution(self):
        self.write("evaluator.py", "from pathlib import Path; Path('executed').touch()")
        for cases in ([], [{"id": "value", "probe": "live", "minimum_score": 1}],
                      [{"id": "value", "probe": "local", "minimum_score": float('nan')}],
                      self.spec["cases"] * 2):
            self.write("cases.json", json.dumps({"cases": cases}))
            self.assertEqual(self.evaluate()["status"], "blocked")
        self.assertFalse((self.root / "executed").exists())

    def test_exit_timeout_and_input_mutation_are_blocked(self):
        for source in ("raise SystemExit(1)", self.good + "\nPath('cases.json').write_text('{}')"):
            self.write("cases.json", json.dumps(self.spec))
            self.write("evaluator.py", source)
            self.assertEqual(self.evaluate()["status"], "blocked")
        self.write("cases.json", json.dumps(self.spec))
        self.write("evaluator.py", "import time; time.sleep(10)")
        receipt = q.evaluate(self.root, "old", "cases.json", "evaluator.py", "run-1", timeout=.1)
        self.assertEqual(receipt["status"], "blocked")

    def test_selected_artifact_mutation_and_latest_failure_block_selection(self):
        self.evaluate()
        self.write("old.txt", "9")
        with self.assertRaises(q.Error):
            q.select(self.root, "old", "run-1")
        self.write("old.txt", "3")
        self.write("evaluator.py", "print('{}')")
        self.assertEqual(self.evaluate()["status"], "blocked")
        self.write("evaluator.py", self.good)
        with self.assertRaises(q.Error):
            q.select(self.root, "old", "run-1")
        self.assertIsNone(q.load(self.root)["active"])
        self.assertFalse(q.finite(10 ** 1000))

    def test_malformed_extra_fields_and_probe_persist_blocked_receipts(self):
        valid = {"id": "value", "executed": True, "passed": True, "score": 3}
        for extra in (float("nan"), {"nested": float("inf")}, "unsupported"):
            payload = json.dumps({"cases": [dict(valid, extra=extra)]})
            self.write("evaluator.py", "print(" + repr(payload) + ")")
            before = len(q.load(self.root)["candidates"]["old"]["evaluations"])
            receipt = self.evaluate()
            self.assertEqual(receipt["status"], "blocked")
            saved = q.load(self.root)["candidates"]["old"]["evaluations"]
            self.assertEqual(len(saved), before + 1)
            self.assertEqual(saved[-1]["id"], receipt["id"])
            self.assertEqual(saved[-1]["cases"], [])
        self.write("evaluator.py", self.good)
        for probe in ([], {}, None, 1):
            self.spec["cases"][0]["probe"] = probe
            self.write("cases.json", json.dumps(self.spec))
            before = len(q.load(self.root)["candidates"]["old"]["evaluations"])
            self.assertEqual(self.evaluate()["status"], "blocked")
            self.assertEqual(len(q.load(self.root)["candidates"]["old"]["evaluations"]), before + 1)
        self.assertIsNone(q.load(self.root)["active"])

    def test_containment_and_symlinks_rejected(self):
        (self.root / "alias").symlink_to(self.root / "old.txt")
        for path in ("alias", "../outside", str(self.root / "old.txt")):
            with self.subTest(path=path), self.assertRaises(q.Error):
                q.register(self.root, "escape", path)


if __name__ == "__main__":
    unittest.main()
