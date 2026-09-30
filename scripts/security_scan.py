#!/usr/bin/env python3
"""Scan exact Git index blobs for a small set of high-confidence secrets."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


PATTERNS = {
    "AWS access key": re.compile(rb"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b"),
    "OpenAI API key": re.compile(rb"\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}\b"),
    "Slack token": re.compile(rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    "Stripe live secret": re.compile(rb"\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b"),
    "Google API key": re.compile(rb"\bAIza[0-9A-Za-z_-]{35}\b"),
    "private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
}


def git(root: Path, *args: str, input_data: bytes | None = None) -> bytes:
    result = subprocess.run(
        ["git", *args], cwd=root, input=input_data, capture_output=True, check=False
    )
    if result.returncode:
        message = result.stderr.decode("utf-8", "replace").strip()
        raise RuntimeError(message or f"git {' '.join(args)} failed")
    return result.stdout


def index_paths(root: Path, whole_tracked: bool) -> list[str]:
    args = ("ls-files", "-z") if whole_tracked else (
        "diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"
    )
    raw = git(root, *args)
    return [item.decode("utf-8", "surrogateescape") for item in raw.split(b"\0") if item]


def index_blob(root: Path, path: str) -> bytes:
    encoded = path.encode("utf-8", "surrogateescape")
    # --path-format is not needed: subprocess arguments preserve whitespace, and
    # :<path> asks Git for the exact staged blob rather than the working tree.
    return git(root, "show", b":".decode() + encoded.decode("utf-8", "surrogateescape"))


def findings(root: Path, whole_tracked: bool = False) -> list[tuple[str, int, str]]:
    found: list[tuple[str, int, str]] = []
    for path in index_paths(root, whole_tracked):
        try:
            content = index_blob(root, path)
        except RuntimeError:
            continue
        if b"\0" in content:
            continue
        for line_number, line in enumerate(content.splitlines(), 1):
            for label, pattern in PATTERNS.items():
                if pattern.search(line):
                    found.append((path, line_number, label))
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--staged", action="store_true", help="scan staged blobs (default)")
    mode.add_argument("--whole-tracked", action="store_true", help="scan every tracked index blob")
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Git project root")
    args = parser.parse_args(argv)
    try:
        hits = findings(args.root.resolve(), whole_tracked=args.whole_tracked)
    except RuntimeError as exc:
        print(f"security scan error: {exc}", file=sys.stderr)
        return 2
    if not hits:
        print("security scan: no high-confidence secrets found")
        return 0
    print("security scan: blocked; possible secrets in exact index blobs", file=sys.stderr)
    for path, line, label in hits:
        safe_path = json.dumps(path, ensure_ascii=True)
        print(f"  {safe_path}:{line}: {label} [REDACTED]", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
