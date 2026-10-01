"""Behavior contracts for the product-owned workflow ledger and guidance."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import workflow


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        (self.root / ".foundry").mkdir()
        (self.root / ".foundry/project.json").write_text('{"name":"Example","checks":[]}')
        (self.root / "spec.md").write_text("A local CLI saves and reloads a note.\n")
        (self.root / "app.py").write_text("print('saved and reloaded')\n")

    def item(self, kind, identity, **fields):
        return {
            "id": identity, "kind": kind, "title": identity,
            "source": {"kind": "owner", "ref": "Owner request in this task", "observed_at": "2026-10-01"},
            "basis": "observed", "status": "accepted", **fields,
        }

    def add(self, kind, identity, **fields):
        return workflow.record(self.root, self.item(kind, identity, **fields))

    def criterion(self, identity="save-note", **fields):
        return self.add("criterion", identity, stage="verify", required=True,
                        method="command", expected="A note survives reopening",
                        command=[sys.executable, "app.py"], inputs=["app.py", "spec.md"], **fields)

    def observed_check(self, identity="check-save", **fields):
        inputs_before = {name: hashlib.sha256((self.root / name).read_bytes()).hexdigest() for name in ("app.py", "spec.md")}
        proc = subprocess.run([sys.executable, "app.py"], cwd=self.root, capture_output=True, check=False)
        inputs_after = {name: hashlib.sha256((self.root / name).read_bytes()).hexdigest() for name in ("app.py", "spec.md")}
        (self.root / "check.log").write_bytes(proc.stdout + proc.stderr)
        receipt = {"command": [sys.executable, "app.py"], "exit_code": proc.returncode,
                   "status": "passed" if proc.returncode == 0 else "failed",
                   "log": "check.log", "log_sha256": hashlib.sha256((self.root / "check.log").read_bytes()).hexdigest(),
                   "input_revisions": inputs_before, "input_revisions_after": inputs_after}
        (self.root / "receipt.json").write_text(json.dumps(receipt))
        return self.add("evidence", identity, claim="Save and reload worked", method="command",
                        outcome="pass" if proc.returncode == 0 else "fail", observed=proc.stdout.decode(),
                        artifact="receipt.json", criteria=["save-note"], **fields)

    def tree(self):
        return {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}

    def test_readonly_guidance_and_planning_never_create_run_or_ledger(self):
        before = self.tree()
        result = workflow.guide(self.root, request="Plan a small local notes CLI", intent="plan", complexity="small", surface="cli")
        self.assertEqual(result["current"]["intent"], "plan")
        self.assertIn("plan", result["next"]["action"].lower())
        self.assertEqual([step["stage"] for step in result["path"]], ["scope", "build", "verify"])
        self.assertEqual(workflow.context(self.root)["records"], [])
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")
        self.assertEqual(self.tree(), before)
        self.assertFalse((self.root / ".foundry/state").exists())

    def test_product_path_and_unsupported_capability_are_explicit(self):
        result = workflow.guide(self.root, request="A paid browser app", intent="implement", complexity="product",
                                surface="web", required=["browser", "billing-sandbox"], available=["browser"])
        self.assertIn("research", [step["stage"] for step in result["path"]])
        self.assertIn("prototype", [step["stage"] for step in result["path"]])
        self.assertIn("learn", [step["stage"] for step in result["path"]])
        self.assertEqual(result["user_needed"][0]["capability"], "billing-sandbox")
        self.assertIn("connect", result["user_needed"][0]["action"].lower())
        self.assertFalse((self.root / "docs/project/marketcraft.json").exists())

    def test_persistent_context_across_process_restart(self):
        self.add("brief", "brief-v1", goal="Make local notes", buyer="Myself", intent="plan", complexity="small",
                 surface="cli", constraints=["No network"], capabilities=[], accepted_by="Sri", acceptance_ref="Owner approved local plan")
        result = subprocess.run([sys.executable, str(Path(workflow.__file__)), "--project", str(self.root), "context"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        records = json.loads(result.stdout)["records"]
        self.assertEqual(records[0]["id"], "brief-v1")
        self.assertEqual(records[0]["freshness"], "active")
        self.assertEqual(workflow.guide(self.root)["current"]["complexity"], "small")
        self.assertEqual(workflow.guide(self.root)["request"], "Make local notes")

    def test_new_request_does_not_inherit_previous_implementation_intent(self):
        self.add("brief", "implementation-brief", goal="Make local notes", buyer="Myself", intent="implement", complexity="small",
                 surface="cli", constraints=[], capabilities=[], accepted_by="Sri", acceptance_ref="Owner approved this implementation")
        self.criterion()
        self.assertEqual(workflow.guide(self.root)["current"]["intent"], "implement")
        result = workflow.guide(self.root, request="Read-only review of the current product; do not implement any changes")
        self.assertEqual(result["current"]["intent"], "plan")
        self.assertIn("plan", result["next"]["action"].lower())
        self.assertFalse((self.root / ".foundry/state").exists())

    def test_missing_provenance_and_unknown_fields_rejected_before_write(self):
        before = self.tree()
        bad = self.item("assumption", "demand", validation="Interview buyers")
        del bad["source"]["observed_at"]
        with self.assertRaisesRegex(workflow.foundry.Error, "observed_at"):
            workflow.record(self.root, bad)
        with self.assertRaisesRegex(workflow.foundry.Error, "Unknown"):
            workflow.record(self.root, self.item("assumption", "other", validation="Interview buyers", approved=True))
        self.assertEqual(self.tree(), before)

    def test_unknown_cross_project_and_symlink_references_rejected(self):
        with self.assertRaisesRegex(workflow.foundry.Error, "Unknown reference"):
            self.add("decision", "choice", rationale="Fits buyer", references=["other-project:decision"], accepted_by="Sri", acceptance_ref="Owner request")
        for bad in ["../escape.md", "/tmp/other-project.md"]:
            with self.subTest(path=bad), self.assertRaises(workflow.foundry.Error):
                self.add("assumption", "path", validation="Review", inputs=[bad])
        (self.root / "foreign").symlink_to(Path(self.tmp.name).parent, target_is_directory=True)
        with self.assertRaises(workflow.foundry.Error):
            self.add("assumption", "link", validation="Review", inputs=["foreign/file.md"])

    def test_supersession_preserves_history_and_invalidates_dependents(self):
        self.add("assumption", "price-v1", validation="Interview buyers")
        self.add("decision", "packaging", rationale="Try a paid tier", references=["price-v1"], accepted_by="Sri", acceptance_ref="Owner decision")
        self.add("assumption", "price-v2", validation="Measure an actual offer", supersedes="price-v1")
        records = {r["id"]: r for r in workflow.context(self.root)["records"]}
        self.assertEqual(records["price-v1"]["freshness"], "superseded")
        self.assertEqual(records["packaging"]["freshness"], "stale")
        self.assertEqual(records["price-v2"]["freshness"], "active")
        with self.assertRaisesRegex(workflow.foundry.Error, "already exists"):
            self.add("assumption", "price-v1", validation="Overwrite")
        self.assertEqual(len(workflow.context(self.root)["records"]), 3)

    def test_gate_needs_observed_artifact_and_exact_command_evidence(self):
        self.criterion()
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")
        self.add("evidence", "agent-label", claim="The agent says PASS", criteria=["save-note"])
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")
        self.observed_check()
        self.assertEqual(workflow.gate(self.root)["status"], "pass")
        (self.root / "check.log").write_text("modified observation")
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")

    def test_changed_declared_input_and_contract_are_stale(self):
        self.add("artifact", "contract-v1", path="spec.md", stage="scope", owner="coordinator", next_action="Implement save", criteria=[])
        self.criterion(contracts=["contract-v1"])
        self.observed_check()
        self.assertEqual(workflow.gate(self.root)["status"], "pass")
        (self.root / "app.py").write_text("raise RuntimeError('regression')")
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")
        self.assertIn("stale", workflow.context(self.root)["next_action"].lower())
        (self.root / "app.py").write_text("print('saved and reloaded')\n")
        self.add("artifact", "contract-v2", path="spec.md", stage="scope", owner="coordinator", next_action="Implement v2", criteria=[], supersedes="contract-v1")
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")

    def test_unresolved_failure_cannot_be_hidden_by_another_pass(self):
        self.criterion()
        (self.root / "failure.txt").write_text("Reopening loses the saved note")
        self.add("evidence", "failure", claim="State was lost", criteria=["save-note"], method="manual", outcome="fail",
                 observed="The second process loaded an empty list", artifact="failure.txt")
        self.observed_check()
        self.assertEqual(workflow.gate(self.root)["status"], "fail")
        self.add("evidence", "resolved", claim="Save and reload worked", criteria=["save-note"], method="command", outcome="pass",
                 observed="A second process loaded the same note", artifact="receipt.json", supersedes="failure")
        self.assertEqual(workflow.gate(self.root)["status"], "pass")

    def test_stale_or_missing_failure_artifact_cannot_turn_a_gate_green(self):
        self.criterion()
        (self.root / "failure.txt").write_text("Reopening loses the saved note")
        self.add("evidence", "failure", claim="State was lost", criteria=["save-note"], method="manual", outcome="fail",
                 observed="The second process loaded an empty list", artifact="failure.txt")
        self.observed_check()
        self.assertEqual(workflow.gate(self.root)["status"], "fail")
        (self.root / "failure.txt").write_text("Edited description")
        self.assertNotEqual(workflow.gate(self.root)["status"], "pass")
        (self.root / "failure.txt").unlink()
        self.assertNotEqual(workflow.gate(self.root)["status"], "pass")
        self.add("evidence", "resolved", claim="Save and reload worked", criteria=["save-note"], method="command", outcome="pass",
                 observed="A second process loaded the same note", artifact="receipt.json", supersedes="failure")
        self.assertEqual(workflow.gate(self.root)["status"], "pass")

    def test_failure_resolution_must_be_fresh_and_remain_fresh(self):
        self.criterion()
        (self.root / "failure.txt").write_text("Reopening loses the saved note")
        self.add("evidence", "failure", claim="State was lost", criteria=["save-note"], method="manual", outcome="fail",
                 observed="The second process loaded an empty list", artifact="failure.txt")
        self.observed_check()
        with self.assertRaisesRegex(workflow.foundry.Error, "fresh"):
            self.add("evidence", "expired-resolution", claim="An expired repair", criteria=["save-note"], method="command", outcome="pass",
                     observed="It once worked", artifact="receipt.json", supersedes="failure", expires_at="2000-01-01")
        # Separate receipt artifact permits the resolution to expire without
        # changing the older, unrelated successful observation.
        (self.root / "resolution.json").write_bytes((self.root / "receipt.json").read_bytes())
        self.add("evidence", "resolution", claim="Repaired", criteria=["save-note"], method="command", outcome="pass",
                 observed="Reopening preserves the note", artifact="resolution.json", supersedes="failure")
        self.assertEqual(workflow.gate(self.root)["status"], "pass")
        (self.root / "resolution.json").unlink()
        self.assertNotEqual(workflow.gate(self.root)["status"], "pass")

    def test_inferred_or_proposed_evidence_never_satisfies_criterion(self):
        self.criterion()
        self.observed_check(basis="inferred")
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")

    def test_unresolved_failure_cannot_be_replaced_by_a_label(self):
        self.criterion()
        (self.root / "failure.txt").write_text("No note after restart")
        self.add("evidence", "failed", claim="State was lost", criteria=["save-note"], method="manual", outcome="fail",
                 observed="No note after restart", artifact="failure.txt")
        with self.assertRaisesRegex(workflow.foundry.Error, "retain"):
            self.add("evidence", "escape", claim="Unrelated claim", supersedes="failed")
        with self.assertRaisesRegex(workflow.foundry.Error, "unresolved failure"):
            self.add("evidence", "downgrade", claim="Agent says WARN", outcome="unverified", criteria=["save-note"], supersedes="failed")
        self.assertEqual(workflow.gate(self.root)["status"], "fail")

    def test_matching_criterion_command_and_acceptance_provenance_required(self):
        with self.assertRaisesRegex(workflow.foundry.Error, "accepted_by"):
            self.add("decision", "not-approved", rationale="An agent recommendation")
        self.criterion()
        self.observed_check()
        receipt = json.loads((self.root / "receipt.json").read_text())
        receipt["command"] = [sys.executable, "different.py"]
        (self.root / "other-receipt.json").write_text(json.dumps(receipt))
        with self.assertRaisesRegex(workflow.foundry.Error, "Unknown reference"):
            self.add("evidence", "unknown", claim="Wrong project", criteria=["missing"], artifact="other-receipt.json")
        self.add("evidence", "wrong-command", claim="Another command passed", criteria=["save-note"], method="command",
                 outcome="pass", observed="Another test passed", artifact="other-receipt.json", supersedes="check-save")
        self.assertEqual(workflow.gate(self.root)["status"], "unverified")

    def test_web_feature_guidance_advances_through_actual_handoffs(self):
        self.criterion()
        first = workflow.guide(self.root, request="Add a web notes view", intent="implement", complexity="feature", surface="web")
        self.assertEqual(first["next"]["stage"], "flows")
        self.add("artifact", "flows", path="spec.md", stage="flows", owner="designer", next_action="Design note components", criteria=["save-note"])
        second = workflow.guide(self.root, request="Add a web notes view", intent="implement", complexity="feature", surface="web")
        self.assertEqual(second["next"]["stage"], "design")
        self.add("artifact", "design", path="spec.md", stage="design", owner="designer", next_action="Build view", criteria=["save-note"])
        self.assertEqual(workflow.guide(self.root, intent="implement", complexity="feature", surface="web")["next"]["stage"], "build")

    def test_old_receipt_cannot_be_rebound_after_source_change(self):
        self.criterion()
        self.observed_check()
        (self.root / "app.py").write_text("raise RuntimeError('new defect')\n")
        self.criterion("save-v2", supersedes="save-note")
        self.add("evidence", "relabel-old-log", claim="An old successful command", method="command", outcome="pass",
                 observed="The old log says saved", artifact="receipt.json", criteria=["save-v2"])
        result = workflow.gate(self.root)
        self.assertEqual(result["status"], "unverified")
        self.assertIn("input/contract", result["criteria"][0]["evidence"][0]["reason"])

    def test_runtime_receipt_satisfies_gate_without_ledger_self_invalidation(self):
        self.criterion()
        check = {"name": "save", "command": [sys.executable, "app.py"], "inputs": ["app.py", "spec.md"], "timeout": 2}
        receipt, interrupted = workflow.foundry.run_check(self.root, check, self.root / "runtime.log")
        self.assertFalse(interrupted)
        self.assertEqual(receipt["status"], "passed")
        (self.root / "runtime-receipt.json").write_text(json.dumps({"checks": [receipt]}))
        self.add("evidence", "runtime-result", claim="The runtime exercised the declared command", criteria=["save-note"],
                 method="command", outcome="pass", observed="The process exited successfully", artifact="runtime-receipt.json", check="save")
        self.assertEqual(workflow.gate(self.root)["status"], "pass")
        self.add("assumption", "unrelated-market-question", validation="Interview buyers")
        self.assertEqual(workflow.gate(self.root)["status"], "pass")

    def test_command_without_executed_input_binding_is_unverified(self):
        self.criterion()
        self.observed_check()
        data = json.loads((self.root / "receipt.json").read_text())
        del data["input_revisions"]
        del data["input_revisions_after"]
        (self.root / "unbound.json").write_text(json.dumps(data))
        self.add("evidence", "unbound", claim="An unbound command", criteria=["save-note"], method="command", outcome="pass",
                 observed="Output said saved", artifact="unbound.json", supersedes="check-save")
        result = workflow.gate(self.root)
        self.assertEqual(result["status"], "unverified")
        self.assertIn("configure check.inputs", result["criteria"][0]["evidence"][0]["reason"])

    def test_inputs_changed_during_execution_are_not_passing_evidence(self):
        self.criterion()
        self.observed_check()
        receipt = json.loads((self.root / "receipt.json").read_text())
        receipt["input_revisions_after"]["app.py"] = "0" * 64
        (self.root / "unstable.json").write_text(json.dumps(receipt))
        self.add("evidence", "unstable", claim="Command changed its input", criteria=["save-note"], method="command", outcome="pass",
                 observed="It printed success", artifact="unstable.json", supersedes="check-save")
        result = workflow.gate(self.root)
        self.assertEqual(result["status"], "unverified")
        self.assertIn("changed during", result["criteria"][0]["evidence"][0]["reason"])

    def test_command_gate_exit_status_and_read_only_behavior(self):
        before = self.tree()
        result = subprocess.run([sys.executable, str(Path(workflow.__file__)), "--project", str(self.root), "gate", "--stage", "verify"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "unverified")
        self.assertEqual(before, self.tree())

    def test_concurrent_record_attempt_preserves_existing_history(self):
        self.add("assumption", "existing", validation="Interview buyers")
        ledger_before = (self.root / workflow.LEDGER).read_bytes()
        code = "import fcntl,sys,time; f=open(sys.argv[1],'a+'); fcntl.flock(f,fcntl.LOCK_EX); print('locked',flush=True); time.sleep(10)"
        proc = subprocess.Popen([sys.executable, "-c", code, str(self.root / workflow.LOCK)], stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(proc.stdout.readline().strip(), "locked")
            with self.assertRaisesRegex(workflow.foundry.Error, "Another coordinator"):
                self.add("assumption", "concurrent", validation="Try after lock release")
            self.assertEqual((self.root / workflow.LEDGER).read_bytes(), ledger_before)
        finally:
            proc.terminate()
            proc.wait(timeout=3)
            proc.stdout.close()
        self.add("assumption", "later", validation="Try after lock release")
        self.assertEqual([r["id"] for r in workflow.context(self.root)["records"]], ["existing", "later"])

    def test_normalized_path_aliases_cannot_produce_invalid_ledger(self):
        with self.assertRaisesRegex(workflow.foundry.Error, "duplicate normalized"):
            self.add("assumption", "duplicate-paths", validation="Review", inputs=["spec.md", "./spec.md"])
        self.assertFalse((self.root / workflow.LEDGER).exists())

    def test_expiry_and_tampered_reference_revision_invalidate_context(self):
        self.add("assumption", "expired", validation="Refresh market quote", expires_at="2000-01-01")
        self.assertEqual(workflow.context(self.root)["records"][0]["freshness"], "stale")
        self.add("assumption", "input", validation="Observe it")
        self.add("assumption", "dependent", validation="Follow up", references=["input"])
        path = self.root / workflow.LEDGER
        data = json.loads(path.read_text())
        data["records"][1]["title"] = "Manually changed record"
        path.write_text(json.dumps(data))
        self.assertEqual(workflow.context(self.root)["records"][2]["freshness"], "stale")

    def test_feedback_requires_a_scoped_followup_and_preserves_source(self):
        self.criterion()
        (self.root / "repro.md").write_text("Save a note, restart, reload")
        feedback = self.item("feedback", "support-1", criteria=["save-note"], reproduction="repro.md",
                             next_task="Reproduce note loss and add a restart regression", operating_scope="local_only")
        workflow.record(self.root, feedback)
        saved = workflow.context(self.root)["records"][-1]
        self.assertEqual(saved["source"]["ref"], "Owner request in this task")
        self.assertEqual(saved["next_task"], feedback["next_task"])
        self.assertEqual(saved["operating_scope"], "local_only")
        self.assertFalse((self.root / ".foundry/state").exists())
        with self.assertRaisesRegex(workflow.foundry.Error, "operating_scope"):
            self.add("feedback", "bad", criteria=["save-note"], next_task="Send email", operating_scope="send_now")


if __name__ == "__main__":
    unittest.main()
