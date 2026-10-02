#!/usr/bin/env python3
"""Run isolated SaaS fixture stages; missing required browser capability is UNVERIFIED."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "saas_app"


def now():
    return datetime.now(timezone.utc).isoformat()


def source_revision():
    files = [Path(__file__).resolve(), *sorted(path for path in FIXTURE.iterdir()
             if path.is_file() and path.suffix in {".py", ".cjs", ".js", ".html", ".css"})]
    digest = hashlib.sha256()
    for path in files:
        digest.update(str(path.relative_to(ROOT)).encode() + b"\0" + path.read_bytes() + b"\0")
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True)
    return {"commit": result.stdout.strip() if result.returncode == 0 else None,
            "working_tree_dirty": bool(dirty.stdout) if dirty.returncode == 0 else None,
            "fixture_source_sha256": digest.hexdigest(),
            "files": [str(path.relative_to(ROOT)) for path in files]}


def run_stage(name, command, output, env, timeout):
    started = time.monotonic()
    log = output / f"{name}.log"
    result = {"name": name, "required": True, "command": command, "evidence": [log.name]}
    try:
        with log.open("w") as stream:
            child = subprocess.Popen(command, cwd=ROOT, env=env, stdout=stream, stderr=subprocess.STDOUT,
                                     start_new_session=True)
            try:
                code = child.wait(timeout=timeout)
            except (subprocess.TimeoutExpired, KeyboardInterrupt) as exc:
                result["cleanup"] = terminate_owned_processes(child)
                result.update(status="FAIL", exit_code=child.returncode,
                              interrupted=isinstance(exc, KeyboardInterrupt), terminated=True,
                              reason="Stage interrupted or timed out; required evidence is incomplete.")
            else:
                result.update(exit_code=code, status="PASS" if code == 0 else "FAIL")
    except OSError as exc:
        result.update(status="UNVERIFIED", exit_code=None, reason=str(exc))
        log.write_text(str(exc) + "\n")
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    return result


def terminate_owned_processes(child):
    """Cancel our new process group plus observed child groups (Chromium detaches).

    Read process IDs/parent IDs/group IDs only, never unrelated process arguments.
    Give the browser runner time to save its trace and close Chrome, then kill any
    surviving groups captured while the owned parent was still present.
    """
    groups = {child.pid}
    inventory_available = False
    try:
        snapshot = subprocess.run(["ps", "-axo", "pid=,ppid=,pgid="], capture_output=True,
                                  text=True, timeout=2, check=True)
        rows = [tuple(map(int, line.split())) for line in snapshot.stdout.splitlines() if line.strip()]
        descendants = {child.pid}
        while True:
            found = {pid for pid, parent, _group in rows if parent in descendants}
            if found <= descendants:
                break
            descendants.update(found)
        groups.update(group for pid, _parent, group in rows if pid in descendants and group in descendants)
        inventory_available = True
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    finally:
        for group in groups:
            try:
                os.killpg(group, signal.SIGKILL)
            except ProcessLookupError:
                pass
        child.wait(timeout=5)
    return {"owned_process_groups": sorted(groups), "descendant_inventory_available": inventory_available}


def file_receipts(output):
    return [{"path": str(path.relative_to(output)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
             "bytes": path.stat().st_size}
            for path in sorted(output.rglob("*")) if path.is_file()]


def process_control_available():
    if os.name != "posix":
        return False
    try:
        subprocess.run(["ps", "-p", str(os.getpid()), "-o", "pid=,ppid=,pgid="],
                       capture_output=True, timeout=2, check=True)
        return True
    except (OSError, subprocess.SubprocessError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    stages = parser.add_mutually_exclusive_group()
    stages.add_argument("--http-only", action="store_true", help="Only HTTP is required; browser remains explicitly unverified")
    stages.add_argument("--browser-only", action="store_true", help="Only browser is required; HTTP remains explicitly unverified")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "output" / "playwright" / "journey",
                        help="Parent directory for a fresh unique run and its report.json")
    parser.add_argument("--node", default=os.environ.get("MARKETCRAFT_NODE", "node"))
    parser.add_argument("--playwright-module", default=os.environ.get("MARKETCRAFT_PLAYWRIGHT_MODULE"),
                        help="Existing Playwright/playwright-core package directory or module; never downloaded")
    parser.add_argument("--browser-executable", default=os.environ.get("MARKETCRAFT_BROWSER_EXECUTABLE"),
                        help="Existing Chromium/Chrome executable; omit to use Playwright's installed browser")
    args = parser.parse_args()
    output = args.output_dir.expanduser().resolve() / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8])
    output.mkdir(parents=True)
    report = {
        "schema_version": 1, "kind": "deterministic_fixture_evaluation", "started_at": now(),
        "source_revision": source_revision(), "python": sys.version.split()[0], "stages": [],
        "scope": "Real local session/tenant/storage behavior with a deterministic fake outline provider. Not proof of native agent-generated SaaS delivery.",
    }
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    if args.playwright_module:
        env["MARKETCRAFT_PLAYWRIGHT_MODULE"] = args.playwright_module
    if args.browser_executable:
        env["MARKETCRAFT_BROWSER_EXECUTABLE"] = args.browser_executable
    report["browser_configuration"] = {"node": args.node, "playwright_module": args.playwright_module,
                                       "browser_executable": args.browser_executable}
    def interrupt(_signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupt)
    interrupted = False
    for name, skipped in (("http", args.browser_only), ("browser", args.http_only)):
        if skipped:
            report["stages"].append({"name": name, "required": False, "status": "UNVERIFIED",
                                     "reason": "Not requested in this scoped run.", "evidence": []})
            continue
        if interrupted:
            report["stages"].append({"name": name, "required": True, "status": "UNVERIFIED",
                                     "reason": "Cancelled before this stage began.", "evidence": []})
            continue
        if name == "browser" and not process_control_available():
            report["stages"].append({"name": name, "required": True, "status": "UNVERIFIED",
                                     "reason": "Browser execution requires POSIX process inspection for bounded child cleanup.", "evidence": []})
            continue
        if name == "http":
            try:
                with socket.socket() as listener:
                    listener.bind(("127.0.0.1", 0))
            except OSError as exc:
                report["stages"].append({"name": name, "required": True, "status": "UNVERIFIED",
                                         "reason": f"Cannot bind the isolated loopback fixture: {exc}", "evidence": []})
                continue
        command = [sys.executable, "-m", "unittest", "discover", "-s", str(FIXTURE), "-p", "test_app.py", "-v"] if name == "http" else [
            args.node, str(FIXTURE / "browser_journey.cjs"), "--output", str(output / "browser"), "--python", sys.executable]
        stage = run_stage(name, command, output, env, 120)
        interrupted = stage.get("interrupted", False)
        if name == "browser":
            browser_report = output / "browser" / "browser.json"
            if browser_report.exists():
                try:
                    evidence = json.loads(browser_report.read_text())
                    status = evidence.get("status")
                    if status not in {"PASS", "FAIL", "UNVERIFIED"}:
                        raise ValueError("Browser report has an invalid status")
                    # A nonzero executable or report cannot manufacture a pass.
                    if stage.get("terminated") or (status == "PASS" and stage["exit_code"] != 0):
                        status = "FAIL"
                    if status == "PASS":
                        required = {"UX-LOADING-KEYBOARD", "AUTH-EMPTY", "ENTITLEMENT", "PROVIDER-FAILURE",
                                    "SAVE-RETRY", "RETURN-RESTART", "MOBILE-A11Y", "TENANT-UI", "BROWSER-RUNTIME",
                                    "REFRESH-RETRY-SESSION", "REFRESH-RETRY-LIST", "GUIDED-EDIT-RESUME", "ACTIVATION-ONCE"}
                        passed = {criterion.get("id") for criterion in evidence.get("criteria", []) if criterion.get("status") == "PASS"}
                        if not required <= passed:
                            raise ValueError("Browser report is missing required journey criteria")
                        for artifact in ("trace.zip", "06-outline-desktop.png", "07-mobile-keyboard.png",
                                         "07b-mobile-result.png", "05-error-retry.png"):
                            path = browser_report.parent / artifact
                            if not path.is_file() or path.stat().st_size == 0:
                                raise ValueError(f"Browser evidence is missing {artifact}")
                    stage.update(status=status, criteria=evidence.get("criteria", []),
                                 reason=evidence.get("error"))
                    stage["evidence"].append(str(browser_report.relative_to(output)))
                except (OSError, ValueError) as exc:
                    stage.update(status="FAIL", reason=f"Invalid browser evidence: {exc}")
            elif stage["status"] == "PASS":
                stage.update(status="FAIL", reason="Browser command produced no evidence report.")
        report["stages"].append(stage)
    current_revision = source_revision()
    source_unchanged = current_revision["fixture_source_sha256"] == report["source_revision"]["fixture_source_sha256"]
    report["stages"].append({"name": "source_consistency", "required": True,
                             "status": "PASS" if source_unchanged else "FAIL",
                             "reason": "Fixture source was unchanged during evaluation." if source_unchanged else "Fixture source changed while checks ran; rerun evaluation.",
                             "evidence": []})
    report["stages"].extend([
        {"name": "real_provider_qualification", "required": False, "status": "UNVERIFIED",
         "reason": "No real provider, payment, mail, cloud authentication or production infrastructure was exercised.", "evidence": []},
        {"name": "native_agent_delivery", "required": False, "status": "UNVERIFIED",
         "reason": "Fixed fixture checks do not exercise skill activation, native delegation or agent-generated product quality.", "evidence": []},
    ])
    required = [stage["status"] for stage in report["stages"] if stage["required"]]
    report["status"] = "FAIL" if "FAIL" in required else "UNVERIFIED" if "UNVERIFIED" in required else "PASS"
    report["finished_at"] = now()
    report["artifact_receipts"] = file_receipts(output)
    report_path = output / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "report": str(report_path),
                      "stages": [{"name": stage["name"], "status": stage["status"], "required": stage["required"]} for stage in report["stages"]]}, indent=2))
    return {"PASS": 0, "FAIL": 1, "UNVERIFIED": 2}[report["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
