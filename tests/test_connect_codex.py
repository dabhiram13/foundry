import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location(
    "connect_codex", SCRIPTS / "connect_codex.py"
)
assert SPEC and SPEC.loader
connect_codex = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(connect_codex)


class ConnectCodexTests(unittest.TestCase):
    def temporary_directory(self):
        return tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())

    def make_source(self, base: Path) -> Path:
        source = base / "framework source with spaces"
        skill = source / "skills/product-foundry"
        (skill / "agents").mkdir(parents=True)
        (skill / "SKILL.md").write_text(
            "# Product Foundry\n\nFramework: `{{FRAMEWORK_ROOT}}`\n",
            encoding="utf-8",
        )
        (skill / "agents/openai.yaml").write_text(
            "policy:\n  allow_implicit_invocation: false\n",
            encoding="utf-8",
        )
        return source

    def test_connect_renders_absolute_source_and_reconnects_identically(self):
        with self.temporary_directory() as directory:
            base = Path(directory)
            source = self.make_source(base)
            skills = base / "Codex skills with spaces"

            installed = connect_codex.connect(source, skills)
            first = (installed / "SKILL.md").read_text(encoding="utf-8")

            self.assertEqual(installed, skills / "product-foundry")
            self.assertIn(str(source.resolve()), first)
            self.assertNotIn("{{FRAMEWORK_ROOT}}", first)
            self.assertEqual(connect_codex.connect(source, skills), installed)
            self.assertEqual(
                (installed / "SKILL.md").read_text(encoding="utf-8"), first
            )

    def test_reconnect_preserves_edit_and_writes_nothing_on_conflict(self):
        with self.temporary_directory() as directory:
            base = Path(directory)
            source = self.make_source(base)
            skills = base / "skills"
            installed = connect_codex.connect(source, skills)
            edited = "owner customization\n"
            (installed / "SKILL.md").write_text(edited, encoding="utf-8")
            (installed / "agents/openai.yaml").unlink()

            with self.assertRaises(connect_codex.Error):
                connect_codex.connect(source, skills)

            self.assertEqual(
                (installed / "SKILL.md").read_text(encoding="utf-8"), edited
            )
            self.assertFalse((installed / "agents/openai.yaml").exists())

    def test_connect_rejects_symlink_destination(self):
        with self.temporary_directory() as directory:
            base = Path(directory)
            source = self.make_source(base)
            skills = base / "skills"
            outside = base / "outside"
            skills.mkdir()
            outside.mkdir()
            (skills / "product-foundry").symlink_to(outside, target_is_directory=True)

            with self.assertRaises(connect_codex.Error):
                connect_codex.connect(source, skills)

            self.assertEqual(list(outside.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
