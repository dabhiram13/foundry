#!/usr/bin/env python3
"""A no-AI bounded-model adapter for the marketcraft-jsonl-v1 smoke protocol."""
import json
import sys


request = json.load(sys.stdin)
if request.get("protocol") != "marketcraft-jsonl-v1":
    raise SystemExit("unsupported protocol")
print(json.dumps({
    "type": "result",
    "status": "completed",
    "output": {"echo": request["prompt"]},
}))
