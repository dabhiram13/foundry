#!/usr/bin/env python3
"""Make Marketcraft and its Product Foundry compatibility entry available to Codex."""
import argparse
import os
from pathlib import Path

from foundry import Error, atomic_text, reject_symlink_components


def connect(source, skills_directory):
    source = Path(source).resolve()
    skills_directory = Path(os.path.abspath(Path(skills_directory).expanduser()))
    names = ['marketcraft', 'product-foundry'] if (source / 'skills/marketcraft').is_dir() else ['product-foundry']
    payload = {}
    for entry in names:
        destination = skills_directory / entry
        reject_symlink_components(destination)
        for name in ('SKILL.md', 'agents/openai.yaml'):
            template = source / 'skills' / entry / name
            payload[destination / name] = template.read_text().replace('{{FRAMEWORK_ROOT}}', str(source))
    for target, text in payload.items():
        reject_symlink_components(target)
        if target.exists() and (not target.is_file() or target.read_text() != text):
            raise Error(f'Existing skill preserved: {target}. Reconcile it before reconnecting.')
    for target, text in payload.items():
        atomic_text(target, text)
    print('Marketcraft is connected to Codex; Product Foundry remains a compatible name.')
    print('In a new Codex chat, say: Use Marketcraft to start a product called NAME. My idea is ...')
    return skills_directory / names[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skills-directory', type=Path,
                        default=Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills')
    args = parser.parse_args()
    try:
        connect(Path(__file__).resolve().parents[1], args.skills_directory)
    except (Error, OSError, ValueError) as exc:
        parser.exit(1, f'Could not connect Marketcraft: {exc}\n')


if __name__ == '__main__':
    main()
