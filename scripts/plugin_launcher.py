#!/usr/bin/env python3
"""Keep plugin dependencies and state in the host-provided writable data directory."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import venv

root = Path(__file__).resolve().parents[1]
value = os.environ.get('PLUGIN_DATA')
if not value:
    raise SystemExit('Foundry requires the plugin host to provide PLUGIN_DATA; use ./foundry for standalone use.')
data = Path(value).resolve()
data.mkdir(parents=True, exist_ok=True, mode=0o700)
python = data / '.venv/bin/python'
requirements = root / 'requirements.txt'
marker = data / '.requirements-sha256'
digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
if not python.exists():
    venv.create(data / '.venv', with_pip=True)
if not marker.exists() or marker.read_text() != digest:
    # First use installs the declared, pinned runtime. Never writes the installed plugin cache.
    subprocess.run([str(python), '-m', 'pip', 'install', '-r', str(requirements)],
                   check=True, stdout=sys.stderr, stderr=sys.stderr)
    marker.write_text(digest)
os.environ['PATH'] = str(python.parent) + os.pathsep + os.environ.get('PATH', '')
os.execv(str(python), [str(python), str(root / 'scripts/factory_mcp.py'),
                      '--data-dir', str(data), '--products-dir', str(data / 'products')])
