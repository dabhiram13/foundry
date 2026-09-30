#!/usr/bin/env python3
"""Local product workflows. Python 3.11+, no services or third-party packages."""
import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import uuid

VERSION = "0.1.0"
EXCLUDED = {".git", "__pycache__", ".venv", "node_modules", ".next", "coverage", "dist", "build"}
MANAGED = [".agents/skills", ".codex/agents", ".codex/hooks.json", ".codex/config.toml",
           ".foundry/workflows", ".foundry/philosophy", ".foundry/references", ".foundry/migrations",
           "library", "scripts/foundry.py", "scripts/hooks.py", "scripts/security_scan.py",
           "scripts/migrate-catalog.py", ".githooks/pre-commit", "docs/WORKFLOW.md",
           "docs/CATALOG.md", "docs/CUSTOMIZATION.md", "docs/HOOKS.md",
           ".foundry/LICENSE-framework", ".foundry/THIRD_PARTY_NOTICES.md"]
AGENTS_START = "<!-- product-foundry:start -->"
AGENTS_END = "<!-- product-foundry:end -->"


class Error(Exception):
    pass


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        raise Error(f"Cannot read {path}: {exc}") from exc


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def atomic_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def reject_symlink_components(path, stop=None):
    """Reject existing symlinks from stop (exclusive) through path (inclusive)."""
    path = Path(os.path.abspath(path))
    stop = Path(os.path.abspath(stop)) if stop is not None else Path(path.anchor)
    try:
        parts = path.relative_to(stop).parts
    except ValueError as exc:
        raise Error(f"Path is outside expected root: {path}") from exc
    current = stop
    for part in parts:
        current /= part
        if current.is_symlink():
            raise Error(f"Symlink path component is not allowed: {current}")


def within(root, relative):
    root = Path(root).resolve()
    relative = Path(relative).expanduser()
    if ".." in relative.parts:
        raise Error(f"Path escapes project: {relative}")
    path = Path(os.path.abspath(relative if relative.is_absolute() else root / relative))
    if not path.is_relative_to(root):
        raise Error(f"Path escapes project: {relative}")
    reject_symlink_components(path, root)
    return path


def project_root(path):
    raw = Path(path).expanduser()
    if ".." in raw.parts:
        raise Error("Project path must not contain parent traversal")
    raw = Path(os.path.abspath(raw))
    reject_symlink_components(raw)
    path = raw.resolve()
    for p in [path, *path.parents]:
        marker = p / ".foundry/project.json"
        if marker.is_symlink():
            raise Error(".foundry/project.json must not be a symlink")
        if marker.is_file():
            return p
    raise Error("No .foundry/project.json found. Install Foundry or create project checks first.")


@contextlib.contextmanager
def lock(root):
    directory = root / ".foundry/state"
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / "coordinator.lock").open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise Error("Another coordinator is updating this checkout. Wait for it or interrupt that process.") from exc
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


