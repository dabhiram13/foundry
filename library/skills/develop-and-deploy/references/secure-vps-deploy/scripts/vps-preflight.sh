#!/usr/bin/env bash
set -euo pipefail

required=(ssh scp ssh-copy-id rsync)
missing=()

for cmd in "${required[@]}"; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf 'OK   %s -> %s\n' "$cmd" "$(command -v "$cmd")"
  else
    printf 'MISS %s\n' "$cmd"
    missing+=("$cmd")
  fi
done

if command -v docker >/dev/null 2>&1; then
  printf 'OK   docker -> %s\n' "$(command -v docker)"
else
  printf 'INFO docker not found locally (only needed if this VPS path is containerized and built here)\n'
fi

if [ "${#missing[@]}" -gt 0 ]; then
  printf '\nMissing required local tooling: %s\n' "${missing[*]}"
  exit 1
fi

printf '\nLocal VPS preflight passed.\n'
