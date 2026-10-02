#!/usr/bin/env python3
"""Human-directed local artifact qualification; no model calls or automatic selection."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import uuid

import providers

ACTIONS = {"qualification"}
STATE = ".foundry/state/qualification/state.json"
Error = providers.Error


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def file_ref(root, name):
    path = providers._path(root, name)
    if not path.is_file():
        raise Error("Qualification inputs must be existing project files")
    return {"path": str(path.relative_to(Path(root).resolve())), "sha256": digest(path)}


def load(root):
    path = providers._path(root, STATE)
    return providers._read(path) if path.exists() else {"candidates": {}, "active": None, "selections": []}


def register(root, identity, artifact):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", identity):
        raise Error("Invalid candidate ID")
    ref = file_ref(root, artifact)
    with providers._lock(root, STATE + ".lock"):
        state = load(root)
        existing = state["candidates"].get(identity)
        if existing:
            if existing["artifact"] != ref:
                raise Error("Candidate ID already names a different artifact; use a new ID")
            return existing
        candidate = {"id": identity, "artifact": ref, "evaluations": []}
        state["candidates"][identity] = candidate
        providers._write(providers._path(root, STATE), state)
        return candidate


def finite(value):
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def case_specs(value):
    cases = value.get("cases") if isinstance(value, dict) else None
    if not isinstance(cases, list) or not cases:
        raise Error("Test set requires nonempty cases")
    ids = set()
    for case in cases:
        if (not isinstance(case, dict) or not isinstance(case.get("id"), str)
                or not case["id"] or case["id"] in ids
                or not isinstance(case.get("probe"), str)
                or case["probe"] not in {"local", "live"}
                or not finite(case.get("minimum_score"))):
            raise Error("Invalid or duplicate test case; require id, probe and finite minimum_score")
        ids.add(case["id"])
    return cases


def validate_results(value, cases):
    if not isinstance(value, dict) or set(value) != {"cases"}:
        raise Error("Evaluator result must contain only cases")
    results = value["cases"]
    if not isinstance(results, list) or len(results) != len(cases):
        raise Error("Missing or extra case results")
    by_id = {}
    for result in results:
        if not isinstance(result, dict) or not isinstance(result.get("id"), str) or result["id"] in by_id:
            raise Error("Invalid or duplicate case result")
        if set(result) - {"id", "executed", "passed", "score", "cost"}:
            raise Error("Unsupported case result fields")
        by_id[result["id"]] = result
    if set(by_id) != {case["id"] for case in cases}:
        raise Error("Case identity mismatch")
    accepted = True
    for case in cases:
        result = by_id[case["id"]]
        if (result.get("executed") is not True or type(result.get("passed")) is not bool
                or not finite(result.get("score"))):
            raise Error("Unexecuted or invalid case result")
        cost = result.get("cost")
        if cost is not None and (not finite(cost) or cost < 0):
            raise Error("Invalid cost; unknown cost must be null")
        result["cost"] = cost
        accepted &= result["passed"] and result["score"] >= case["minimum_score"]
    return results, "qualified" if accepted else "rejected"


def current(root, receipt, run_id):
    return (receipt["run_id"] == run_id and all(
        file_ref(root, receipt[key]["path"]) == receipt[key]
        for key in ("artifact", "test_set", "evaluator")))


def evaluate(root, identity, test_set, evaluator, run_id, timeout=30):
    if not finite(timeout) or not 0 < timeout <= 120:
        raise Error("Timeout must be between 0 and 120 seconds")
    with providers._lock(root, STATE + ".lock"):
        state = load(root)
        candidate = state["candidates"].get(identity)
        if candidate is None:
            raise Error("Unknown candidate")
        if file_ref(root, candidate["artifact"]["path"]) != candidate["artifact"]:
            raise Error("Candidate artifact changed; register a new ID")
        receipt = {"id": str(uuid.uuid4()), "run_id": run_id, "artifact": candidate["artifact"],
                   "test_set": file_ref(root, test_set), "evaluator": file_ref(root, evaluator),
                   "status": "blocked", "cases": [], "cost": None}
        try:
            cases = case_specs(providers._read(providers._path(root, test_set)))
            # Live qualification requires a separately authorized integration, not an assertion
            # in a local evaluator's JSON. This interface intentionally cannot qualify it.
            if any(case["probe"] == "live" for case in cases):
                raise Error("Live probes are unverified by this local-only interface")
            request = {"artifact": str(providers._path(root, candidate["artifact"]["path"])),
                       "test_set": str(providers._path(root, test_set)), "cases": cases,
                       "run_id": run_id}
            with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
                process = subprocess.Popen([sys.executable, str(providers._path(root, evaluator))],
                    cwd=root, stdin=subprocess.PIPE, stdout=output, stderr=errors, start_new_session=True)
                try:
                    process.communicate(json.dumps(request, allow_nan=False).encode(), timeout=timeout)
                finally:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
                if process.returncode != 0:
                    raise Error("Evaluator exited unsuccessfully")
                output.seek(0)
                raw = output.read(1024 * 1024 + 1)
                if len(raw) > 1024 * 1024:
                    raise Error("Evaluator result exceeds 1 MiB")
                results, status = validate_results(json.loads(raw), cases)
            if not current(root, receipt, run_id):
                raise Error("Inputs changed during evaluation")
            receipt.update(cases=results, status=status)
            costs = [result["cost"] for result in results]
            receipt["cost"] = sum(costs) if all(cost is not None for cost in costs) else None
            if receipt["cost"] is not None and not finite(receipt["cost"]):
                raise Error("Nonfinite aggregate cost")
        except (Error, OSError, ValueError, subprocess.TimeoutExpired) as exc:
            receipt.update(status="blocked", reason=str(exc), cost=None)
        candidate["evaluations"].append(receipt)
        providers._write(providers._path(root, STATE), state)
        return receipt


def select(root, identity, run_id):
    with providers._lock(root, STATE + ".lock"):
        state = load(root)
        def qualified(name):
            candidate = state["candidates"].get(name)
            if not candidate or not candidate["evaluations"]:
                raise Error("Selection requires executed qualification")
            receipt = candidate["evaluations"][-1]
            if receipt["status"] != "qualified" or not current(root, receipt, run_id):
                raise Error("Selection requires fresh qualification in the active run")
            return receipt
        selection = {"candidate": identity, "previous": state["active"], "run_id": run_id,
                     "evaluation": None, "incumbent_evaluation": None, "status": "blocked"}
        try:
            receipt = qualified(identity)
            selection["evaluation"] = receipt["id"]
            incumbent = qualified(state["active"]) if state["active"] else None
            if incumbent:
                selection["incumbent_evaluation"] = incumbent["id"]
                if any(incumbent[key] != receipt[key] for key in ("test_set", "evaluator")):
                    raise Error("Requalify incumbent and candidate on the same test set and evaluator")
                scores = {case["id"]: case["score"] for case in incumbent["cases"]}
                if any(case["score"] < scores[case["id"]] for case in receipt["cases"]):
                    selection["status"] = "rejected"
                    raise Error("Candidate regresses an incumbent case")
            selection["status"] = "selected"
            state["active"] = identity
        except Error as exc:
            selection["reason"] = str(exc)
            state["selections"].append(selection)
            providers._write(providers._path(root, STATE), state)
            raise
        state["selections"].append(selection)
        providers._write(providers._path(root, STATE), state)
        return selection


def add_commands(subparsers):
    parser = subparsers.add_parser("qualification", help="Explicit local artifact qualification and selection")
    commands = parser.add_subparsers(dest="qualification_action", required=True)
    register_parser = commands.add_parser("register")
    register_parser.add_argument("identity")
    register_parser.add_argument("artifact")
    evaluate_parser = commands.add_parser("evaluate")
    evaluate_parser.add_argument("identity")
    evaluate_parser.add_argument("test_set")
    evaluate_parser.add_argument("evaluator")
    evaluate_parser.add_argument("--timeout", type=float, default=30)
    select_parser = commands.add_parser("select")
    select_parser.add_argument("identity")
    commands.add_parser("status")


def run(root, args):
    import foundry
    try:
        action = args.qualification_action
        if action == "status":
            result = load(root)
        else:
            _, state = foundry.require_active(root)
            if action == "register":
                result = register(root, args.identity, args.artifact)
            elif action == "evaluate":
                result = evaluate(root, args.identity, args.test_set, args.evaluator, state["run_id"], args.timeout)
            else:
                result = select(root, args.identity, state["run_id"])
        print(json.dumps(result, indent=2, allow_nan=False))
        return 1 if result.get("status") in {"blocked", "rejected"} else 0
    except (Error, foundry.Error, OSError, ValueError) as exc:
        print("Foundry qualification: " + str(exc), file=sys.stderr)
        return 2
