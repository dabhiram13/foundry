import tempfile
import unittest
from pathlib import Path

from scripts.check_catalog import MINIMUM_COUNTS, MINIMUM_SUPPORT_DOCS, REQUIRED_WORKFLOWS, validate


class CatalogValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.project = Path(self.temp.name)
        for name in REQUIRED_WORKFLOWS | {"custom-workflow"}:
            root = self.project / ".agents/skills" / f"foundry-{name}"
            (root / "agents").mkdir(parents=True)
            (root / "SKILL.md").write_text(f"# {name}\n")
            (root / "agents/openai.yaml").write_text(
                "policy:\n  allow_implicit_invocation: false\n"
            )
        for index in range(MINIMUM_COUNTS["library skills"]):
            root = self.project / "library/skills" / f"skill-{index}"
            root.mkdir(parents=True)
            (root / "SKILL.md").write_text("# skill\n")
        roles = self.project / ".codex/agents"
        roles.mkdir(parents=True)
        for index in range(MINIMUM_COUNTS["native roles"]):
            (roles / f"role-{index}.toml").write_text(f'name = "role-{index}"\n')
        support = self.project / ".foundry/references/source-docs"
        for name, count in MINIMUM_SUPPORT_DOCS.items():
            root = support / name
            root.mkdir(parents=True)
            for index in range(count):
                (root / f"doc-{index}.md").write_text("# support\n")

    def tearDown(self):
        self.temp.cleanup()

    def test_extension_is_allowed_and_broken_reference_fails(self):
        self.assertEqual(validate(self.project), [])

        extension = self.project / ".agents/skills/foundry-custom-workflow/SKILL.md"
        extension.write_text("Read `.foundry/philosophy/missing.md`.\n")
        self.assertTrue(
            any("missing framework reference" in error for error in validate(self.project))
        )


if __name__ == "__main__":
    unittest.main()
