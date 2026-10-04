#!/usr/bin/env python3
"""Terminal commands for Foundry's existing local factory."""
from __future__ import annotations

import argparse
from pathlib import Path
import shlex
import sys

try:
    from . import factory, providers
except ImportError:
    import factory
    import providers


ROOT = Path(__file__).resolve().parent.parent
STAGE_LABELS = {
    "research": "Research",
    "scope": "Plan",
    "design": "Design",
    "build": "Build",
    "verify": "Test",
    "release": "Ship",
}
APPROVAL_PATHS = {"scope": "docs/specs/product.md", "design": "docs/product/design.md"}


class CLIError(ValueError):
    pass


def _ship_completed(project: dict) -> bool:
    release = project.get("stage_verification", {}).get("release", {})
    run_id = project.get("lifecycle_run_id")
    return (
        project["stage"] == "release"
        and project["status"] == "completed"
        and release.get("status") == "passed"
        and isinstance(run_id, str)
        and bool(run_id)
        and release.get("run_id") == run_id
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="./foundry",
        description="Create and guide local product work. Provider execution starts only with 'run'.",
        epilog="Optional browser view: ./foundry ui [--port PORT] [--no-browser].",
    )
    parser.add_argument("--products-dir", type=Path, help="Use this products directory instead of the sibling products/")
    commands = parser.add_subparsers(dest="command")

    new = commands.add_parser("new", help="Create a product workspace without starting provider work")
    new.add_argument("name")
    new.add_argument("--idea", required=True)
    new.add_argument("--provider")
    new.add_argument("--model")
    new.add_argument("--reasoning")

    commands.add_parser("list", help="List product workspaces")

    status = commands.add_parser("status", help="Show a product's current stage and history")
    status.add_argument("project")

    configure = commands.add_parser("configure", help="Update only the settings you specify")
    configure.add_argument("project")
    configure.add_argument("--provider")
    configure.add_argument("--model")
    configure.add_argument("--reasoning")
    consent = configure.add_mutually_exclusive_group()
    consent.add_argument("--confirm-subscription", action="store_true")
    consent.add_argument("--revoke-subscription", action="store_true")

    run = commands.add_parser("run", help="Run exactly one current factory stage")
    run.add_argument("project")

    review = commands.add_parser("review", help="Read a project document and its exact revision")
    review.add_argument("project")
    review.add_argument("--path", help="Project-relative docs/ path; defaults to a pending Plan or Design")

    approve = commands.add_parser("approve", help="Approve the exact Plan or Design revision you reviewed")
    approve.add_argument("project")
    approve.add_argument("--revision", required=True, help="SHA-256 revision printed by 'review'")

    stop = commands.add_parser("stop", help="Request cancellation of a running stage")
    stop.add_argument("project")

    providers_command = commands.add_parser("providers", help="List registered provider metadata, not live qualification")
    providers_command.add_argument("project", nargs="?")
    return parser


def _command(factory_instance, *arguments: str) -> str:
    return shlex.join([
        "./foundry",
        "--products-dir",
        str(factory_instance.products_dir),
        *arguments,
    ])


def _resolve(factory_instance, identifier: str) -> dict:
    projects = factory_instance.snapshot()["projects"]
    matches = [item for item in projects if identifier in {item["slug"], item["id"]}]
    if not matches:
        raise CLIError(
            f"Unknown project {identifier!r} in {factory_instance.products_dir}; use its exact slug or UUID."
        )
    if len(matches) != 1:
        raise CLIError(f"Project identifier {identifier!r} is ambiguous; use its UUID.")
    return matches[0]


