#!/usr/bin/env python3
"""Explicit local agent/model execution. No SDK, authentication setup, or fallback."""
import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import selectors
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid

try:
    from . import foundry
except ImportError:
    import foundry


ACTIONS = {"provider"}
CAPABILITIES = {"jsonl", "structured_output", "resume", "cancel", "permissions",
                "tools", "browser", "model_selection", "reasoning_selection"}
BILLING_MODES = {"subscription", "api", "local"}
KINDS = {"agent-runtime", "bounded-model"}
STATE = ".foundry/state/providers"
MAX_INPUT = 256 * 1024
MAX_OUTPUT = 2 * 1024 * 1024
DEFAULT_BUDGET = {"max_attempts": 1, "max_concurrency": 1,
                  "max_elapsed_seconds": 300, "max_api_dollars": 0}
CODEX = {"name": "codex", "kind": "agent-runtime", "command": ["codex"],
         "protocol": "codex-jsonl", "billing_modes": ["subscription", "api"],
         "capabilities": sorted(CAPABILITIES - {"browser"})}


def codex_executable():
    """Use the desktop app's matching runtime when available; an owner override wins."""
    explicit = os.environ.get("FOUNDRY_CODEX")
    if explicit:
        return explicit
    bundled = Path("/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex")
    if sys.platform == "darwin" and bundled.is_file() and os.access(bundled, os.X_OK):
        return str(bundled)
    return "codex"


class Error(ValueError):
    pass


def _now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def _path(root, relative):
    root = Path(root).resolve()
    relative = Path(relative)
    if relative.is_absolute() or ".." in relative.parts:
        raise Error("Provider paths must stay within the project")
    current = root
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise Error("Provider configuration and state must not use symlinks")
    return current


def _read(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        raise Error(f"Cannot read provider JSON: {path.name}") from exc


def _write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(prefix=".write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(value, handle, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@contextlib.contextmanager
def _lock(root, relative, blocking=True):
    path = _path(root, relative)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB))
        except BlockingIOError as exc:
            raise Error("This provider task is already running") from exc
        yield
    finally:
        os.close(fd)


def _task_path(root, task_id):
    try:
        if str(uuid.UUID(task_id)) != task_id:
            raise ValueError()
    except (ValueError, TypeError, AttributeError) as exc:
        raise Error("Invalid provider task ID") from exc
    return _path(root, f"{STATE}/tasks/{task_id}.json")


def load_task(root, task_id):
    value = _read(_task_path(root, task_id))
    if not isinstance(value, dict) or value.get("task_id") != task_id:
        raise Error("Provider task identity mismatch")
    return value


def _tasks(root):
    directory = _path(root, f"{STATE}/tasks")
    return [load_task(root, path.stem) for path in sorted(directory.glob("*.json"))]


def registry(root):
    """Metadata is a capability claim by trusted installed code, not a sandbox."""
    result = {"codex": {**CODEX, "command": [codex_executable()]}, "chatgpt": {
        **CODEX, "name": "chatgpt", "protocol": "marketcraft-jsonl-v1",
        "command": [sys.executable, str(Path(__file__).with_name("chatgpt_runtime.py"))],
        "billing_modes": ["subscription"],
        # The plan preview does not support native multi_agent. Local tools still work.
        "capabilities": sorted(CAPABILITIES - {"browser", "structured_output"})}}
    path = _path(root, ".foundry/providers.json")
    if not path.exists():
        return result
    document = _read(path)
    if not isinstance(document, dict) or set(document) != {"adapters"} or not isinstance(document["adapters"], list):
        raise Error("providers.json needs an adapters list")
    for adapter in document["adapters"]:
        allowed = {"name", "kind", "command", "capabilities", "billing_modes"}
        if not isinstance(adapter, dict) or set(adapter) != allowed:
            raise Error("Each local adapter needs name, kind, command, capabilities and billing_modes")
        name = adapter["name"]
        if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,63}", name) or name in result:
            raise Error("Adapter names must be unique; codex and chatgpt are reserved")
        command = adapter["command"]
        if not isinstance(command, list) or not command or not all(isinstance(x, str) and x and "\0" not in x for x in command):
            raise Error("Adapter command must be an argv list, never a shell string")
        if adapter["kind"] not in KINDS:
            raise Error("Adapter kind must be agent-runtime or bounded-model")
        for field, choices in [("capabilities", CAPABILITIES), ("billing_modes", BILLING_MODES)]:
            items = adapter[field]
            if not isinstance(items, list) or not items or not all(isinstance(x, str) and x in choices for x in items):
                raise Error(f"Invalid adapter {field}")
        if adapter["kind"] == "bounded-model" and set(adapter["capabilities"]) & {"tools", "browser", "permissions", "resume"}:
            raise Error("A bounded-model adapter cannot advertise agent session/tools/permissions")
        result[name] = {**adapter, "protocol": "marketcraft-jsonl-v1"}
    return result


