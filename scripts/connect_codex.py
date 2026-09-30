#!/usr/bin/env python3
"""Make Product Foundry available as a conversational Codex skill."""
import argparse
import os
from pathlib import Path

from foundry import Error, atomic_text, reject_symlink_components


def connect(source, skills_directory):
    source = Path(source).resolve()
    destination = Path(os.path.abspath(Path(skills_directory).expanduser())) / 'product-foundry'
    reject_symlink_components(destination)
    payload = {}
    for name in ('SKILL.md', 'agents/openai.yaml'):
        template = source / 'skills/product-foundry' / name
        payload[name] = template.read_text().replace('{{FRAMEWORK_ROOT}}', str(source))
    for name, text in payload.items():
        target = destination / name
        reject_symlink_components(target)
        if target.exists() and (not target.is_file() or target.read_text() != text):
            raise Error(f'Existing skill preserved: {target}. Reconcile it before reconnecting.')
    for name, text in payload.items():
        atomic_text(destination / name, text)
    print('Product Foundry is connected to Codex.')
    print('In a new Codex chat, say: Use Product Foundry to start a product called NAME. My idea is ...')
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skills-directory', type=Path,
                        default=Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills')
    args = parser.parse_args()
    try:
        connect(Path(__file__).resolve().parents[1], args.skills_directory)
    except (Error, OSError, ValueError) as exc:
        parser.exit(1, f'Could not connect Product Foundry: {exc}\n')


if __name__ == '__main__':
    main()