def _state(project: dict) -> str:
    history = project.get("history", [])
    if (project["stage"] == "research" and project["status"] == "completed"
            and len(history) == 1 and history[0].get("note") == "Product workspace installed"):
        return "Research ready"
    if _ship_completed(project):
        return "Ship completed"
    stage = STAGE_LABELS.get(project["stage"], project["stage"])
    status = {
        "completed": "ready",
        "awaiting_approval": "awaiting approval",
        "running": "running",
        "failed": "failed",
        "interrupted": "interrupted",
    }.get(project["status"], project["status"])
    return f"{stage} {status}"


def _next_action(factory_instance, project: dict) -> str:
    slug = project["slug"]
    stage = project["stage"]
    status = project["status"]
    if status == "awaiting_approval" and stage in APPROVAL_PATHS:
        return _command(factory_instance, "review", slug)
    if status == "running":
        return _command(factory_instance, "stop", slug)
    if status in {"failed", "interrupted"}:
        return _command(factory_instance, "run", slug)
    if _ship_completed(project):
        return "No further factory stage; review the Ship summary or open the product folder."
    if project["adapter"] == "chatgpt":
        return "ChatGPT sign-in and execution remain browser-only; use ./foundry ui."
    try:
        adapter = providers.registry(project["path"])[project["adapter"]]
    except (KeyError, providers.Error):
        return _command(factory_instance, "providers", slug)
    if project["adapter"] == "codex" and not project["subscription_confirmed"]:
        return _command(factory_instance, "configure", slug, "--confirm-subscription")
    if "local" not in adapter["billing_modes"] and project["adapter"] not in {"codex", "chatgpt"}:
        return f"No supported Factory billing route is configured; inspect {_command(factory_instance, 'providers', slug)}."
    return _command(factory_instance, "run", slug)


def _clean(value):
    return providers.Redactor().clean(value)


def _summary(factory_instance, project: dict) -> None:
    print(f"Project: {project['name']} ({project['slug']})")
    print(f"Slug: {project['slug']}")
    print(f"Location: {project['path']}")
    print(f"Current state: {_state(project)}")
    stage = STAGE_LABELS.get(project["stage"], project["stage"])
    print(f"Stage: {stage}")
    current_failure = next(
        (event for event in reversed(project.get("history", []))
         if event.get("status") in {"failed", "interrupted"}),
        None,
    )
    if current_failure and project["status"] in {"failed", "interrupted"}:
        note = _clean(current_failure.get("note", "No failure details recorded"))
        print(f"Failure: {note}")
    history = project.get("history", [])
    print("History:")
    for event in history[-8:]:
        label = STAGE_LABELS.get(event.get("stage"), event.get("stage", ""))
        note = _clean(event.get("note", ""))
        line = f"  - {label}: {event.get('status', 'unknown')}"
        if note:
            line += f" — {note}"
        print(line)
    if len(history) > 8:
        print(f"  - … {len(history) - 8} earlier entries")
    print(f"Next: {_next_action(factory_instance, project)}")


def _providers(registry: dict) -> None:
    print("Registered provider metadata only; entries are not live-validated.")
    for name, adapter in registry.items():
        print(f"{name} ({adapter['kind']})")
        print(f"  Billing: {', '.join(adapter['billing_modes'])}")
        print(f"  Capabilities: {', '.join(adapter['capabilities'])}")
        if name == "chatgpt":
            print("  Experimental ChatGPT sign-in and execution are browser-only.")


def _review(factory_instance, project: dict, requested_path: str | None) -> None:
    pending_path = APPROVAL_PATHS.get(project["stage"]) if project["status"] == "awaiting_approval" else None
    path = requested_path or pending_path
    if path is None:
        raise CLIError("Choose --path docs/... to read a document; no Plan or Design is awaiting approval.")
    record = factory_instance.artifact_record(project["id"], path)
    print(f"Project: {project['slug']}")
    print(f"Document: {path}")
    print(f"Revision (SHA-256): {record['revision']}")
    print()
    sys.stdout.write(record["content"])
    if not record["content"].endswith("\n"):
        print()
    if path == pending_path and pending_path:
        print(f"\nApprove this exact revision with:\n{_command(factory_instance, 'approve', project['slug'], '--revision', record['revision'])}")


