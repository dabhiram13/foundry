#!/usr/bin/env python3
"""Validate the native workflow catalog without modifying it."""

from __future__ import annotations

import argparse
import re
import tomllib
from pathlib import Path


REQUIRED_WORKFLOWS = frozenset(
    """analytics audit blog deep-interview deploy design discover domain drift emails
    enhance finish fix-issue fumadocs heal help landing-design logo monitor mvp-build
    mvp-spec payments pentest performance rate-limit resume schema-sync security sentry
    seo settings setup skeleton spec start trace verify""".split()
)
MINIMUM_COUNTS = {"library skills": 67, "native roles": 28}
MINIMUM_SUPPORT_DOCS = {"patterns": 64, "supabase": 10, "tools": 27}
TEXT_ROOTS = (".agents", ".codex", ".foundry", "library")
REFERENCE_ROOTS = (".agents/skills", ".codex/agents", ".foundry/workflows", "library/skills")

SOURCE_MACHINE_PATH = re.compile(
    r"/(?:Users|home)/[^/\s]+/(?:Desktop|Documents|Downloads|\.npm|\.cache)(?:/|\b)"
)
LEGACY_PATH = re.compile(r"(?:^|[\s`'\"])(?:\.claude/|~/.claude(?:/|\b)|\.foundry/hooks/)")
LEGACY_COMMAND = re.compile(r"\bclaude\s+-p\b")
LEGACY_NAMED_PATH = re.compile(r"dev/active/[^\s`]*\$[a-z][a-z0-9-]*")
EXECUTABLE_REFERENCE = re.compile(
    r"(?<![\w/])((?:scripts|\.foundry)/[A-Za-z0-9_./-]+\.(?:py|sh))"
)
OBSOLETE_DOCS = re.compile(r"(?<![\w./-])docs/(?:patterns|supabase|tools/catalog)/")
OWNED_PATH = re.compile(
    r"`((?:\.foundry/(?:references|philosophy)|\.agents/skills|\.codex/agents|library/skills)/[^`\n ]+)`"
)
EXPLICIT_POLICY = re.compile(
    r"(?m)^\s*allow_implicit_invocation:\s*false\s*(?:#.*)?$"
)


def text_files(root: Path):
    if not root.exists():
        return
    for path in root.rglob("*"):
        # The catalog checks shipped instructions, not machine-specific runtime evidence.
        if ".foundry" in path.parts and "state" in path.parts[path.parts.index(".foundry") + 1:]:
            continue
        if not path.is_file():
            continue
        try:
            yield path, path.read_text()
        except UnicodeDecodeError:
            continue


def validate(project: Path) -> list[str]:
    errors: list[str] = []
    skill_files = list((project / ".agents/skills").glob("foundry-*/SKILL.md"))
    library_skills = list((project / "library/skills").glob("*/SKILL.md"))
    role_files = list((project / ".codex/agents").glob("*.toml"))

    workflows = {path.parent.name.removeprefix("foundry-") for path in skill_files}
    missing = sorted(REQUIRED_WORKFLOWS - workflows)
    if missing:
        errors.append(f"missing required workflow skills: {', '.join(missing)}")

    for label, actual in (
        ("library skills", len(library_skills)),
        ("native roles", len(role_files)),
    ):
        minimum = MINIMUM_COUNTS[label]
        if actual < minimum:
            errors.append(f"expected at least {minimum} {label}, found {actual}")

    support_root = project / ".foundry/references/source-docs"
    for name, minimum in MINIMUM_SUPPORT_DOCS.items():
        actual = sum(path.is_file() for path in (support_root / name).rglob("*"))
        if actual < minimum:
            errors.append(f"expected at least {minimum} {name} support docs, found {actual}")

    for skill in skill_files:
        policy = skill.parent / "agents/openai.yaml"
        text = policy.read_text() if policy.exists() else ""
        if not EXPLICIT_POLICY.search(text):
            errors.append(f"missing explicit-invocation policy: {skill.parent.name}")

    for role in role_files:
        try:
            with role.open("rb") as stream:
                parsed = tomllib.load(stream)
        except (OSError, tomllib.TOMLDecodeError) as exc:
            errors.append(f"invalid role TOML {role.relative_to(project)}: {exc}")
            continue
        if "model" in parsed:
            errors.append(f"hardcoded model in {role.relative_to(project)}")

    nested_policies = list((project / "library/skills").rglob("AGENTS.md"))
    if nested_policies:
        errors.append(f"active nested AGENTS files: {len(nested_policies)}")

    for root_name in TEXT_ROOTS:
        for path, text in text_files(project / root_name):
            relative = path.relative_to(project)
            if SOURCE_MACHINE_PATH.search(text):
                errors.append(f"source-machine path in {relative}")

    for root_name in REFERENCE_ROOTS:
        for path, text in text_files(project / root_name):
            if LEGACY_PATH.search(text) or LEGACY_NAMED_PATH.search(text) or LEGACY_COMMAND.search(text):
                errors.append(f"obsolete harness reference in {path.relative_to(project)}")

    for root_name in (".agents/skills", ".codex/agents"):
        for path, text in text_files(project / root_name):
            relative = path.relative_to(project)
            for reference in EXECUTABLE_REFERENCE.findall(text):
                if not (project / reference).exists():
                    errors.append(f"missing referenced executable {reference} in {relative}")

    for root_name in REFERENCE_ROOTS:
        for path, text in text_files(project / root_name):
            relative = path.relative_to(project)
            if OBSOLETE_DOCS.search(text):
                errors.append(f"obsolete uninstalled docs path in {relative}")
            for raw in OWNED_PATH.findall(text):
                reference = raw.rstrip(".,;:")
                if any(char in reference for char in "{}*<>") or "..." in reference:
                    continue
                if not (project / reference).exists():
                    errors.append(f"missing framework reference {reference} in {relative}")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="project root (default: parent of scripts/)",
    )
    args = parser.parse_args()
    project = args.project.resolve()
    errors = validate(project)
    if errors:
        raise SystemExit("catalog check failed:\n- " + "\n- ".join(errors))

    workflows = len(list((project / ".agents/skills").glob("foundry-*/SKILL.md")))
    library = len(list((project / "library/skills").glob("*/SKILL.md")))
    roles = len(list((project / ".codex/agents").glob("*.toml")))
    print(f"catalog ok: {workflows} workflows, {library} library skills, {roles} roles")


if __name__ == "__main__":
    main()
