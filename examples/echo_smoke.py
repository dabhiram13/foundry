#!/usr/bin/env python3
"""Exercise the provider CLI with an isolated, no-AI bounded-model adapter."""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]


with tempfile.TemporaryDirectory(prefix="foundry-echo-products-") as directory:
    product = Path(directory)
    (product / ".foundry").mkdir()
    (product / "docs/work").mkdir(parents=True)
    (product / ".foundry/project.json").write_text(
        json.dumps({"name": "Foundry echo smoke", "checks": []}), encoding="utf-8",
    )
    config = json.loads((ROOT / "examples/echo-providers.json").read_text(encoding="utf-8"))
    config["adapters"][0]["command"] = [sys.executable, str(ROOT / "examples/echo_adapter.py")]
    (product / ".foundry/providers.json").write_text(json.dumps(config), encoding="utf-8")
    shutil.copyfile(ROOT / "examples/echo-request.json", product / "docs/work/echo-request.json")
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/marketcraft.py"),
            "--project",
            str(product),
            "provider",
            "run",
            "docs/work/echo-request.json",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    raise SystemExit(result.returncode)