def _number(value, name, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or (positive and value == 0):
        raise Error(f"{name} must be a finite {'positive' if positive else 'nonnegative'} number")
    return value


def _json_equal(left, right):
    """JSON enum equality: booleans differ from numbers, recursively."""
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(_json_equal(value, right[key]) for key, value in left.items())
    if isinstance(left, list):
        return len(left) == len(right) and all(_json_equal(a, b) for a, b in zip(left, right))
    return left == right


def _schema(schema, value=None, check_value=False):
    """Small, explicit JSON Schema subset; unsupported keywords fail before launch."""
    allowed = {"type", "properties", "required", "additionalProperties", "items", "enum", "description", "title"}
    if not isinstance(schema, dict) or set(schema) - allowed:
        raise Error("Unsupported output schema; use the documented JSON Schema subset")
    types = {"object": dict, "array": list, "string": str, "integer": int,
             "number": (int, float), "boolean": bool, "null": type(None)}
    kind = schema.get("type")
    if kind not in types:
        raise Error("Each output schema node needs one supported type")
    properties = schema.get("properties", {})
    required = schema.get("required", [])
    if not isinstance(properties, dict) or not isinstance(required, list) or not all(isinstance(x, str) for x in required):
        raise Error("Invalid output schema properties/required")
    if not isinstance(schema.get("additionalProperties", True), bool):
        raise Error("additionalProperties must be boolean")
    for child in properties.values():
        _schema(child)
    if "items" in schema:
        _schema(schema["items"])
    if "enum" in schema and (not isinstance(schema["enum"], list) or not schema["enum"]):
        raise Error("Schema enum needs a nonempty list")
    if not check_value:
        return
    if not isinstance(value, types[kind]) or (kind in {"integer", "number"} and isinstance(value, bool)):
        raise Error("Result does not match output schema type")
    if "enum" in schema and not any(_json_equal(value, member) for member in schema["enum"]):
        raise Error("Result is outside schema enum")
    if kind == "object":
        if set(required) - value.keys() or (schema.get("additionalProperties") is False and value.keys() - properties.keys()):
            raise Error("Result violates required or additional output properties")
        for key, child in properties.items():
            if key in value:
                _schema(child, value[key], True)
    if kind == "array" and "items" in schema:
        for item in value:
            _schema(schema["items"], item, True)


def prepare(root, request):
    if not isinstance(request, dict):
        raise Error("Provider request must be an object")
    allowed = {"adapter", "kind", "prompt", "required_capabilities", "permissions", "model", "reasoning", "billing", "budget", "output_schema"}
    if set(request) - allowed:
        raise Error("Unknown provider request fields")
    if not isinstance(request.get("prompt"), str) or not request["prompt"].strip():
        raise Error("Provider request needs a prompt")
    if len(json.dumps(request).encode()) > MAX_INPUT:
        raise Error("Provider request exceeds 256 KiB")
    adapters = registry(root)
    name = request.get("adapter", "codex")
    if not isinstance(name, str) or name not in adapters:
        raise Error("Unknown provider adapter")
    adapter = adapters[name]
    kind = request.get("kind", "agent-runtime")
    if kind != adapter["kind"]:
        raise Error("Task kind does not match adapter kind")
    required = request.get("required_capabilities", [])
    if not isinstance(required, list) or not all(isinstance(x, str) and x in CAPABILITIES for x in required):
        raise Error("Invalid required_capabilities")
    required = set(required) | {"jsonl", "cancel"}
    permissions = request.get("permissions")
    if name == "codex" and permissions is None:
        permissions = {"sandbox": "read-only"}
    if permissions is not None:
        if not isinstance(permissions, dict) or set(permissions) != {"sandbox"} or permissions["sandbox"] not in {"read-only", "workspace-write"}:
            raise Error("Permissions require an explicit read-only or workspace-write sandbox")
        required.add("permissions")
    for field, capability in [("model", "model_selection"), ("reasoning", "reasoning_selection")]:
        if request.get(field) is not None:
            if not isinstance(request[field], str) or not request[field] or len(request[field]) > 120 or "\n" in request[field]:
                raise Error(f"Invalid {field} preference")
            required.add(capability)
    output_schema = request.get("output_schema")
    if output_schema is not None:
        _schema(output_schema)
        required.add("structured_output")
    missing = required - set(adapter["capabilities"])
    if missing:
        raise Error("Unsupported required capabilities: " + ", ".join(sorted(missing)))
    budget = {**DEFAULT_BUDGET, **request.get("budget", {})} if isinstance(request.get("budget", {}), dict) else None
    if budget is None or set(budget) != set(DEFAULT_BUDGET):
        raise Error("Invalid budget fields")
    for key, value in budget.items():
        _number(value, key, key != "max_api_dollars")
        if key in {"max_attempts", "max_concurrency"} and not isinstance(value, int):
            raise Error(f"{key} must be an integer")
    billing = request.get("billing", {})
    if not isinstance(billing, dict) or set(billing) - {"mode", "confirmed", "allow_api", "acknowledge_posthoc_cost", "reservation_dollars"}:
        raise Error("Invalid billing contract")
    mode = billing.get("mode")
    if mode not in adapter["billing_modes"]:
        raise Error("Explicit supported billing mode required; authentication is never inspected")
    if mode == "subscription" and billing.get("confirmed") is not True:
        raise Error("Confirm subscription billing for the selected local login before execution")
    if mode == "api":
        if billing.get("allow_api") is not True or billing.get("acknowledge_posthoc_cost") is not True:
            raise Error("API billing needs explicit allow_api and acknowledge_posthoc_cost")
        reserve = _number(billing.get("reservation_dollars"), "reservation_dollars", True)
        if not 0 < reserve <= budget["max_api_dollars"]:
            raise Error("API reservation must fit a positive max_api_dollars budget")
    elif billing.get("reservation_dollars", 0):
        raise Error("Only API billing uses dollar reservations")
    settings = {"adapter": name, "adapter_digest": _digest(adapter), "kind": kind,
                "required_capabilities": sorted(required), "permissions": permissions,
                "model": request.get("model"), "reasoning": request.get("reasoning"),
                "output_schema_digest": _digest(output_schema), "billing": billing, "budget": budget}
    return adapter, settings


def build_command(adapter, settings, schema_path=None, session_id=None):
    """Pure argv construction, separately testable without authentication/inference."""
    if adapter["name"] != "codex":
        return list(adapter["command"])
    command = [*adapter["command"], "exec"]
    if session_id:
        command.append("resume")
    command.append("--json")
    sandbox = settings["permissions"]["sandbox"]
    if session_id:
        command += ["-c", "sandbox_mode=" + json.dumps(sandbox)]
    else:
        command += ["--color", "never", "--sandbox", sandbox]
    if settings.get("model") is not None:
        command += ["--model", settings["model"]]
    if settings.get("reasoning") is not None:
        command += ["-c", "model_reasoning_effort=" + json.dumps(settings["reasoning"])]
    if schema_path:
        command += ["--output-schema", str(schema_path)]
    if session_id:
        command.append(session_id)
    command.append("-")
    return command


class Redactor:
    SENSITIVE = re.compile(r"(?:secret|password|passwd|api[_-]?key|authorization|cookie|credential|private[_-]?key|^token$|access[_-]?token|refresh[_-]?token)", re.I)

    def __init__(self, environment=None):
        # Only environment values already inherited by this process; never read credential files.
        self.values = sorted({value for key, value in (environment or os.environ).items()
                              if self.SENSITIVE.search(key) and len(value) >= 4}, key=len, reverse=True)

    def clean(self, value):
        if isinstance(value, dict):
            return {key: "[redacted]" if self.SENSITIVE.search(key) else self.clean(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self.clean(item) for item in value]
        if isinstance(value, str):
            for secret in self.values:
                value = value.replace(secret, "[redacted]")
            value = re.sub(r"(?i)\b(Bearer\s+)\S+", r"\1[redacted]", value)
            value = re.sub(r"\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16})\b", "[redacted]", value)
            value = re.sub(r"(?i)((?:api[_-]?key|password|access_token|secret)\s*[=:]\s*)[^\s,;]+", r"\1[redacted]", value)
        return value


def _usage(attempts):
    result = {}
    for key in ["input_tokens", "output_tokens", "api_dollars"]:
        values = [attempt.get("usage", {}).get(key) for attempt in attempts]
        result[key] = sum(values) if values and all(x is not None for x in values) else None
    result["known_api_dollars"] = sum(attempt.get("usage", {}).get("api_dollars") or 0 for attempt in attempts)
    result["subscription_allowance_remaining"] = None
    return result


def _save(root, task):
    task["updated_at"] = _now()
    task["usage"] = _usage(task["attempts"])
    task["elapsed_seconds"] = sum(item.get("elapsed_seconds") or 0 for item in task["attempts"])
    _write(_task_path(root, task["task_id"]), task)


def _budget_check(root, task):
    budget = task["settings"]["budget"]
    if len(task["attempts"]) >= budget["max_attempts"]:
        raise Error("Attempt budget exhausted; resume never resets it")
    if task.get("elapsed_seconds", 0) >= budget["max_elapsed_seconds"]:
        raise Error("Elapsed budget exhausted")
    active = [item for item in _tasks(root) if item["task_id"] != task["task_id"] and item["status"] in {"running", "unknown"}]
    limit = min([budget["max_concurrency"], *[item["settings"]["budget"]["max_concurrency"] for item in active]])
    if len(active) >= limit:
        raise Error("Project provider concurrency budget reached; reconcile unknown tasks first")
    if task["settings"]["billing"]["mode"] == "api":
        if any(item.get("usage", {}).get("api_dollars") is None for item in task["attempts"]):
            raise Error("Prior API cost is unknown; another paid attempt is blocked")
        reserve = task["settings"]["billing"]["reservation_dollars"]
        if task.get("usage", {}).get("known_api_dollars", 0) + reserve > budget["max_api_dollars"]:
            raise Error("API reservation would exceed the remaining known-dollar budget")


def _stop_group(process):
    # Only the group created by this live invocation; stored PIDs are never killed.
    with contextlib.suppress(ProcessLookupError):
        os.killpg(process.pid, signal.SIGTERM)
    deadline = time.monotonic() + 0.2
    while time.monotonic() < deadline:
        process.poll()
        time.sleep(0.01)
    with contextlib.suppress(ProcessLookupError):
        os.killpg(process.pid, signal.SIGKILL)
    process.wait(timeout=3)


def _event(data, adapter, attempt, task):
    kind = data.get("type")
    if kind in {"session.started", "thread.started"}:
        session = data.get("session_id", data.get("thread_id"))
        if adapter["kind"] != "agent-runtime" or not isinstance(session, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,199}", session):
            raise Error("Invalid agent session receipt")
        task["session_id"] = session
        if isinstance(data.get("model"), str):
            task["resolved_model"] = data["model"]
            attempt["resolved_model"] = data["model"]
    if adapter["name"] == "codex" and kind == "item.completed":
        item = data.get("item", {})
        if isinstance(item, dict) and item.get("type") == "agent_message":
            attempt["output"] = item.get("text")
    terminal = kind == ("turn.completed" if adapter["name"] == "codex" else "result")
    if terminal:
        attempt["terminal_count"] += 1
        attempt["terminal_status"] = "completed" if adapter["name"] == "codex" else data.get("status")
        if adapter["name"] != "codex" and "output" in data:
            attempt["output"] = data["output"]
        usage = data.get("usage", {})
        if isinstance(usage, dict) and (adapter["name"] == "codex" or usage.get("reliable") is True):
            attempt["usage_source"] = "provider-reported; invoice/allowance not independently verified"
            for key in ["input_tokens", "output_tokens", "api_dollars"]:
                value = usage.get(key)
                if value is not None:
                    attempt["usage"][key] = _number(value, "reported " + key)
    if kind in {"error", "turn.failed"}:
        error = data.get("error", data)
        attempt["error"] = error if isinstance(error, dict) else {"message": str(error)}


def _process(root, adapter, settings, request, task, attempt, credential_env=None):
    environment = dict(os.environ)
    if credential_env:
        environment.update(credential_env)
    redactor = Redactor(environment)
    if adapter["name"] in {"codex", "chatgpt"} and settings["billing"]["mode"] == "subscription":
        # Never let a plan connection silently use API-key credentials.
        environment.pop("OPENAI_API_KEY", None)
        environment.pop("CODEX_API_KEY", None)
    directory = _path(root, f"{STATE}/evidence/{task['task_id']}/{attempt['number']}")
    directory.mkdir(parents=True, mode=0o700)
    schema_path = None
    if request.get("output_schema") is not None:
        schema_path = directory / "schema.json"
        _write(schema_path, request["output_schema"])
    command = build_command(adapter, settings, schema_path, task.get("session_id"))
    payload = request["prompt"].encode() if adapter["name"] == "codex" else json.dumps({
        "protocol": "marketcraft-jsonl-v1", **request, "permissions": settings["permissions"],
        "task_id": task["task_id"], "attempt": attempt["number"],
        "operation": "resume" if task.get("session_id") else "start", "session_id": task.get("session_id")}).encode()
    attempt["command_digest"] = _digest(command)
    attempt["executable"] = Path(command[0]).name
    attempt["evidence"] = str((directory / "events.jsonl").relative_to(root))
    log_fd = os.open(directory / "events.jsonl", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    started = time.monotonic()
    remaining = settings["budget"]["max_elapsed_seconds"] - task.get("elapsed_seconds", 0)
    stopping = None
    handlers = {}
    process = None
    selector = selectors.DefaultSelector()
    cancel_path = _path(root, f"{STATE}/cancel/{task['task_id']}.json")

    def interrupted(signum, frame):
        nonlocal stopping
        stopping = "canceled"

    def consume(stream, line):
        nonlocal stopping
        try:
            data = json.loads(line)
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, UnicodeError):
            data = {"type": "unstructured", "text": line.decode(errors="replace")}
            if stream == "stdout":
                stopping = "unknown"
                attempt["error"] = {"code": "invalid_protocol", "message": "Expected JSON object per stdout line"}
        safe = redactor.clean(data)
        log.write(json.dumps({"stream": stream, "event": safe}, allow_nan=False) + "\n")
        log.flush()
        if stream == "stdout" and data.get("type") != "unstructured":
            try:
                _event(safe, adapter, attempt, task)
            except (Error, TypeError):
                stopping = "unknown"
                attempt["error"] = {"code": "invalid_receipt", "message": "Invalid provider session or usage receipt"}
            with _lock(root, f"{STATE}/registry.lock"):
                _save(root, task)

    try:
        with os.fdopen(log_fd, "w") as log:
            if threading.current_thread() is threading.main_thread():
                for signum in [signal.SIGINT, signal.SIGTERM]:
                    handlers[signum] = signal.signal(signum, interrupted)
            try:
                process = subprocess.Popen(command, cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE, start_new_session=True, env=environment)
            except OSError:
                attempt["error"] = {"code": "unavailable", "message": "Adapter executable could not be started"}
                attempt["usage"]["api_dollars"] = 0.0  # No child was launched.
                return "unavailable"
            attempt["pid"] = process.pid
            with _lock(root, f"{STATE}/registry.lock"):
                _save(root, task)
            buffers = {"stdout": b"", "stderr": b""}
            for stream in [process.stdout, process.stderr, process.stdin]:
                os.set_blocking(stream.fileno(), False)
            selector.register(process.stdout, selectors.EVENT_READ, "stdout")
            selector.register(process.stderr, selectors.EVENT_READ, "stderr")
            selector.register(process.stdin, selectors.EVENT_WRITE, "stdin")
            offset = total = 0
            while selector.get_map() or process.poll() is None:
                if cancel_path.exists():
                    stopping = "canceled"
                if time.monotonic() - started >= remaining and not stopping:
                    stopping = "timed_out"
                if stopping:
                    _stop_group(process)
                    break
                for key, mask in selector.select(0.05):
                    stream, label = key.fileobj, key.data
                    if label == "stdin":
                        try:
                            offset += os.write(stream.fileno(), payload[offset:offset + 65536])
                        except BrokenPipeError:
                            offset = len(payload)
                        if offset == len(payload):
                            selector.unregister(stream)
                            stream.close()
                        continue
                    chunk = os.read(stream.fileno(), 65536)
                    total += len(chunk)
                    buffers[label] += chunk
                    if total > MAX_OUTPUT or len(buffers[label]) > MAX_INPUT:
                        stopping = "unknown"
                        attempt["error"] = {"code": "output_limit", "message": "Provider output exceeded bounded evidence limits"}
                        break
                    while b"\n" in buffers[label]:
                        line, buffers[label] = buffers[label].split(b"\n", 1)
                        if line.strip():
                            consume(label, line)
                    if not chunk:
                        if buffers[label].strip():
                            consume(label, buffers[label])
                        selector.unregister(stream)
                        stream.close()
            attempt["returncode"] = process.wait(timeout=3)
            if stopping:
                return stopping
            if attempt.get("error") or attempt["returncode"] != 0:
                return "failed"
            if attempt["terminal_count"] != 1 or attempt.get("terminal_status") != "completed" or "output" not in attempt:
                attempt["error"] = {"code": "missing_completion", "message": "Expected exactly one completed result with output"}
                return "unknown"
            if adapter["kind"] == "agent-runtime" and not task.get("session_id"):
                attempt["error"] = {"code": "missing_session", "message": "Agent runtime did not provide a session receipt"}
                return "unknown"
            if request.get("output_schema") is not None:
                try:
                    if adapter["name"] == "codex" and isinstance(attempt["output"], str):
                        attempt["output"] = json.loads(attempt["output"])
                    _schema(request["output_schema"], attempt["output"], True)
                except (Error, ValueError):
                    attempt["error"] = {"code": "invalid_output", "message": "Final output did not satisfy the requested schema"}
                    return "failed"
            return "completed"
    finally:
        if process:
            if process.poll() is None or sys.exc_info()[0] is not None:
                _stop_group(process)
            for stream in [process.stdin, process.stdout, process.stderr]:
                if stream and not stream.closed:
                    stream.close()
        selector.close()
        for signum, previous in handlers.items():
            signal.signal(signum, previous)
        if schema_path:
            schema_path.unlink(missing_ok=True)
        attempt["elapsed_seconds"] = round(time.monotonic() - started, 6)


def execute(root, request, task_id=None, *, credential_env=None, on_started=None):
    # Private host seam. Credentials are neither request fields nor persisted settings.
    foundry.reject_typescript_workspace(root, "run a provider task")
    if credential_env is not None and (not isinstance(credential_env, dict) or
            set(credential_env) != {"ACCESS_TOKEN"} or
            not isinstance(credential_env["ACCESS_TOKEN"], str) or not credential_env["ACCESS_TOKEN"]):
        raise Error("Only a private ACCESS_TOKEN environment override is supported")
    root = Path(root).resolve()
    adapter, settings = prepare(root, request)
    if credential_env and adapter["name"] != "chatgpt":
        raise Error("ChatGPT credentials can only reach the ChatGPT adapter")
    if adapter["name"] == "chatgpt" and not credential_env:
        raise Error("Connect ChatGPT before running the ChatGPT adapter")
    identifier = task_id or str(uuid.uuid4())
    _task_path(root, identifier)
    with _lock(root, f"{STATE}/leases/{identifier}.lock", False):
        with _lock(root, f"{STATE}/registry.lock"):
            if task_id:
                task = load_task(root, task_id)
                if task["settings"] != settings:
                    raise Error("Resume must preserve adapter, capabilities, model, permissions, schema, billing and budgets")
                if task["status"] in {"running", "unknown"}:
                    raise Error("Interrupted or ambiguous task needs reconciliation before resume")
                if task["status"] == "billing_violation":
                    raise Error("Reported API charges contradict the billing contract; review the adapter before another task")
                if task.get("session_id") and "resume" not in adapter["capabilities"]:
                    raise Error("Adapter cannot resume its existing session")
            else:
                task = {"schema_version": 1, "adapter_contract_version": 1, "task_id": identifier, "created_at": _now(), "settings": settings,
                        "status": "ready", "session_id": None, "requested_model": settings["model"],
                        "resolved_model": None, "attempts": [], "elapsed_seconds": 0}
            _budget_check(root, task)
            attempt = {"number": len(task["attempts"]) + 1, "started_at": _now(), "status": "running",
                       "prompt_digest": _digest(request["prompt"]), "terminal_count": 0,
                       "requested_model": settings["model"], "resolved_model": None,
                       "usage": {"input_tokens": None, "output_tokens": None, "api_dollars": None},
                       "api_reservation_dollars": settings["billing"].get("reservation_dollars", 0),
                       "side_effects": "not_verified"}
            task["attempts"].append(attempt)
            task["status"] = "running"
            task["resolved_model"] = None
            cancel = _path(root, f"{STATE}/cancel/{identifier}.json")
            cancel.unlink(missing_ok=True)
            _save(root, task)
        if on_started:
            on_started(identifier)
        try:
            outcome = _process(root, adapter, settings, request, task, attempt, credential_env)
        except (OSError, ValueError, KeyboardInterrupt):
            # No inferred rollback: the child may have committed an effect before failure.
            outcome = "unknown"
            attempt["error"] = {"code": "runner_interrupted", "message": "Inspect effects and reconcile before retrying"}
        with _lock(root, f"{STATE}/registry.lock"):
            attempt["finished_at"] = _now()
            attempt["status"] = outcome
            task["status"] = outcome
            task["usage"] = _usage(task["attempts"])
            if settings["billing"]["mode"] == "api" and task["usage"]["known_api_dollars"] > settings["budget"]["max_api_dollars"]:
                task["status"] = "budget_exceeded"
            elif settings["billing"]["mode"] != "api" and task["usage"]["known_api_dollars"] > 0:
                task["status"] = "billing_violation"
            task["billing_assurance"] = "request attestation; auth not inspected; no hard dollar cap with posthoc usage"
            _save(root, task)
        return task


def cancel(root, task_id):
    foundry.reject_typescript_workspace(root, "cancel a provider task")
    with _lock(root, f"{STATE}/registry.lock"):
        task = load_task(root, task_id)
        if task["status"] != "running":
            raise Error("Task is not running; inspect status or reconcile it")
        _write(_path(root, f"{STATE}/cancel/{task_id}.json"), {"requested_at": _now()})
    return {"task_id": task_id, "status": "cancellation_requested", "note": "The live runner cancels its owned process group; request is not confirmation."}


def reconcile(root, task_id, acknowledge_stopped=False):
    """A dead lease cannot prove a detached child or external effect has stopped."""
    foundry.reject_typescript_workspace(root, "reconcile a provider task")
    with _lock(root, f"{STATE}/leases/{task_id}.lock", False):
        with _lock(root, f"{STATE}/registry.lock"):
            task = load_task(root, task_id)
            if task["status"] not in {"running", "unknown"}:
                return task
            attempt = task["attempts"][-1]
            if "finished_at" not in attempt:
                # An early reconciliation is not evidence that the detached child
                # stopped. Recompute until acknowledged, preserving prior attempts
                # and never subtracting this attempt's earlier estimate twice.
                age = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(attempt["started_at"])).total_seconds()
                prior_elapsed = sum(item.get("elapsed_seconds") or 0 for item in task["attempts"][:-1])
                remaining = max(0, task["settings"]["budget"]["max_elapsed_seconds"] - prior_elapsed)
                attempt["elapsed_seconds"] = min(remaining, max(0, age, attempt.get("elapsed_seconds") or 0))
            task["status"] = "interrupted" if acknowledge_stopped else "unknown"
            attempt["status"] = task["status"]
            attempt["reconciliation"] = {"at": _now(), "owner_confirmed_stopped_and_effects_checked": acknowledge_stopped}
            _save(root, task)
            return task


def add_commands(subparsers):
    parser = subparsers.add_parser("provider", help="Inspect or explicitly run a local agent/model adapter")
    commands = parser.add_subparsers(dest="provider_action", required=True)
    commands.add_parser("list")
    start = commands.add_parser("run")
    start.add_argument("request", help="Project-relative request JSON; may trigger explicitly authorized inference")
    resume = commands.add_parser("resume")
    resume.add_argument("task_id")
    resume.add_argument("request")
    status = commands.add_parser("status")
    status.add_argument("task_id", nargs="?")
    stop = commands.add_parser("cancel")
    stop.add_argument("task_id")
    repair = commands.add_parser("reconcile")
    repair.add_argument("task_id")
    repair.add_argument("--acknowledge-stopped", action="store_true",
                        help="Confirm old process stopped and any effects inspected; does not erase usage/budgets")


def run(root, args):
    try:
        action = args.provider_action
        if action == "list":
            result = list(registry(root).values())
        elif action == "status":
            result = load_task(root, args.task_id) if args.task_id else _tasks(root)
        elif action in {"run", "resume"}:
            result = execute(root, _read(_path(root, args.request)), getattr(args, "task_id", None))
        elif action == "cancel":
            result = cancel(root, args.task_id)
        elif action == "reconcile":
            result = reconcile(root, args.task_id, args.acknowledge_stopped)
        else:
            raise Error("Unknown provider action")
        print(json.dumps(Redactor().clean(result), indent=2, allow_nan=False))
        if action in {"run", "resume"}:
            return 0 if result["status"] == "completed" else 130 if result["status"] == "canceled" else 1
        return 0
    except (Error, OSError, TypeError) as exc:
        print("Foundry provider: " + Redactor().clean(str(exc)), file=sys.stderr)
        return 2


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=".")
    add_commands(parser.add_subparsers(dest="action", required=True))
    arguments = parser.parse_args()
    raise SystemExit(run(Path(arguments.project).resolve(), arguments))