@contextlib.contextmanager
def install_lock(target):
    """Serialize installs without mutating a target that may fail preflight."""
    key = digest(os.fsencode(str(target)))[:24]
    path = Path(tempfile.gettempdir()) / f"product-foundry-install-{key}.lock"
    with path.open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise Error("Another Product Foundry install is updating this target.") from exc
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def install_repository_state(target):
    """Return whether target is its own Git root; reject inherited repositories."""
    if not shutil.which("git"):
        raise Error("Git is required before installing Product Foundry")
    probe = target
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    result = subprocess.run(
        ["git", "-C", str(probe), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        git_root = Path(result.stdout.strip()).resolve()
        if git_root != target:
            raise Error(
                f"Install target is nested inside a different Git repository: {git_root}. "
                "Choose a standalone folder or that repository root."
            )
        return True
    git_metadata = target / ".git"
    if git_metadata.exists() or git_metadata.is_symlink():
        raise Error("Install target has invalid Git metadata")
    return False


def active(root):
    pointer = within(root, ".foundry/state/active.json")
    if not pointer.exists():
        return None, None
    ref = read_json(pointer)
    run_id = ref.get("run_id", "")
    try:
        uuid.UUID(run_id)
    except (ValueError, TypeError) as exc:
        raise Error("Invalid active run ID") from exc
    path = within(root, Path(".foundry/state/runs") / run_id / "state.json")
    state = read_json(path)
    if state.get("run_id") != run_id:
        raise Error("Active pointer does not match run state")
    return path, state


def require_active(root):
    path, state = active(root)
    if not state:
        raise Error("No active run. Use start SLUG --spec PATH.")
    return path, state


def source_files(root):
    result = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
                            cwd=root, capture_output=True)
    if result.returncode == 0:
        paths = [root / os.fsdecode(p) for p in result.stdout.split(b"\0") if p]
    else:
        paths = list(root.rglob("*"))
    files = []
    for path in paths:
        rel = path.relative_to(root)
        if any(part in EXCLUDED for part in rel.parts) or rel.parts[:2] == (".foundry", "state"):
            continue
        if rel.parts[:2] == (".foundry", "update-conflicts") or str(rel) == ".foundry/install.json":
            continue
        if path.is_file() or path.is_symlink():
            files.append(path)
    # Required verification inputs remain inputs even when a product's ignore
    # rules deliberately hide local Foundry config or its accepted spec.
    files.append(within(root, ".foundry/project.json"))
    _, state = active(root)
    if state and state.get("spec"):
        files.append(within(root, state["spec"]))
    return sorted(set(files))


def snapshot(root):
    # ponytail: whole-checkout hashes favor correctness; narrow inputs only after large-repo profiling.
    files = {}
    for path in source_files(root):
        rel = str(path.relative_to(root))
        if path.is_symlink():
            files[rel] = digest(("symlink:" + os.readlink(path)).encode())
        else:
            files[rel] = digest(path.read_bytes() + str(path.stat().st_mode & 0o777).encode())
    return digest(json.dumps(files, sort_keys=True).encode())


def checks(root):
    config = read_json(within(root, ".foundry/project.json"))
    items = config.get("checks")
    if not isinstance(items, list) or not items or not any(c.get("required", True) for c in items if isinstance(c, dict)):
        raise Error("Verification unavailable: configure at least one required behavior/build check.")
    names = set()
    for c in items:
        if not isinstance(c, dict) or not re.fullmatch(r"[a-zA-Z0-9_-]+", c.get("name", "")):
            raise Error("Every check needs a safe unique name")
        if c["name"] in names:
            raise Error("Duplicate check name")
        names.add(c["name"])
        command = c.get("command")
        if not isinstance(command, list) or not command or not all(isinstance(x, str) and x for x in command):
            raise Error(f"{c['name']}: command must be an argv list; shell strings are not accepted")
        cwd = within(root, c.get("cwd", "."))
        if not cwd.is_dir():
            raise Error(f"{c['name']}: cwd does not exist")
        timeout = c.get("timeout", 120)
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or timeout <= 0 or timeout > 3600:
            raise Error(f"{c['name']}: timeout must be between 0 and 3600 seconds")
        if not isinstance(c.get("required", True), bool):
            raise Error(f"{c['name']}: required must be boolean")
    return items


def redact(text):
    text = re.sub(r"\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|AKIA)[A-Za-z0-9_-]{16,}\b", "[REDACTED]", text)
    return re.sub(r"(?im)((?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*)[^\s,;]+", r"\1[REDACTED]", text)


def run_check(root, check, log):
    command = check["command"]
    started = now()
    proc = None
    interrupted = False
    try:
        proc = subprocess.Popen(command, cwd=within(root, check.get("cwd", ".")),
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
        output, _ = proc.communicate(timeout=check.get("timeout", 120))
        code, status = proc.returncode, "passed" if proc.returncode == 0 else "failed"
    except (subprocess.TimeoutExpired, KeyboardInterrupt) as exc:
        interrupted = isinstance(exc, KeyboardInterrupt)
        if proc:
            os.killpg(proc.pid, signal.SIGKILL)
            output, _ = proc.communicate()
        else:
            output = b""
        code, status = None, "interrupted" if interrupted else "timed_out"
    except OSError as exc:
        output, code, status = str(exc).encode(), None, "unavailable"
    log.write_text(redact(output.decode(errors="replace")))
    return {"name": check["name"], "command": command, "cwd": check.get("cwd", "."),
            "timeout": check.get("timeout", 120), "required": check.get("required", True),
            "started_at": started, "finished_at": now(), "exit_code": code, "status": status,
            "log": str(log.relative_to(root)), "log_sha256": digest(log.read_bytes())}, interrupted


def verify(root):
    with lock(root):
        path, state = require_active(root)
        items = checks(root)
        before = snapshot(root)
        state.update(status="verifying", updated_at=now())
        atomic_json(path, state)
        batch = path.parent / ("verification-" + str(uuid.uuid4()))
        batch.mkdir()
        receipts = []
        interrupted = False
        for check in items:
            receipt, interrupted = run_check(root, check, batch / (check["name"] + ".log"))
            receipt.update(run_id=state["run_id"], inputs_sha256=before)
            receipts.append(receipt)
            print(f"{check['name']}: {receipt['status']}", flush=True)
            if interrupted:
                break
        after = snapshot(root)
        passed = len(receipts) == len(items) and all(r["status"] == "passed" for r in receipts if r["required"]) and before == after
        evidence = {"run_id": state["run_id"], "created_at": now(), "inputs_before": before,
                    "inputs_after": after, "passed": passed, "checks": receipts}
        atomic_json(batch / "receipts.json", evidence)
        state.update(status="paused" if interrupted else "verified" if passed else "building",
                     verification=str((batch / "receipts.json").relative_to(root)), updated_at=now())
        atomic_json(path, state)
        if before != after:
            print("Inputs changed during verification. Run checks again on the settled source.")
        return 0 if passed else 130 if interrupted else 1


def complete(root):
    with lock(root):
        path, state = require_active(root)
        if state.get("status") != "verified" or not state.get("verification"):
            raise Error("Completion needs a fresh successful verify run.")
        evidence = read_json(within(root, state["verification"]))
        fingerprint = snapshot(root)
        if evidence.get("run_id") != state["run_id"] or not evidence.get("passed") or evidence.get("inputs_before") != fingerprint or evidence.get("inputs_after") != fingerprint:
            raise Error("Verification is stale or mismatched. Run verify again.")
        expected = checks(root)
        receipts = evidence.get("checks", [])
        if len(receipts) != len(expected):
            raise Error("Missing check receipts")
        for check, receipt in zip(expected, receipts):
            for key, default in [("name", None), ("command", None), ("cwd", "."), ("required", True), ("timeout", 120)]:
                if receipt.get(key) != check.get(key, default):
                    raise Error("Receipt does not match configured check")
            if receipt.get("run_id") != state["run_id"] or receipt.get("inputs_sha256") != fingerprint:
                raise Error("Receipt does not match current run and inputs")
            if check.get("required", True) and (receipt.get("status") != "passed" or receipt.get("exit_code") != 0):
                raise Error("Required check did not pass")
            log = within(root, receipt.get("log", ""))
            if not log.is_file() or digest(log.read_bytes()) != receipt.get("log_sha256"):
                raise Error("Receipt log missing or changed")
        out = root / "docs/built" / (state["slug"] + ".md")
        if out.exists():
            out = out.with_name(state["slug"] + "-" + state["run_id"][:8] + ".md")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(f"# {state['slug']}\n\nVerified locally at {now()}.\n\n"
                       f"Spec: `{state['spec']}`\nRun: `{state['run_id']}`\nInputs: `{fingerprint}`\n"
                       f"Receipts: `{state['verification']}`\n\n" +
                       "\n".join(f"- {r['name']}: {r['status']} (exit {r['exit_code']})" for r in receipts) +
                       "\n\nThis records configured local checks; owner acceptance and production qualification are separate.\n")
        state.update(status="completed", completed_at=now(), built_doc=str(out.relative_to(root)))
        atomic_json(path, state)
        (root / ".foundry/state/active.json").unlink()
        print(f"Completed {state['slug']}; evidence in {state['verification']}")
    return 0


def start(root, slug, spec):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", slug):
        raise Error("Use a lowercase feature slug with letters, numbers and hyphens")
    spec_path = within(root, spec)
    if not spec_path.is_file() or not spec_path.read_text().strip():
        raise Error("A nonempty local spec with acceptance criteria is required")
    with lock(root):
        _, current = active(root)
        if current:
            raise Error(f"Resume active run {current['slug']} ({current['status']}) before starting another.")
        run_id = None
        for _ in range(100):
            candidate = str(uuid.uuid4())
            if not (root / ".foundry/state/runs" / candidate).exists():
                run_id = candidate
                break
        if run_id is None:
            raise Error("Could not allocate a collision-free run ID")
        state = {"run_id": run_id, "slug": slug, "spec": str(spec_path.relative_to(root)),
                 "status": "building", "started_at": now(), "updated_at": now()}
        atomic_json(root / ".foundry/state/runs" / run_id / "state.json", state)
        atomic_json(root / ".foundry/state/active.json", {"run_id": run_id, "slug": slug})
        print(json.dumps(state, indent=2))


def resume_or_pause(root, pause):
    with lock(root):
        path, state = require_active(root)
        # Resume preserves run identity and invalidates earlier verification if work restarts.
        state.update(status="paused" if pause else "building", updated_at=now())
        if not pause:
            state.pop("verification", None)
        atomic_json(path, state)
        print(json.dumps(state, indent=2))


def install(source, target, update):
    source = Path(source).resolve()
    raw_target = Path(target).expanduser()
    if ".." in raw_target.parts:
        raise Error("Install target must not contain parent traversal")
    if not raw_target.is_absolute():
        raw_target = Path.cwd() / raw_target
    raw_target = Path(os.path.abspath(raw_target))
    reject_symlink_components(raw_target)
    target = raw_target
    if source == target or source.is_relative_to(target) or target.is_relative_to(source):
        raise Error("Install into a separate product folder, outside the framework checkout.")
    if target.exists() and not target.is_dir():
        raise Error("Install target is not a directory")
    with install_lock(target):
        # Everything through the conflict return is read-only preflight. A bad
        # AGENTS block, config, symlink or update conflict leaves target intact.
        manifest_path = within(target, ".foundry/install.json")
        previous = read_json(manifest_path) if manifest_path.exists() else {}
        if not isinstance(previous, dict) or not isinstance(previous.get("files", {}), dict):
            raise Error("Invalid .foundry/install.json manifest")
        old_modes = previous.get("modes", {})
        if not isinstance(old_modes, dict) or any(
            not isinstance(rel, str) or isinstance(mode, bool) or not isinstance(mode, int) or not 0 <= mode <= 0o777
            for rel, mode in old_modes.items()
        ):
            raise Error("Invalid managed file modes in .foundry/install.json")
        if previous and not update:
            raise Error("Already installed. Use --update to preview conflicts and update managed files.")
        incoming = {}
        for rel in MANAGED:
            p = within(source, rel)
            if not p.exists():
                raise Error(f"Incomplete framework source: missing {rel}")
            if p.is_symlink():
                raise Error("Managed source cannot contain symlinks")
            descendants = list(p.rglob("*")) if p.is_dir() else []
            if any(q.is_symlink() for q in descendants):
                raise Error("Managed source cannot contain symlinks")
            paths = [p] if p.is_file() else sorted(q for q in descendants if q.is_file() and not any(x in EXCLUDED for x in q.relative_to(p).parts))
            for file in paths:
                incoming[str(file.relative_to(source))] = file
        agents = within(target, "AGENTS.md")
        gitignore = within(target, ".gitignore")
        config = within(target, ".foundry/project.json")
        if agents.exists() and not agents.is_file():
            raise Error("AGENTS.md must be a regular file")
        agents_text = agents.read_text() if agents.exists() else "# Product\n"
        if AGENTS_START in agents_text or AGENTS_END in agents_text:
            if agents_text.count(AGENTS_START) != 1 or agents_text.count(AGENTS_END) != 1 or agents_text.index(AGENTS_START) > agents_text.index(AGENTS_END):
                raise Error("Malformed Foundry instructions block; reconcile AGENTS.md before installation")
        if gitignore.exists() and not gitignore.is_file():
            raise Error(".gitignore must be a regular file")
        gitignore_text = gitignore.read_text() if gitignore.exists() else ""
        if config.exists():
            configured = read_json(config)
            if not isinstance(configured, dict) or not isinstance(configured.get("checks", []), list):
                raise Error("Invalid .foundry/project.json")
        conflicts = []
        old = previous.get("files", {})
        for rel, src in incoming.items():
            dest = within(target, rel)
            if dest.exists():
                changed_content = (
                    not dest.is_file()
                    or dest.is_symlink()
                    or digest(dest.read_bytes()) not in {old.get(rel), digest(src.read_bytes())}
                )
                changed_mode = rel in old_modes and (dest.stat().st_mode & 0o777) != old_modes[rel]
                if changed_content or changed_mode:
                    conflicts.append(rel)
        # Removed managed files are deleted only when still byte-identical to our previous installation.
        removed = []
        for rel, expected in old.items():
            if rel not in incoming:
                dest = within(target, rel)
                if dest.exists():
                    changed_mode = rel in old_modes and (dest.stat().st_mode & 0o777) != old_modes[rel]
                    if not dest.is_file() or dest.is_symlink() or digest(dest.read_bytes()) != expected or changed_mode:
                        conflicts.append(rel)
                    else:
                        removed.append(dest)
        if conflicts:
            print(json.dumps({"updated": False, "conflicts": conflicts, "resolution": "Preserved all product files. Reconcile these paths manually, then retry."}, indent=2))
            return 1
        block = (f"{AGENTS_START}\n## Product Foundry\n\n"
                 "Read `docs/WORKFLOW.md` for product work and `docs/CATALOG.md` for reusable skills.\n"
                 "Use `python3 scripts/foundry.py` for run state and recorded checks. Resume active\n"
                 "work before a new feature; complete only with fresh passing required checks.\n"
                 "The owner’s product instructions and explicit authorizations govern scope.\n"
                 "Keep work delegated with separate write boundaries and honor interruptions.\n"
                 f"{AGENTS_END}")
        if AGENTS_START in agents_text:
            agents_text = (agents_text[:agents_text.index(AGENTS_START)] + block +
                           agents_text[agents_text.index(AGENTS_END) + len(AGENTS_END):])
        else:
            agents_text = agents_text.rstrip() + "\n\n" + block + "\n"
        ignore = [".foundry/state/", ".foundry/install.json", ".env", ".env.*", "!.env.example", "__pycache__/", "*.pyc"]
        gitignore_text = gitignore_text.rstrip() + "\n" + "\n".join(
            line for line in ignore if line not in gitignore_text.splitlines()
        ) + "\n"

        has_repository = install_repository_state(target)
        target.mkdir(parents=True, exist_ok=True)
        if not has_repository:
            result = subprocess.run(
                ["git", "init", "-b", "main"], cwd=target, capture_output=True, text=True
            )
            if result.returncode:
                raise Error(f"Could not initialize target Git repository: {result.stderr.strip()}")
        for rel, src in incoming.items():
            dest = within(target, rel)
            dest.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(prefix=".install-", dir=dest.parent)
            os.close(fd)
            try:
                shutil.copy2(src, tmp)
                os.replace(tmp, dest)
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)
        for dest in removed:
            dest.unlink()
        atomic_text(agents, agents_text)
        if not config.exists():
            atomic_json(config, {"name": target.name, "checks": []})
        atomic_text(gitignore, gitignore_text)
        atomic_json(manifest_path, {"version": VERSION, "installed_at": now(),
                                  "files": {rel: digest(file.read_bytes()) for rel, file in incoming.items()},
                                  "modes": {rel: file.stat().st_mode & 0o777 for rel, file in incoming.items()}})
        print(f"Installed Product Foundry {VERSION} in {target}")
        if not has_repository:
            print("Initialized a local Git repository on branch main (no remote added).")
        print("Configure required checks in .foundry/project.json; review native hooks via /hooks in Codex.")
        print("Existing Git hook settings are preserved. Opt in with: git config core.hooksPath .githooks")
    return 0


def enable_skill(root, name):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name):
        raise Error("Invalid skill name")
    source = root / "library/skills" / name
    if not (source / "SKILL.md").exists():
        raise Error("Unknown library skill")
    target = root / ".agents/skills" / name
    with lock(root):
        if target.exists():
            raise Error("Skill already exists; preserve it and reconcile manually")
        shutil.copytree(source, target)
    print(f"Enabled {name}. Codex discovers it natively.")


