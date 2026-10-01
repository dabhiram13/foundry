#!/usr/bin/env python3
"""Adaptive guidance and provenance-bearing project records; no external effects."""
from __future__ import annotations

import argparse
import contextlib
import copy
import datetime as dt
import fcntl
import json
from pathlib import Path
import re
import sys
import uuid
from urllib.parse import urlsplit

try:
    from . import foundry
except ImportError:
    import foundry


ACTIONS = {"guide", "record", "context", "gate", "feedback"}
LEDGER = "docs/project/marketcraft.json"
LOCK = "docs/project/.marketcraft.lock"
STAGES = ("intake", "research", "opportunity", "scope", "flows", "prototype", "design",
          "build", "verify", "release", "learn", "maintain")
METHODS = {"command", "browser", "manual", "customer", "document"}
COMMON = {"id", "kind", "title", "source", "basis", "status", "supersedes", "expires_at",
          "references", "contracts", "inputs", "counterevidence", "accepted_by", "acceptance_ref",
          "confidence", "segment", "workflow"}
FIELDS = {
    "brief": {"goal", "buyer", "intent", "complexity", "surface", "constraints", "capabilities"},
    "assumption": {"validation"},
    "decision": {"rationale"},
    "artifact": {"path", "stage", "owner", "next_action", "criteria"},
    "criterion": {"stage", "required", "expected", "method", "command"},
    "evidence": {"claim", "artifact", "method", "outcome", "observed", "criteria", "check"},
    "experiment": {"hypothesis", "metric", "success_condition", "stop_condition", "operating_scope", "outcome_evidence"},
    "feedback": {"reproduction", "criteria", "next_task", "operating_scope"},
}
GENERATED = {"created_at", "input_revisions", "reference_revisions"}
TEXT_FIELDS = {"title", "accepted_by", "acceptance_ref", "segment", "workflow", "goal", "buyer", "validation",
               "rationale", "owner", "next_action", "expected", "claim", "observed", "check", "hypothesis", "metric",
               "success_condition", "stop_condition", "next_task"}
LIST_FIELDS = {"references", "contracts", "inputs", "counterevidence", "constraints", "capabilities", "criteria", "outcome_evidence"}


def _require(condition, message):
    if not condition:
        raise foundry.Error(message)


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _date(value, label):
    _require(_text(value), f"{label} needs an ISO date or timezone-aware timestamp")
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return dt.datetime.combine(dt.date.fromisoformat(value), dt.time(), dt.timezone.utc)
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        _require(parsed.tzinfo is not None, f"{label} timestamp needs a timezone")
        return parsed
    except ValueError as exc:
        raise foundry.Error(f"Invalid {label}: use an ISO date or timezone-aware timestamp") from exc


def _local(root, name):
    _require(_text(name), "A local reference needs a project-relative file path")
    _require(not Path(name).is_absolute(), f"Local references must be project-relative: {name}")
    path = foundry.within(root, name)
    rel = path.relative_to(Path(root).resolve()).as_posix()
    _require(rel not in {LEDGER, LOCK} and ".git" not in Path(rel).parts,
             "The workflow ledger, lock and Git internals cannot be recorded as inputs")
    return rel


def _revision(record):
    return foundry.digest(json.dumps(record, sort_keys=True, separators=(",", ":")).encode())


def _links(item):
    keys = ("references", "contracts", "counterevidence", "criteria", "outcome_evidence")
    return sorted({ref for key in keys for ref in item.get(key, [])})


