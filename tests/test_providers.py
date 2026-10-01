"""Provider contracts exercised with real local processes, never live inference."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("marketcraft_providers", ROOT / "scripts/providers.py")
providers = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(providers)


FAKE = '''import json, os, signal, subprocess, sys, time
r = json.load(sys.stdin)
def emit(x):
    print(json.dumps(x), flush=True)
emit({"type":"session.started", "session_id":r.get("session_id") or "test-session", "model":"fixture-v1"})
prompt = r["prompt"]
if prompt == "hang":
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"])
    open("child.pid", "w").write(str(child.pid))
    time.sleep(120)
if prompt == "rate-limit":
    emit({"type":"error", "code":"rate_limit", "message":"Retry later"})
    sys.exit(29)
if prompt == "ambiguous":
    open("effect.txt", "w").write("committed")
    sys.exit(0)
if prompt == "invalid-output":
    emit({"type":"result", "status":"completed", "output":{"wrong":True}})
    sys.exit(0)
if prompt == "secret":
    emit({"type":"progress", "token":"do-not-retain", "message":os.environ.get("TEST_API_KEY", "")})
usage = {"input_tokens":11, "output_tokens":7, "reliable":True}
if prompt == "paid": usage["api_dollars"] = 0.3
if prompt == "overspend": usage["api_dollars"] = 2.0
emit({"type":"result", "status":"completed", "output":{"ok":True, "resumed":r["operation"] == "resume"}, "usage":usage})
'''


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        (self.root / ".foundry").mkdir()
        (self.root / ".foundry/project.json").write_text('{}')
        self.fake = self.root / "fake.py"
        self.fake.write_text(FAKE)
        self.config = {"adapters":[{
            "name":"fixture", "kind":"agent-runtime", "command":[sys.executable, str(self.fake)],
            "capabilities":["jsonl", "structured_output", "resume", "cancel", "permissions", "model_selection", "reasoning_selection"],
            "billing_modes":["local", "api"]
        }]}
        self.save_config()

    def tearDown(self):
        self.tmp.cleanup()

    def save_config(self):
        (self.root / ".foundry/providers.json").write_text(json.dumps(self.config))

    def request(self, **changes):
        value = {"adapter":"fixture", "kind":"agent-runtime", "prompt":"work", "billing":{"mode":"local"},
                 "budget":{"max_attempts":2,"max_concurrency":1,"max_elapsed_seconds":5,"max_api_dollars":0}}
        value.update(changes)
        return value

    def test_local_process_returns_structured_result_and_unknown_money(self):
        result = providers.execute(self.root, self.request())
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["session_id"], "test-session")
        self.assertIsNone(result["requested_model"])
        self.assertEqual(result["resolved_model"], "fixture-v1")
        self.assertEqual(result["attempts"][0]["output"], {"ok":True,"resumed":False})
        self.assertEqual(result["usage"]["input_tokens"], 11)
        self.assertIsNone(result["usage"]["api_dollars"])
        self.assertIsNone(result["usage"]["subscription_allowance_remaining"])

    def test_missing_capability_rejected_before_process_launch(self):
        with self.assertRaisesRegex(providers.Error, "browser"):
            providers.execute(self.root, self.request(required_capabilities=["browser"]))
        self.assertFalse((self.root / ".foundry/state/providers/tasks").exists())

    def test_missing_permissions_and_cancellation_rejected(self):
        for capability in ["permissions", "cancel"]:
            with self.subTest(capability=capability):
                self.config["adapters"][0]["capabilities"].remove(capability)
                self.save_config()
                with self.assertRaisesRegex(providers.Error, capability):
                    providers.execute(self.root, self.request(permissions={"sandbox":"read-only"}))
                self.config["adapters"][0]["capabilities"].append(capability)

    def test_resume_preserves_identity_session_and_attempt_budget(self):
        first = providers.execute(self.root, self.request(model="chosen-model", reasoning="high"))
        second = providers.execute(self.root, self.request(prompt="continue", model="chosen-model", reasoning="high"), first["task_id"])
        self.assertEqual(first["task_id"], second["task_id"])
        self.assertEqual(second["attempts"][1]["output"], {"ok":True,"resumed":True})
        self.assertEqual(second["requested_model"], "chosen-model")
        self.assertEqual(second["settings"]["reasoning"], "high")
        self.assertEqual(second["usage"]["input_tokens"], 22)
        with self.assertRaisesRegex(providers.Error, "Attempt budget"):
            providers.execute(self.root, self.request(model="chosen-model", reasoning="high"), first["task_id"])
        with self.assertRaisesRegex(providers.Error, "preserve"):
            providers.execute(self.root, self.request(), first["task_id"])

    def test_paid_route_requires_authority_and_cost_risk_acknowledgment(self):
        for billing in [{"mode":"api"}, {"mode":"api","allow_api":True}]:
            with self.subTest(billing=billing), self.assertRaisesRegex(providers.Error, "explicit"):
                providers.execute(self.root, self.request(billing=billing))
        self.assertFalse((self.root / ".foundry/state/providers/tasks").exists())

    def paid(self, prompt="paid", **budget):
        return self.request(prompt=prompt,
                            billing={"mode":"api","allow_api":True,"acknowledge_posthoc_cost":True,"reservation_dollars":0.6},
                            budget={"max_attempts":3,"max_concurrency":1,"max_elapsed_seconds":5,"max_api_dollars":1,**budget})

    def test_api_reservations_spend_and_unknown_costs_survive_resume(self):
        first = providers.execute(self.root, self.paid())
        second = providers.execute(self.root, self.paid(), first["task_id"])
        self.assertEqual(second["usage"]["api_dollars"], 0.6)
        with self.assertRaisesRegex(providers.Error, "reservation"):
            providers.execute(self.root, self.paid(), first["task_id"])
        unknown = providers.execute(self.root, self.paid("work"))
        self.assertIsNone(unknown["usage"]["api_dollars"])
        with self.assertRaisesRegex(providers.Error, "unknown"):
            providers.execute(self.root, self.paid("work"), unknown["task_id"])

    def test_posthoc_overspend_is_visible_not_claimed_as_a_hard_cap(self):
        result = providers.execute(self.root, self.paid("overspend"))
        self.assertEqual(result["status"], "budget_exceeded")
        self.assertEqual(result["usage"]["api_dollars"], 2.0)
        self.assertIn("no hard dollar cap", result["billing_assurance"])
        with self.assertRaisesRegex(providers.Error, "reservation"):
            providers.execute(self.root, self.paid("overspend"), result["task_id"])

    def test_reported_paid_usage_on_local_route_blocks_another_attempt(self):
        result = providers.execute(self.root, self.request(prompt="paid"))
        self.assertEqual(result["status"], "billing_violation")
        with self.assertRaisesRegex(providers.Error, "contradict"):
            providers.execute(self.root, self.request(prompt="paid"), result["task_id"])

    def test_rate_limit_never_routes_to_another_adapter(self):
        result = providers.execute(self.root, self.request(prompt="rate-limit"))
        self.assertEqual(result["status"], "failed")
        self.assertEqual(len(result["attempts"]), 1)
        self.assertEqual(result["attempts"][0]["error"]["code"], "rate_limit")
        self.assertEqual(len(list((self.root / ".foundry/state/providers/tasks").glob("*.json"))), 1)

    def test_unacknowledged_effect_is_unknown_and_blocks_retry(self):
        request = self.request(prompt="ambiguous")
        result = providers.execute(self.root, request)
        self.assertEqual((self.root / "effect.txt").read_text(), "committed")
        self.assertEqual(result["status"], "unknown")
        with self.assertRaisesRegex(providers.Error, "reconciliation"):
            providers.execute(self.root, request, result["task_id"])
        checked = providers.reconcile(self.root, result["task_id"])
        self.assertEqual(checked["status"], "unknown")
        stopped = providers.reconcile(self.root, result["task_id"], True)
        self.assertEqual(stopped["status"], "interrupted")
        result = providers.execute(self.root, self.request(), result["task_id"])
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["attempts"]), 2)

    def test_structured_output_schema_checked_and_unsupported_schema_rejected(self):
        schema = {"type":"object","properties":{"ok":{"type":"boolean"},"resumed":{"type":"boolean"}},
                  "required":["ok"],"additionalProperties":False}
        valid = providers.execute(self.root, self.request(output_schema=schema))
        self.assertEqual(valid["status"], "completed")
        invalid = providers.execute(self.root, self.request(prompt="invalid-output", output_schema=schema))
        self.assertEqual(invalid["status"], "failed")
        self.assertEqual(invalid["attempts"][0]["error"]["code"], "invalid_output")
        with self.assertRaisesRegex(providers.Error, "Unsupported"):
            providers.execute(self.root, self.request(output_schema={"oneOf":[]}))

    def test_schema_enum_uses_json_equality_for_booleans_numbers_and_containers(self):
        cases = [
            (1, {"type":"integer","enum":[True]}, "failed"),
            (True, {"type":"boolean","enum":[1]}, "failed"),
            ({"ok":1}, {"type":"object","enum":[{"ok":True}]}, "failed"),
            ([False], {"type":"array","enum":[[0]]}, "failed"),
            (1, {"type":"integer","enum":[1.0]}, "completed"),
            ({"count":[1,2.0],"ok":True}, {"type":"object","enum":[{"ok":True,"count":[1.0,2]}]}, "completed"),
            ([1,2], {"type":"array","enum":[[2,1]]}, "failed"),
        ]
        for output, schema, expected in cases:
            with self.subTest(output=output, schema=schema):
                event = json.dumps({"type":"result","status":"completed","output":output})
                self.fake.write_text("print(" + repr(event) + ")\n")
                result = providers.execute(self.root, self.request(output_schema=schema))
                self.assertEqual(result["status"], expected)

    def test_sanitized_receipts_do_not_persist_prompt_or_credentials(self):
        with mock.patch.dict(os.environ, {"TEST_API_KEY":"private-test-environment-value"}):
            result = providers.execute(self.root, self.request(prompt="secret"))
        files = list((self.root / ".foundry/state/providers").rglob("*"))
        text = "\n".join(path.read_text() for path in files if path.is_file())
        self.assertNotIn("private-test-environment-value", text)
        self.assertNotIn("do-not-retain", text)
        self.assertIn("[redacted]", text)
        self.assertNotIn('"prompt":', text)
        self.assertEqual(providers.load_task(self.root, result["task_id"])["status"], "completed")

    def launch_hanging(self, request=None, task_id=None):
        request = request or self.request(prompt="hang", budget={"max_attempts":2,"max_concurrency":1,"max_elapsed_seconds":10,"max_api_dollars":0})
        (self.root / "request.json").write_text(json.dumps(request))
        action = ["resume", task_id] if task_id else ["run"]
        process = subprocess.Popen([sys.executable,str(ROOT / "scripts/providers.py"),"--project",str(self.root),
                                    "provider",*action,"request.json"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        deadline = time.monotonic() + 4
        while time.monotonic() < deadline:
            if (self.root / "child.pid").exists() and (self.root / "child.pid").read_text().strip():
                break
            if process.poll() is not None:
                self.fail(process.communicate())
            time.sleep(0.01)
        self.assertTrue((self.root / "child.pid").exists())
        child = int((self.root / "child.pid").read_text())
        task_id = next((self.root / ".foundry/state/providers/tasks").glob("*.json")).stem
        return process, child, task_id

    def assert_stopped(self, pid):
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                return
            time.sleep(0.02)
        self.fail(f"Owned child {pid} is still running")

    def cleanup_process(self, process, child):
        if process.poll() is None:
            process.terminate()
        process.communicate(timeout=5)
        try:
            os.kill(child, signal.SIGKILL)
        except ProcessLookupError:
            pass

    def test_sigterm_cancels_owned_grandchild_and_records_interruption(self):
        process, child, task_id = self.launch_hanging()
        try:
            process.terminate()
            stdout, stderr = process.communicate(timeout=5)
            self.assertEqual(process.returncode, 130, stderr)
            self.assertEqual(json.loads(stdout)["status"], "canceled")
            self.assertEqual(providers.load_task(self.root, task_id)["status"], "canceled")
            self.assert_stopped(child)
        finally:
            self.cleanup_process(process, child)

    def test_explicit_cancel_concurrency_and_lease_are_real(self):
        process, child, task_id = self.launch_hanging()
        try:
            with self.assertRaisesRegex(providers.Error, "concurrency"):
                providers.execute(self.root, self.request())
            with self.assertRaisesRegex(providers.Error, "already running"):
                providers.reconcile(self.root, task_id, True)
            response = providers.cancel(self.root, task_id)
            self.assertEqual(response["status"], "cancellation_requested")
            stdout, stderr = process.communicate(timeout=5)
            self.assertEqual(process.returncode, 130, stderr)
            self.assertEqual(json.loads(stdout)["status"], "canceled")
            self.assert_stopped(child)
        finally:
            self.cleanup_process(process, child)

    def test_timeout_consumes_total_elapsed_budget(self):
        request = self.request(prompt="hang", budget={"max_attempts":3,"max_concurrency":1,"max_elapsed_seconds":0.4,"max_api_dollars":0})
        result = providers.execute(self.root, request)
        self.assertEqual(result["status"], "timed_out")
        self.assert_stopped(int((self.root / "child.pid").read_text()))
        with self.assertRaisesRegex(providers.Error, "Elapsed budget"):
            providers.execute(self.root, request, result["task_id"])

    def test_codex_argv_preserves_preferences_and_uses_supported_resume_flags(self):
        request = {"prompt":"inspect", "billing":{"mode":"subscription","confirmed":True}}
        adapter, settings = providers.prepare(self.root, request)
        command = providers.build_command(adapter, settings)
        self.assertEqual(command, ["codex","exec","--json","--color","never","--sandbox","read-only","-"])
        _, settings = providers.prepare(self.root, {**request,"model":"chosen-model","reasoning":"high"})
        command = providers.build_command(adapter, settings, "shape.json", "test-session")
        self.assertEqual(command[:3], ["codex","exec","resume"])
        self.assertNotIn("--sandbox", command)
        self.assertIn('sandbox_mode="read-only"', command)
        self.assertIn('model_reasoning_effort="high"', command)
        self.assertEqual(command[command.index("--model") + 1], "chosen-model")
        self.assertEqual(command[-2:], ["test-session","-"])
        self.assertIn("--output-schema", command)

    def test_codex_billing_cannot_be_assumed_from_unknown_local_auth(self):
        with self.assertRaisesRegex(providers.Error, "billing mode"):
            providers.prepare(self.root, {"prompt":"work"})
        with self.assertRaisesRegex(providers.Error, "Confirm subscription"):
            providers.prepare(self.root, {"prompt":"work", "billing":{"mode":"subscription"}})

    def test_codex_event_protocol_through_fake_executable_and_resume(self):
        self.fake.write_text('''import json, sys
prompt = sys.stdin.read()
with open("codex-argv.jsonl", "a") as f: f.write(json.dumps(sys.argv[1:]) + "\\n")
print(json.dumps({"type":"thread.started", "thread_id":"codex-session"}))
print(json.dumps({"type":"item.completed", "item":{"type":"agent_message", "text":'{"ok":true}'}}))
print(json.dumps({"type":"turn.completed", "usage":{"input_tokens":19, "output_tokens":5}}))
''')
        request = {"prompt":"inspect", "billing":{"mode":"subscription","confirmed":True},
                   "budget":{"max_attempts":2}, "output_schema":{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"]}}
        with mock.patch.dict(providers.CODEX, {"command":[sys.executable,str(self.fake)]}):
            first = providers.execute(self.root, request)
            result = providers.execute(self.root, request, first["task_id"])
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["session_id"], "codex-session")
        self.assertIsNone(result["resolved_model"])
        self.assertEqual(result["attempts"][1]["output"], {"ok":True})
        self.assertEqual(result["usage"]["input_tokens"], 38)
        self.assertIsNone(result["usage"]["api_dollars"])
        argv = [json.loads(line) for line in (self.root / "codex-argv.jsonl").read_text().splitlines()]
        self.assertEqual(argv[0][:2], ["exec","--json"])
        self.assertEqual(argv[1][:3], ["exec","resume","--json"])
        self.assertEqual(argv[1][-2:], ["codex-session","-"])
        self.assertFalse(any("model" in value or "reasoning" in value for command in argv for value in command))
        self.assertFalse(list((self.root / ".foundry/state/providers").rglob("schema.json")))

    def test_dead_runner_requires_reconciliation_without_resetting_budget(self):
        process, child, task_id = self.launch_hanging()
        task = providers.load_task(self.root, task_id)
        group = task["attempts"][0]["pid"]
        try:
            process.kill()
            process.communicate(timeout=4)
            task = providers.reconcile(self.root, task_id)
            self.assertEqual(task["status"], "unknown")
            self.assertEqual(len(task["attempts"]), 1)
            # Test owns this process. Production never kills a persisted PID after losing its lease.
            os.killpg(group, signal.SIGTERM)
            self.assert_stopped(child)
            checked = providers.reconcile(self.root, task_id, True)
            self.assertEqual(checked["status"], "interrupted")
            self.assertGreater(checked["elapsed_seconds"], 0)
            request = self.request(budget={"max_attempts":2,"max_concurrency":1,"max_elapsed_seconds":10,"max_api_dollars":0})
            result = providers.execute(self.root, request, task_id)
            self.assertEqual(result["status"], "completed")
            self.assertEqual(len(result["attempts"]), 2)
        finally:
            try:
                os.killpg(group, signal.SIGKILL)
            except ProcessLookupError:
                pass
            self.cleanup_process(process, child)

    def test_unknown_recovery_time_keeps_accruing_and_preserves_prior_attempts(self):
        request = self.request(budget={"max_attempts":3,"max_concurrency":1,"max_elapsed_seconds":0.6,"max_api_dollars":0})
        first = providers.execute(self.root, request)
        prior_elapsed = first["attempts"][0]["elapsed_seconds"]
        process, child, task_id = self.launch_hanging({**request,"prompt":"hang"}, first["task_id"])
        group = providers.load_task(self.root, task_id)["attempts"][-1]["pid"]
        try:
            process.kill()
            process.communicate(timeout=4)
            early = providers.reconcile(self.root, task_id)
            time.sleep(0.12)
            later = providers.reconcile(self.root, task_id)
            self.assertGreaterEqual(later["elapsed_seconds"], early["elapsed_seconds"] + 0.1)
            self.assertEqual(later["attempts"][0]["elapsed_seconds"], prior_elapsed)
            self.assertAlmostEqual(later["elapsed_seconds"], prior_elapsed + later["attempts"][1]["elapsed_seconds"])
            time.sleep(0.6)
            os.killpg(group, signal.SIGTERM)
            self.assert_stopped(child)
            stopped = providers.reconcile(self.root, task_id, True)
            self.assertAlmostEqual(stopped["elapsed_seconds"], 0.6)
            self.assertEqual(stopped["attempts"][0]["elapsed_seconds"], prior_elapsed)
            self.assertAlmostEqual(stopped["attempts"][1]["elapsed_seconds"], 0.6 - prior_elapsed)
            with self.assertRaisesRegex(providers.Error, "Elapsed budget"):
                providers.execute(self.root, request, task_id)
            self.assertEqual(providers.reconcile(self.root, task_id)["elapsed_seconds"], stopped["elapsed_seconds"])
        finally:
            try:
                os.killpg(group, signal.SIGKILL)
            except ProcessLookupError:
                pass
            self.cleanup_process(process, child)

    def test_untrusted_session_cannot_become_a_cli_option(self):
        self.fake.write_text('import json\nprint(json.dumps({"type":"session.started","session_id":"--dangerously-bypass-approvals-and-sandbox"}))\n')
        result = providers.execute(self.root, self.request())
        self.assertEqual(result["status"], "unknown")
        self.assertIsNone(result["session_id"])
        self.assertEqual(result["attempts"][0]["error"]["code"], "invalid_receipt")

    def test_unavailable_executable_is_recorded_without_charging_inference(self):
        self.config["adapters"][0]["command"] = ["/nonexistent-marketcraft-executable"]
        self.save_config()
        result = providers.execute(self.root, self.paid())
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["usage"]["api_dollars"], 0)
        self.assertEqual(result["attempts"][0]["error"]["code"], "unavailable")

    def test_bounded_model_rejects_agent_capabilities_and_runs_real_protocol(self):
        adapter = self.config["adapters"][0]
        adapter["kind"] = "bounded-model"
        with self.assertRaisesRegex(providers.Error, "cannot advertise"):
            self.save_config()
            providers.registry(self.root)
        adapter["capabilities"] = ["jsonl","cancel","structured_output"]
        self.save_config()
        self.fake.write_text('import sys,json\nr=json.load(sys.stdin)\nprint(json.dumps({"type":"result","status":"completed","output":{"answer":42}}))\n')
        result = providers.execute(self.root, self.request(kind="bounded-model"))
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["attempts"][0]["output"], {"answer":42})
        self.assertIsNone(result["session_id"])

    def test_symlinked_state_is_rejected_and_invalid_budgets_do_not_launch(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.root / ".foundry/state").symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(providers.Error, "symlink"):
            providers.execute(self.root, self.request())
        self.assertEqual(list(outside.iterdir()), [])
        (self.root / ".foundry/state").unlink()
        for value in [float("nan"), -1, True]:
            with self.subTest(value=value), self.assertRaises(providers.Error):
                providers.execute(self.root, self.request(budget={"max_elapsed_seconds":value}))


if __name__ == "__main__":
    unittest.main()
