#!/usr/bin/env python3
"""Adapt Foundry provider JSONL to Codex app-server using a ChatGPT OAuth token."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any

try:
    from .providers import codex_executable
except ImportError:
    from providers import codex_executable


PROTOCOL = "marketcraft-jsonl-v1"
PROVIDER = (
    'model_providers.foundry_chatgpt={ name="ChatGPT plan", '
    'base_url="https://api.openai.com/v1", env_key="ACCESS_TOKEN", '
    'requires_openai_auth=false, wire_api="responses", supports_websockets=false }'
)


class RuntimeErrorSafe(RuntimeError):
    pass


def _emit(value: dict[str, Any]) -> None:
    print(json.dumps(value, separators=(",", ":")), flush=True)


def _send(process: subprocess.Popen[str], value: dict[str, Any]) -> None:
    assert process.stdin is not None
    process.stdin.write(json.dumps(value, separators=(",", ":")) + "\n")
    process.stdin.flush()


def _read(process: subprocess.Popen[str]) -> dict[str, Any]:
    assert process.stdout is not None
    line = process.stdout.readline()
    if not line:
        raise RuntimeErrorSafe("Codex app-server stopped before completing the request")
    try:
        value = json.loads(line)
    except ValueError as exc:
        raise RuntimeErrorSafe("Codex app-server returned invalid JSON") from exc
    if not isinstance(value, dict):
        raise RuntimeErrorSafe("Codex app-server returned an invalid message")
    return value


def _approval_request(process: subprocess.Popen[str], message: dict[str, Any]) -> None:
    method = message.get("method")
    request_id = message.get("id")
    if request_id is None:
        return
    if method in {
        "item/commandExecution/requestApproval", "item/fileChange/requestApproval",
        "applyPatchApproval", "execCommandApproval",
    }:
        _send(process, {"id": request_id, "result": {"decision": "decline"}})
    else:
        _send(process, {"id": request_id, "error": {
            "code": -32000, "message": "Foundry provider tasks cannot grant interactive approval",
        }})
    raise RuntimeErrorSafe(f"Codex requested unsupported interactive approval ({method})")


def _response(process: subprocess.Popen[str], request_id: int) -> dict[str, Any]:
    while True:
        message = _read(process)
        if "method" in message and "id" in message:
            _approval_request(process, message)
        if message.get("id") == request_id:
            if "error" in message:
                error = message.get("error") or {}
                detail = error.get("message") if isinstance(error, dict) else None
                raise RuntimeErrorSafe(detail or "Codex app-server rejected the request")
            result = message.get("result")
            if not isinstance(result, dict):
                raise RuntimeErrorSafe("Codex app-server returned an invalid response")
            return result


def _request(process: subprocess.Popen[str], request_id: int, method: str,
             params: dict[str, Any]) -> dict[str, Any]:
    _send(process, {"id": request_id, "method": method, "params": params})
    return _response(process, request_id)


def _sandbox(value: str) -> tuple[str, dict[str, Any]]:
    if value == "read-only":
        return "read-only", {"type": "readOnly", "networkAccess": False}
    if value == "workspace-write":
        return "workspace-write", {"type": "workspaceWrite", "networkAccess": False}
    raise RuntimeErrorSafe("ChatGPT adapter requires read-only or workspace-write permissions")


def _run(request: dict[str, Any]) -> None:
    if request.get("protocol") != PROTOCOL or request.get("operation") not in {"start", "resume"}:
        raise RuntimeErrorSafe("Invalid Foundry provider request")
    prompt = request.get("prompt")
    if not isinstance(prompt, str) or not prompt:
        raise RuntimeErrorSafe("Foundry provider prompt is required")
    token = os.environ.get("ACCESS_TOKEN")
    if not token:
        raise RuntimeErrorSafe("ChatGPT access token is unavailable")
    permissions = request.get("permissions") or {"sandbox": "read-only"}
    if not isinstance(permissions, dict):
        raise RuntimeErrorSafe("Invalid Foundry permissions")
    sandbox, sandbox_policy = _sandbox(permissions.get("sandbox"))
    environment = dict(os.environ)
    environment.pop("OPENAI_API_KEY", None)
    environment.pop("CODEX_API_KEY", None)
    command = [
        codex_executable(), "app-server", "--stdio",
        "-c", 'model_provider="foundry_chatgpt"',
        "-c", PROVIDER,
        "-c", 'features.multi_agent=false',
        "-c", 'shell_environment_policy.ignore_default_excludes=false',
        "-c", 'shell_environment_policy.exclude=["ACCESS_TOKEN","OPENAI_API_KEY","CODEX_API_KEY"]',
    ]
    process = subprocess.Popen(
        command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=sys.stderr,
        text=True, bufsize=1, env=environment,
    )
    try:
        _request(process, 1, "initialize", {
            "clientInfo": {"name": "foundry", "title": "Foundry", "version": "0.3.0"},
            "capabilities": {"experimentalApi": False},
        })
        _send(process, {"method": "initialized", "params": {}})
        thread_params: dict[str, Any] = {
            "cwd": os.getcwd(), "approvalPolicy": "never", "sandbox": sandbox,
        }
        if request.get("model") is not None:
            thread_params["model"] = request["model"]
        if request["operation"] == "resume":
            session_id = request.get("session_id")
            if not isinstance(session_id, str) or not session_id:
                raise RuntimeErrorSafe("Resume requires a Codex thread ID")
            thread_params["threadId"] = session_id
            thread_result = _request(process, 2, "thread/resume", thread_params)
        else:
            thread_result = _request(process, 2, "thread/start", thread_params)
        thread = thread_result.get("thread")
        thread_id = thread.get("id") if isinstance(thread, dict) else None
        if not isinstance(thread_id, str) or not thread_id:
            raise RuntimeErrorSafe("Codex app-server returned no thread ID")
        started = {"type": "session.started", "session_id": thread_id}
        resolved_model = thread_result.get("model")
        if isinstance(resolved_model, str):
            started["model"] = resolved_model
        _emit(started)

        turn_params: dict[str, Any] = {
            "threadId": thread_id,
            "input": [{"type": "text", "text": prompt}],
            "approvalPolicy": "never",
            "sandboxPolicy": sandbox_policy,
        }
        if request.get("model") is not None:
            turn_params["model"] = request["model"]
        if request.get("reasoning") is not None:
            turn_params["effort"] = request["reasoning"]
        _request(process, 3, "turn/start", turn_params)

        output: str | None = None
        while True:
            message = _read(process)
            if "method" in message and "id" in message:
                _approval_request(process, message)
            method = message.get("method")
            params = message.get("params")
            if not isinstance(params, dict):
                continue
            if method == "item/completed":
                item = params.get("item")
                if isinstance(item, dict) and item.get("type") == "agentMessage" and isinstance(item.get("text"), str):
                    output = item["text"]
            if method == "turn/completed":
                turn = params.get("turn")
                if not isinstance(turn, dict):
                    raise RuntimeErrorSafe("Codex returned an invalid completion")
                if turn.get("status") != "completed":
                    error = turn.get("error")
                    detail = error.get("message") if isinstance(error, dict) else None
                    raise RuntimeErrorSafe(detail or f"Codex turn ended with status {turn.get('status')}")
                if output is None:
                    for item in reversed(turn.get("items", [])):
                        if isinstance(item, dict) and item.get("type") == "agentMessage" and isinstance(item.get("text"), str):
                            output = item["text"]
                            break
                if output is None:
                    raise RuntimeErrorSafe("Codex completed without an agent result")
                _emit({"type": "result", "status": "completed", "output": output})
                return
    finally:
        if process.poll() is None:
            process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)
        for stream in (process.stdin, process.stdout):
            if stream and not stream.closed:
                stream.close()


def main() -> int:
    try:
        value = json.load(sys.stdin)
        if not isinstance(value, dict):
            raise RuntimeErrorSafe("Expected one Foundry provider request")
        _run(value)
        return 0
    except (RuntimeErrorSafe, ValueError, OSError) as exc:
        _emit({"type": "error", "code": "chatgpt_runtime", "message": str(exc)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