def _validate(root, payload, earlier, stored=False):
    """Validate shapes and reference ownership without requiring old inputs to stay current."""
    _require(isinstance(payload, dict), "A record must be a JSON object")
    item = copy.deepcopy(payload)
    kind = item.get("kind")
    _require(isinstance(kind, str) and kind in FIELDS, f"Unknown record kind: {kind}")
    unknown = set(item) - COMMON - FIELDS[kind] - (GENERATED if stored else set())
    _require(not unknown, f"Unknown {kind} fields: {', '.join(sorted(unknown))}")
    identity = item.get("id")
    _require(isinstance(identity, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{0,79}", identity),
             "Record id must be a stable project-local identifier (letters, digits, '.', '_' or '-')")
    _require(identity not in earlier, f"Record {identity} already exists; append a new ID with supersedes")
    for field in TEXT_FIELDS & set(item):
        _require(_text(item[field]), f"{field} must be nonempty text")
    _require(_text(item.get("title")), "title must be nonempty text")
    _require(item.get("basis") in ("observed", "inferred"), "basis must be observed or inferred")
    _require(item.get("status") in ("proposed", "accepted"), "status must be proposed or accepted")
    for field in LIST_FIELDS & set(item):
        value = item[field]
        _require(isinstance(value, list) and all(_text(v) for v in value) and len(value) == len(set(value)),
                 f"{field} must be a list of unique nonempty strings")
    for field in ("references", "contracts", "counterevidence", "inputs"):
        item.setdefault(field, [])
    source = item.get("source")
    _require(isinstance(source, dict), "source provenance is required")
    _require(not set(source) - {"kind", "ref", "observed_at", "published_at", "author"}, "Unknown source fields")
    _require(source.get("kind") in ("owner", "local", "url", "customer", "observation"), "Invalid source kind")
    _require(_text(source.get("ref")), "source.ref is required")
    _date(source.get("observed_at"), "source.observed_at")
    if "published_at" in source:
        _date(source["published_at"], "source.published_at")
    if "author" in source:
        _require(_text(source["author"]), "source.author must be nonempty text")
    if source["kind"] == "url":
        url = urlsplit(source["ref"])
        _require(url.scheme in ("https", "http") and bool(url.netloc) and not url.username and not url.password,
                 "A source URL needs http(s), a host, and no embedded credentials")
    if source["kind"] == "local":
        source["ref"] = _local(root, source["ref"])
    if "expires_at" in item:
        _date(item["expires_at"], "expires_at")
    if "confidence" in item:
        _require(item["confidence"] in ("low", "medium", "high"), "confidence must be low, medium or high")
    if kind in ("brief", "decision") and item["status"] == "accepted":
        _require(_text(item.get("accepted_by")) and _text(item.get("acceptance_ref")),
                 "An accepted brief/decision needs accepted_by and acceptance_ref; proposals are not owner approval")
        _require(source["kind"] == "owner", "Accepted brief/decision provenance must identify the owner's decision")
    required = {
        "brief": ("goal", "buyer", "intent", "complexity", "surface", "constraints", "capabilities"),
        "assumption": ("validation",), "decision": ("rationale",),
        "artifact": ("path", "stage", "owner", "next_action", "criteria"),
        "criterion": ("stage", "required", "expected", "method"),
        "evidence": ("claim",),
        "experiment": ("hypothesis", "metric", "success_condition", "stop_condition", "operating_scope", "outcome_evidence"),
        "feedback": ("criteria", "next_task", "operating_scope"),
    }
    for field in required[kind]:
        _require(field in item, f"{kind} requires {field}")
    if "stage" in item:
        _require(item["stage"] in STAGES, f"stage must be one of {', '.join(STAGES)}")
    if kind == "brief":
        _require(item["intent"] in ("plan", "implement", "review"), "intent must be plan, implement or review")
        _require(item["complexity"] in ("small", "feature", "product"), "complexity must be small, feature or product")
        _require(item["surface"] in ("cli", "api", "web"), "surface must be cli, api or web")
    if kind == "criterion":
        _require(isinstance(item["required"], bool), "required must be a boolean")
        _require(item["inputs"] or item["contracts"], "A criterion needs declared inputs or contract references")
        if item["method"] == "command":
            _require(isinstance(item.get("command"), list) and item["command"] and all(_text(v) for v in item["command"]),
                     "A command criterion needs the expected argv command")
    if "method" in item:
        _require(isinstance(item["method"], str) and item["method"] in METHODS, "Unknown evidence method")
    if "outcome" in item:
        _require(item["outcome"] in ("pass", "fail", "unverified"), "outcome must be pass, fail or unverified")
        if item["outcome"] != "unverified":
            _require(all(_text(item.get(key)) for key in ("artifact", "observed", "method")),
                     "A pass/fail needs an artifact, observed result and method, not just an agent label")
    if "operating_scope" in item:
        _require(item["operating_scope"] in ("local_only", "proposal_only"),
                 "operating_scope must be local_only or proposal_only; a record does not authorize external actions")
    if kind == "feedback":
        _require(item["criteria"] or item.get("reproduction"), "Feedback needs a reproduction artifact or criterion reference")
    for field in ("path", "artifact", "reproduction"):
        if field in item:
            item[field] = _local(root, item[field])
    item["inputs"] = [_local(root, path) for path in item["inputs"]]
    _require(len(item["inputs"]) == len(set(item["inputs"])), "inputs contains duplicate normalized paths")
    for ref in _links(item):
        _require(ref in earlier, f"Unknown reference {ref}; records belong to this project and must already exist")
    for ref in item["contracts"]:
        _require(earlier[ref]["kind"] in ("artifact", "decision", "brief"), f"Contract {ref} must be an artifact, decision or brief")
    for ref in item.get("criteria", []):
        _require(earlier[ref]["kind"] == "criterion", f"Criterion reference {ref} is not a criterion")
    for ref in item.get("outcome_evidence", []):
        _require(earlier[ref]["kind"] == "evidence", f"Experiment outcome {ref} is not evidence")
    if "supersedes" in item:
        ref = item["supersedes"]
        _require(isinstance(ref, str) and ref in earlier, "supersedes must identify an existing record")
        _require(earlier[ref]["kind"] == kind, "A record can supersede only the same kind")
        _require(not any(r.get("supersedes") == ref for r in earlier.values()), f"Record {ref} was already superseded")
        if kind == "evidence":
            _require(set(earlier[ref].get("criteria", [])) <= set(item.get("criteria", [])),
                     "Replacement evidence must retain the superseded evidence's criterion links")
    if stored:
        _date(item.get("created_at"), "created_at")
        for field in ("input_revisions", "reference_revisions"):
            value = item.get(field)
            _require(isinstance(value, dict) and all(isinstance(k, str) and isinstance(v, str) and re.fullmatch(r"[0-9a-f]{64}", v)
                                                    for k, v in value.items()), f"Invalid {field}")
        _require(set(item["reference_revisions"]) == set(_links(item)), "Stored reference revisions do not match links")
        for path in item["input_revisions"]:
            _local(root, path)
        _require(_paths(item) <= set(item["input_revisions"]), "Stored input revisions are missing declared inputs")
    return item


def _paths(item):
    paths = set(item["inputs"])
    paths.update(item[key] for key in ("path", "artifact", "reproduction") if key in item)
    if item["source"]["kind"] == "local":
        paths.add(item["source"]["ref"])
    return paths


def _load(root):
    path = foundry.within(root, LEDGER)
    if not path.exists():
        return {"schema_version": 1, "project_id": None, "records": []}
    data = foundry.read_json(path)
    _require(isinstance(data, dict) and set(data) == {"schema_version", "project_id", "records"}, "Invalid workflow ledger envelope")
    _require(type(data["schema_version"]) is int and data["schema_version"] == 1, "Unsupported workflow schema version")
    try:
        uuid.UUID(data["project_id"])
    except (ValueError, TypeError, AttributeError) as exc:
        raise foundry.Error("Invalid workflow project identity") from exc
    _require(isinstance(data["records"], list), "Workflow records must be a list")
    earlier = {}
    for payload in data["records"]:
        item = _validate(root, payload, earlier, stored=True)
        earlier[item["id"]] = item
    data["records"] = list(earlier.values())
    return data


@contextlib.contextmanager
def _lock(root):
    path = foundry.within(root, LOCK)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise foundry.Error("Another coordinator is updating the project records; retry after it finishes") from exc
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def _receipt(root, item):
    """Read a single command receipt or a named check from a runtime batch."""
    try:
        data = foundry.read_json(foundry.within(root, item["artifact"]))
        _require(isinstance(data, dict), "Command evidence must be a JSON receipt")
        if "checks" in data:
            _require(_text(item.get("check")), "Batch evidence needs a check name")
            _require(isinstance(data["checks"], list), "Malformed receipt batch")
            matches = [r for r in data["checks"] if isinstance(r, dict) and r.get("name") == item["check"]]
            _require(len(matches) == 1, "Named check is absent or ambiguous in the receipt")
            return matches[0]
        return data
    except (KeyError, OSError, ValueError, TypeError) as exc:
        raise foundry.Error(f"Unavailable command evidence: {exc}") from exc


def record(root, payload):
    """Append a validated immutable record, capturing exact local input/link revisions."""
    root = Path(root).resolve()
    data = _load(root)
    _validate(root, payload, {r["id"]: r for r in data["records"]})
    with _lock(root):
        data = _load(root)
        earlier = {r["id"]: r for r in data["records"]}
        item = _validate(root, payload, earlier)
        states = _states(root, data)
        for ref in _links(item):
            _require(states[ref]["freshness"] == "active", f"Reference {ref} is {states[ref]['freshness']}; refresh it first")
        paths = _paths(item)
        if item.get("method") == "command" and item.get("artifact"):
            receipt = _receipt(root, item)
            if receipt.get("log"):
                paths.add(_local(root, receipt["log"]))
            if isinstance(receipt.get("input_revisions"), dict):
                paths.update(_local(root, path) for path in receipt["input_revisions"])
        revisions = {}
        for name in sorted(paths):
            path = foundry.within(root, name)
            _require(path.is_file(), f"Input artifact is missing or not a file: {name}")
            revisions[name] = foundry.digest(path.read_bytes())
        item.update(created_at=foundry.now(), input_revisions=revisions,
                    reference_revisions={ref: _revision(earlier[ref]) for ref in _links(item)})
        previous = earlier.get(item.get("supersedes"), {})
        if previous.get("kind") == "evidence" and previous.get("outcome") == "fail":
            candidate = {"records": [*data["records"], item]}
            _require(_states(root, candidate)[item["id"]]["freshness"] == "active",
                     "A failure replacement must have fresh inputs, references and an unexpired observation")
            for ref in previous.get("criteria", []):
                verdict, _ = _observation(root, item, earlier[ref], earlier)
                _require(verdict in ("pass", "fail"),
                         "An unresolved failure can only be superseded by sufficient observed pass/fail evidence")
        data["project_id"] = data["project_id"] or str(uuid.uuid4())
        data["records"].append(item)
        foundry.atomic_json(foundry.within(root, LEDGER), data)
        return item


def _states(root, data):
    superseded = {r["supersedes"] for r in data["records"] if "supersedes" in r}
    records = {r["id"]: r for r in data["records"]}
    states = {}
    clock = dt.datetime.now(dt.timezone.utc)
    for item in data["records"]:
        reasons = []
        if item.get("expires_at") and _date(item["expires_at"], "expires_at") <= clock:
            reasons.append("Evidence review/expiry date has passed")
        for name, expected in item["input_revisions"].items():
            try:
                path = foundry.within(root, name)
                actual = foundry.digest(path.read_bytes()) if path.is_file() else None
            except (OSError, foundry.Error):
                actual = None
            if actual != expected:
                reasons.append(f"Input changed or missing: {name}")
        for ref, revision in item["reference_revisions"].items():
            if ref in superseded or states[ref]["freshness"] != "active":
                reasons.append(f"Reference {ref} is superseded or stale")
            if _revision(records[ref]) != revision:
                reasons.append(f"Reference revision changed: {ref}")
        states[item["id"]] = {"freshness": "superseded" if item["id"] in superseded else "stale" if reasons else "active",
                               "reasons": reasons}
    return states


def context(root):
    """Return reconstructable records and freshness without touching the filesystem."""
    root = Path(root).resolve()
    data = _load(root)
    states = _states(root, data)
    records = [dict(item, **states[item["id"]]) for item in data["records"]]
    stale = [r for r in records if r["freshness"] == "stale"]
    followups = [r for r in records if r["freshness"] == "active" and r["kind"] == "feedback"]
    handoffs = [r for r in records if r["freshness"] == "active" and r["kind"] == "artifact"]
    if stale:
        next_action = "Refresh stale records and affected handoffs: " + ", ".join(r["id"] for r in stale)
    elif followups:
        next_action = followups[-1]["next_task"]
    elif handoffs:
        next_action = handoffs[-1]["next_action"]
    else:
        next_action = "Use guide to select the next scoped step from the request and current project"
    return {"schema_version": 1, "project_id": data["project_id"], "records": records, "next_action": next_action}


def _criterion_inputs(criterion, records):
    inputs, visited, pending = {}, set(), [criterion]
    while pending:
        item = pending.pop()
        if item["id"] in visited:
            continue
        visited.add(item["id"])
        for path, revision in item["input_revisions"].items():
            _require(path not in inputs or inputs[path] == revision, f"Conflicting declared revisions for {path}")
            inputs[path] = revision
        pending.extend(records[ref] for ref in item["reference_revisions"])
    return inputs


def _observation(root, evidence, criterion, records):
    if evidence["basis"] != "observed" or evidence["status"] != "accepted":
        return "unverified", "Evidence is inferred or proposed"
    if not all(evidence.get(key) for key in ("artifact", "observed", "method", "outcome")):
        return "unverified", "Missing direct observation and local artifact; agent labels are insufficient"
    if evidence["outcome"] == "fail":
        return "fail", "Unresolved recorded failure"
    if evidence["outcome"] != "pass" or evidence["method"] != criterion["method"]:
        return "unverified", "Observation method/outcome does not satisfy the criterion"
    if evidence["method"] == "command":
        try:
            receipt = _receipt(root, evidence)
            _require(receipt.get("command") == criterion["command"], "Receipt command differs from criterion argv")
            _require(type(receipt.get("exit_code")) is int and receipt["exit_code"] == 0 and receipt.get("status") == "passed",
                     "Receipt does not establish a successful command")
            before, after = receipt.get("input_revisions"), receipt.get("input_revisions_after")
            _require(isinstance(before, dict) and before and isinstance(after, dict),
                     "Receipt lacks executed input revisions; configure check.inputs and rerun the check")
            _require(before == after, "Inputs changed during the command")
            declared = _criterion_inputs(criterion, records)
            _require(bool(declared) and all(before.get(path) == revision for path, revision in declared.items()),
                     "Receipt does not cover the criterion's declared input/contract revisions; configure check.inputs and rerun")
            for path, revision in before.items():
                name = _local(root, path)
                actual = foundry.within(root, name)
                _require(isinstance(revision, str) and actual.is_file() and foundry.digest(actual.read_bytes()) == revision,
                         f"Executed input changed or missing: {name}")
                _require(name in evidence["input_revisions"], f"Executed input was not pinned: {name}")
            name = _local(root, receipt.get("log"))
            log = foundry.within(root, name)
            _require(log.is_file() and foundry.digest(log.read_bytes()) == receipt.get("log_sha256"), "Receipt log changed or missing")
            _require(name in evidence["input_revisions"], "Receipt log was not pinned when evidence was recorded")
        except (foundry.Error, OSError, ValueError, TypeError) as exc:
            return "unverified", str(exc)
    return "pass", "Recorded observation and its declared input/contract revisions are current"


def gate(root, stage=None):
    """Evaluate declared evidence coverage; never infer semantic quality or owner approval."""
    root = Path(root).resolve()
    _require(stage is None or stage in STAGES, "Unknown gate stage")
    records = context(root)["records"]
    by_id = {r["id"]: {key: value for key, value in r.items() if key not in ("freshness", "reasons")} for r in records}
    successors = {r["supersedes"]: r for r in records if "supersedes" in r}
    criteria = [r for r in records if r["kind"] == "criterion" and r["freshness"] != "superseded"
                and (stage is None or r["stage"] == stage)]
    results = []
    for criterion in criteria:
        observations = []
        for item in records:
            if item["kind"] != "evidence" or criterion["id"] not in item.get("criteria", []):
                continue
            unresolved = item.get("outcome") == "fail" and item["basis"] == "observed" and item["status"] == "accepted"
            if item["freshness"] == "superseded":
                if unresolved:
                    replacement = item
                    while replacement["id"] in successors:
                        replacement = successors[replacement["id"]]
                    resolution = _observation(root, replacement, criterion, by_id)[0] if replacement["freshness"] == "active" else "unverified"
                    if resolution != "pass":
                        observations.append({"id": item["id"], "status": "unverified", "unresolved_failure": True,
                                             "reason": f"Failure resolution {replacement['id']} no longer establishes a current pass"})
                continue
            verdict, reason = ("unverified", "; ".join(item["reasons"])) if item["freshness"] != "active" else _observation(root, item, criterion, by_id)
            observations.append({"id": item["id"], "status": verdict, "reason": reason, "unresolved_failure": unresolved})
        if criterion["freshness"] != "active" or criterion["status"] != "accepted":
            status, reason = "unverified", "Criterion is stale or proposed; reconcile it before using evidence"
        elif any(e["status"] == "fail" for e in observations):
            status, reason = "fail", "A linked failure remains unresolved; a new pass does not erase it"
        elif any(e["unresolved_failure"] for e in observations):
            status, reason = "unverified", "An unresolved failure has stale evidence; reconcile it explicitly before passing"
        elif any(e["status"] == "pass" for e in observations):
            status, reason = "pass", "Fresh evidence covers the criterion"
        else:
            status, reason = "unverified", "Missing sufficient fresh observed evidence"
        results.append({"id": criterion["id"], "required": criterion["required"], "stage": criterion["stage"],
                        "status": status, "reason": reason, "evidence": observations})
    required = [r for r in results if r["required"]]
    status = "fail" if any(r["status"] == "fail" for r in required) else "pass" if required and all(r["status"] == "pass" for r in required) else "unverified"
    return {"status": status, "stage": stage, "criteria": results,
            "assurance": "Checks declared coverage and recorded artifact freshness. Human observations remain attributed claims; this does not establish semantic quality, owner approval, deployment or production qualification."}


PATH_OUTCOMES = {
    "scope": "A bounded goal, non-goals and observable acceptance criteria",
    "research": "Dated buyer/workflow evidence and counterevidence for consequential uncertainties",
    "opportunity": "A switching case, pricing/channel hypotheses and a bounded validation experiment",
    "flows": "Flows, navigation, realistic content and loading/empty/error/recovery states",
    "prototype": "A wireframe or prototype covering the critical journey",
    "design": "Visual direction, tokens, components, responsive behavior and copy",
    "build": "One working vertical slice through the required layers",
    "verify": "Behavior and relevant usability/accessibility/rendered evidence on current inputs",
    "release": "Authorized target, verified revision and recovery procedure",
    "learn": "Outcome measurements and scoped customer-feedback followups",
}


def guide(root, request=None, intent=None, complexity=None, surface=None, required=None, available=None):
    """Recommend one next action. Planning and review do not acquire implementation authority."""
    root = Path(root).resolve()
    saved = context(root)
    records = saved["records"]
    briefs = [r for r in records if r["kind"] == "brief" and r["freshness"] == "active" and r["status"] == "accepted"]
    brief = briefs[-1] if briefs else {}
    new_request = request is not None
    intent_source = "explicit" if intent is not None else "conservative_new_request" if new_request else "saved_intake" if brief else "default"
    request = request if request is not None else brief.get("goal", "")
    intent = intent if intent is not None else "plan" if new_request else brief.get("intent", "plan")
    complexity = complexity or brief.get("complexity", "feature")
    surface = surface or brief.get("surface", "api")
    _require(intent in ("plan", "implement", "review"), "Unknown request intent")
    _require(complexity in ("small", "feature", "product"), "Unknown complexity")
    _require(surface in ("cli", "api", "web"), "Unknown surface")
    required = list(required) if required is not None else brief.get("capabilities", [])
    available = list(available or [])
    _require(all(_text(c) for c in required + available), "Capabilities must be named explicitly")
    stages = ["scope", "build", "verify"]
    if complexity == "product":
        stages = ["research", "opportunity", "scope"] + (["flows", "prototype", "design"] if surface == "web" else []) + ["build", "verify", "release", "learn"]
    elif complexity == "feature" and surface == "web":
        stages = ["scope", "flows", "design", "build", "verify"]
    user_needed = [{"kind": "capability", "capability": cap,
                    "action": f"Choose or connect an authorized {cap} capability, or revise the scope",
                    "reason": "Required capability is not declared available; unsupported is not success"}
                   for cap in sorted(set(required) - set(available))]
    if not request:
        user_needed.append({"kind": "scope", "action": "Describe the intended user and useful outcome",
                            "reason": "No request or accepted intake brief is recorded"})
    _, active = foundry.active(root)
    specs_dir = foundry.within(root, "docs/specs")
    specs = sorted(p.relative_to(root).as_posix() for p in specs_dir.glob("*.md") if p.is_file() and not p.is_symlink()) if specs_dir.is_dir() else []
    criteria = [r for r in records if r["kind"] == "criterion" and r["freshness"] == "active" and r["status"] == "accepted"]
    stale = [r for r in records if r["freshness"] == "stale"]
    stage, action, reason = stages[0], "", "Use only depth needed for this task; records are evidence, not a mandatory pipeline"
    if intent == "plan":
        action = "Prepare or refine the scoped project plan and its next decision"
        reason = "This is a planning request; implementation and runtime start are not authorized by guidance"
    elif intent == "review":
        stage, action = "verify", "Review current behavior and artifacts against the declared criteria; report evidence gaps"
        reason = "A review request does not authorize product edits"
    elif active and active.get("status") in ("paused", "interrupted", "verifying"):
        stage, action = "build", "Inspect interrupted work and evidence, then resume the existing run when authorized"
        reason = "An existing run takes precedence over starting another feature"
    elif stale:
        action, reason = saved["next_action"], "Dependent work must reconcile changed inputs and superseded decisions"
    elif complexity == "product" and not any(r["kind"] == "artifact" and r.get("stage") == "opportunity" and r["freshness"] == "active" and r["status"] == "accepted" for r in records):
        stage, action = "research", "Resolve the next decision-changing buyer/workflow uncertainty, then record an opportunity thesis"
        reason = "Competitor pricing and simulated interviews alone do not validate customer demand"
    elif not criteria:
        stage, action = "scope", "Define the smallest useful behavior and its acceptance criteria using existing product documents"
        reason = "A spec's presence alone does not prove acceptance coverage"
    else:
        artifacts = {r["stage"] for r in records if r["kind"] == "artifact" and r["freshness"] == "active" and r["status"] == "accepted"}
        missing_design = [name for name in stages if name in ("flows", "prototype", "design") and name not in artifacts]
        if missing_design:
            stage = missing_design[0]
            action = "Prepare or reuse the scoped handoff: " + PATH_OUTCOMES[stage]
            reason = "The selected UI depth needs this artifact; reuse the existing product system when applicable"
        elif active:
            stage = "verify" if active.get("status") == "verified" else "build"
            action = "Compare acceptance evidence and record local completion" if stage == "verify" else "Continue the existing run's next scoped task and exercise its behavior"
            reason = "Continue the existing run; runtime verification and product acceptance are separate"
        else:
            stage, action = "build", "Prepare the next scoped implementation from the accepted criteria and existing documents"
            reason = "The coordinator can now select applicable tools and start a run within the owner's implementation authority"
    return {"request": request, "current": {"intent": intent, "intent_source": intent_source, "complexity": complexity, "surface": surface,
            "run_status": active.get("status") if active else "idle", "run_id": active.get("run_id") if active else None,
            "specs": specs, "records": len(records), "accepted_criteria": len(criteria)},
            "next": {"stage": stage, "action": action, "reason": reason}, "user_needed": user_needed,
            "path": [{"stage": name, "outcome": PATH_OUTCOMES[name]} for name in stages],
            "limits": ["Recommendation only: no files, runs, connections, purchases, deployments or background jobs were created",
                       "Complexity/surface are explicit inputs or saved intake; defaults are feature/api until the coordinator supplies task context"]}


def add_commands(subparsers):
    p = subparsers.add_parser("guide", help="Read current context and recommend an adaptive next step")
    p.add_argument("--request")
    p.add_argument("--intent", choices=("plan", "implement", "review"))
    p.add_argument("--complexity", choices=("small", "feature", "product"))
    p.add_argument("--surface", choices=("cli", "api", "web"))
    p.add_argument("--requires", action="append", dest="required")
    p.add_argument("--available", action="append")
    for name in ("record", "feedback"):
        p = subparsers.add_parser(name, help="Append an explicit, validated product record")
        p.add_argument("--file", required=True, help="Project-relative JSON record file")
    p = subparsers.add_parser("context", help="Read records, provenance, freshness and next action")
    p.add_argument("--id")
    p = subparsers.add_parser("gate", help="Check fresh evidence for declared criteria without executing checks")
    p.add_argument("--stage", choices=STAGES)


def run(root, args):
    if args.action == "guide":
        result = guide(root, args.request, args.intent, args.complexity, args.surface, args.required, args.available)
    elif args.action in ("record", "feedback"):
        payload = foundry.read_json(foundry.within(root, _local(root, args.file)))
        if args.action == "feedback":
            _require(isinstance(payload, dict) and payload.get("kind") == "feedback", "feedback accepts only a feedback record")
        result = record(root, payload)
    elif args.action == "context":
        result = context(root)
        if args.id:
            result["records"] = [r for r in result["records"] if r["id"] == args.id]
            _require(bool(result["records"]), f"Unknown record {args.id}")
    elif args.action == "gate":
        result = gate(root, args.stage)
    else:
        raise foundry.Error(f"Unknown workflow action: {args.action}")
    print(json.dumps(result, indent=2))
    return 1 if args.action == "gate" and result["status"] != "pass" else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=".")
    add_commands(parser.add_subparsers(dest="action", required=True))
    args = parser.parse_args()
    try:
        return run(foundry.project_root(args.project), args)
    except (foundry.Error, OSError, ValueError, TypeError) as exc:
        print(f"Marketcraft: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
