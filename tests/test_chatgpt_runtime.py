from __future__ import annotations

import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("marketcraft_providers", ROOT / "scripts/providers.py")
providers = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(providers)
from scripts import chatgpt_runtime as runtime


FAKE_CODEX = r'''#!/usr/bin/env python3
import json, os, sys

def read(): return json.loads(sys.stdin.readline())
def send(value): print(json.dumps(value), flush=True)

argv = sys.argv[1:]
assert argv[:2] == ["app-server", "--stdio"], argv
assert any('model_provider="foundry_chatgpt"' == argv[i + 1] for i, v in enumerate(argv[:-1]) if v == "-c")
assert any('env_key="ACCESS_TOKEN"' in argv[i + 1] for i, v in enumerate(argv[:-1]) if v == "-c")
secret = os.environ["ACCESS_TOKEN"]
assert "OPENAI_API_KEY" not in os.environ
message = read()
assert message["method"] == "initialize"
assert message["params"]["clientInfo"] == {"name":"foundry","title":"Foundry","version":"0.3.0"}
send({"id": message["id"], "result": {}})
assert read()["method"] == "initialized"
message = read()
assert message["method"] == "thread/start"
assert message["params"]["approvalPolicy"] == "never"
assert message["params"]["sandbox"] == "read-only"
send({"id": message["id"], "result": {"thread":{"id":"chatgpt-thread-1"}, "model":"gpt-test"}})
message = read()
assert message["method"] == "turn/start"
assert message["params"]["approvalPolicy"] == "never"
assert message["params"]["sandboxPolicy"]["type"] == "readOnly"
send({"id": message["id"], "result": {"turn":{"id":"turn-1"}}})
send({"method":"item/completed", "params":{"threadId":"chatgpt-thread-1","turnId":"turn-1",
      "completedAtMs":1,"item":{"id":"item-1","type":"agentMessage","text":"done " + secret}}})
send({"method":"turn/completed", "params":{"threadId":"chatgpt-thread-1",
      "turn":{"id":"turn-1","status":"completed","items":[]}}})
'''


class ChatGPTRuntimeTests(unittest.TestCase):
    def test_unexpected_approval_is_declined_and_fails_the_attempt(self):
        process = type("Process", (), {"stdin": io.StringIO()})()
        with self.assertRaisesRegex(runtime.RuntimeErrorSafe, "interactive approval"):
            runtime._approval_request(process, {
                "id": 19, "method": "item/commandExecution/requestApproval", "params": {},
            })
        response = json.loads(process.stdin.getvalue())
        self.assertEqual(response, {"id": 19, "result": {"decision": "decline"}})

    def test_provider_executes_app_server_and_redacts_private_token(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            (root / ".foundry").mkdir()
            (root / ".foundry/project.json").write_text("{}")
            bin_dir = root / "bin"
            bin_dir.mkdir()
            fake = bin_dir / "codex"
            fake.write_text(FAKE_CODEX)
            fake.chmod(fake.stat().st_mode | stat.S_IXUSR)
            request = {
                "adapter": "chatgpt", "kind": "agent-runtime", "prompt": "inspect",
                "permissions": {"sandbox": "read-only"},
                "billing": {"mode": "subscription", "confirmed": True},
                "budget": {"max_attempts": 1, "max_concurrency": 1,
                           "max_elapsed_seconds": 10, "max_api_dollars": 0},
            }
            secret = "private-chatgpt-oauth-token"
            previous_path = os.environ.get("PATH", "")
            previous_api = os.environ.get("OPENAI_API_KEY")
            previous_codex = os.environ.get("FOUNDRY_CODEX")
            os.environ["PATH"] = str(bin_dir) + os.pathsep + previous_path
            os.environ["FOUNDRY_CODEX"] = str(fake)
            os.environ["OPENAI_API_KEY"] = "must-not-reach-child"
            try:
                result = providers.execute(root, request, credential_env={"ACCESS_TOKEN": secret})
            finally:
                os.environ["PATH"] = previous_path
                if previous_codex is None:
                    os.environ.pop("FOUNDRY_CODEX", None)
                else:
                    os.environ["FOUNDRY_CODEX"] = previous_codex
                if previous_api is None:
                    os.environ.pop("OPENAI_API_KEY", None)
                else:
                    os.environ["OPENAI_API_KEY"] = previous_api
            self.assertEqual(result["status"], "completed")
            self.assertEqual(result["session_id"], "chatgpt-thread-1")
            self.assertEqual(result["resolved_model"], "gpt-test")
            self.assertEqual(result["attempts"][0]["output"], "done [redacted]")
            stored = "\n".join(path.read_text() for path in
                               (root / ".foundry/state/providers").rglob("*") if path.is_file())
            self.assertNotIn(secret, stored)
            self.assertNotIn("must-not-reach-child", stored)


if __name__ == "__main__":
    unittest.main()