def doctor(root):
    problems = []
    try:
        checks(root)
    except Error as exc:
        problems.append(str(exc))
    for rel in ["AGENTS.md", "docs/WORKFLOW.md", ".codex/hooks.json", "scripts/hooks.py"]:
        if not (root / rel).exists():
            problems.append(f"Missing {rel}")
    try:
        _, state = active(root)
    except Error as exc:
        problems.append(str(exc)); state = None
    print(json.dumps({"version": VERSION, "project": str(root), "active": state,
                      "checks_configured": not problems, "problems": problems,
                      "hook_trust": "Review /hooks in Codex; file presence does not prove trust or execution.",
                      "codex_available": bool(shutil.which("codex"))}, indent=2))
    return 1 if problems else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=".", help="Project directory (also works from a subdirectory)")
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser("install"); p.add_argument("target"); p.add_argument("--update", action="store_true")
    p = sub.add_parser("start"); p.add_argument("slug"); p.add_argument("--spec", required=True)
    p = sub.add_parser("enable-skill"); p.add_argument("name")
    for name in ["status", "resume", "pause", "verify", "complete", "doctor"]:
        sub.add_parser(name)
    args = parser.parse_args()
    try:
        if args.action == "install":
            return install(Path(__file__).resolve().parent.parent, args.target, args.update)
        root = project_root(args.project)
        if args.action == "start": start(root, args.slug, args.spec)
        elif args.action in ["resume", "pause"]: resume_or_pause(root, args.action == "pause")
        elif args.action == "status": print(json.dumps(active(root)[1] or {"status": "idle"}, indent=2))
        elif args.action == "verify": return verify(root)
        elif args.action == "complete": return complete(root)
        elif args.action == "enable-skill": enable_skill(root, args.name)
        elif args.action == "doctor": return doctor(root)
        return 0
    except (Error, OSError, ValueError, TypeError) as exc:
        print(f"Foundry: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