def _list(factory_instance) -> int:
    projects = factory_instance.snapshot()["projects"]
    if not projects:
        print(f"No projects in {factory_instance.products_dir}. Create one with ./foundry new NAME --idea TEXT.")
        return 0
    for project in projects:
        print(f"{project['slug']}\t{_state(project)}\t{project['path']}")
    return 0


def main(argv=None, *, root: Path | None = None, state_dir: Path | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    parser = _parser()
    args = parser.parse_args(arguments)
    if args.command is None:
        parser.print_help()
        return 0

    try:
        project_root = Path(root).resolve() if root is not None else ROOT
        if args.command == "providers" and args.project is None:
            _providers(providers.registry(project_root))
            return 0

        instance = factory.Factory(project_root, args.products_dir, state_dir=state_dir)
        if args.command == "new":
            project = instance.create(
                args.name,
                args.idea,
                adapter=args.provider if args.provider is not None else "codex",
                model=args.model or None,
                reasoning=args.reasoning or None,
            )
            _summary(instance, project)
            return 0
        if args.command == "list":
            return _list(instance)
        if args.command == "providers":
            project = _resolve(instance, args.project)
            _providers(providers.registry(project["path"]))
            return 0

        project = _resolve(instance, args.project)
        identifier = project["id"]
        if args.command == "status":
            _summary(instance, project)
            return 0
        if args.command == "configure":
            updates = {}
            if args.provider is not None:
                updates["adapter"] = args.provider
            if args.model is not None:
                updates["model"] = args.model or None
            if args.reasoning is not None:
                updates["reasoning"] = args.reasoning or None
            if args.confirm_subscription:
                updates["subscription_confirmed"] = True
            elif args.revoke_subscription:
                updates["subscription_confirmed"] = False
            project = instance.configure(identifier, **updates)
            _summary(instance, project)
            return 0
        if args.command == "run":
            if project["status"] == "awaiting_approval":
                _summary(instance, project)
                print("Run refused: review and approve the current Plan or Design revision first.", file=sys.stderr)
                return 2
            if project["status"] == "running":
                _summary(instance, project)
                print("Run refused: this project already has a running stage; use stop or status.", file=sys.stderr)
                return 2
            if project["adapter"] == "chatgpt":
                _summary(instance, project)
                print("Run refused: experimental ChatGPT sign-in and execution are browser-only; use ./foundry ui.", file=sys.stderr)
                return 2
            if project["adapter"] == "codex" and not project["subscription_confirmed"]:
                _summary(instance, project)
                print("Run refused: confirm the Codex subscription login before provider dispatch.", file=sys.stderr)
                return 2
            project = instance.run(identifier)
            _summary(instance, project)
            if project["status"] == "interrupted":
                return 130
            return 1 if project["status"] == "failed" else 0
        if args.command == "review":
            _review(instance, project, args.path)
            return 0
        if args.command == "approve":
            project = instance.approve(identifier, reviewed_revision=args.revision)
            _summary(instance, project)
            return 0
        if args.command == "stop":
            if project["status"] != "running":
                _summary(instance, project)
                print("No running stage; nothing to stop. Project state is unchanged.")
                return 0
            project = instance.cancel(identifier)
            _summary(instance, project)
            if project["status"] == "running":
                print("Cancellation requested; the live runner must confirm interruption.")
            elif project["status"] == "interrupted":
                print("No active provider process was confirmed stopped by this request.")
            return 0
        raise CLIError(f"Unknown command: {args.command}")
    except KeyboardInterrupt:
        print("Foundry: interrupted; inspect status before retrying.", file=sys.stderr)
        return 130
    except (factory.Error, providers.Error, CLIError, OSError, TypeError, ValueError, KeyError) as exc:
        print(f"Foundry: {_clean(str(exc))}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
