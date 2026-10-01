"""Guard executable role policy and known unsafe instruction regressions.

These checks reject specific policy violations; they do not establish that an
agent will follow prose or substitute for native role/journey evaluations.
"""

import re
import tomllib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REVIEW_ROLES = {
    "backend-evaluator", "design-evaluator", "quality-gate", "discovery-critic",
    "ux-critic", "spec-critic", "security-auditor", "critic",
}
LIFECYCLE_COMMAND = re.compile(
    r"\bscripts/(?:foundry|marketcraft)\.py\s+(?:start|pause|resume|verify|complete)\b"
)
FAILED_REPAIR_DOWNGRADE = re.compile(
    r"\brevert\b[^.\n]*\bdowngrade\s+to\s+WARN\b", re.IGNORECASE
)


def review_policy_violations(instructions):
    violations = []
    if LIFECYCLE_COMMAND.search(instructions):
        violations.append("reviewer lifecycle mutation")
    if FAILED_REPAIR_DOWNGRADE.search(instructions):
        violations.append("failed repair hides blocking finding")
    return violations


class InstructionContractTests(unittest.TestCase):
    def test_native_roles_inherit_model_and_reasoning(self):
        for path in sorted((ROOT / ".codex/agents").glob("*.toml")):
            with self.subTest(role=path.stem):
                role = tomllib.loads(path.read_text())
                overrides = {"model", "model_reasoning_effort"}.intersection(role)
                self.assertFalse(overrides, f"{path.stem} overrides {sorted(overrides)}")

    def test_review_roles_cannot_write(self):
        for name in sorted(REVIEW_ROLES):
            with self.subTest(role=name):
                role = tomllib.loads((ROOT / ".codex/agents" / f"{name}.toml").read_text())
                self.assertEqual(role["sandbox_mode"], "read-only")

    def test_review_instructions_preserve_findings_and_lifecycle_ownership(self):
        for name in sorted(REVIEW_ROLES):
            with self.subTest(role=name):
                role = tomllib.loads((ROOT / ".codex/agents" / f"{name}.toml").read_text())
                self.assertEqual(review_policy_violations(role["developer_instructions"]), [])

    def test_policy_check_detects_original_failed_repair_rules(self):
        for instruction in (
            "If tsc fails after your fix, revert and downgrade to WARN.",
            "If tsc or build fails after a fix, revert that fix and downgrade to WARN.",
        ):
            with self.subTest(instruction=instruction):
                self.assertIn("failed repair hides blocking finding", review_policy_violations(instruction))

    def test_policy_check_detects_both_runtime_entry_points(self):
        for entry in ("marketcraft", "foundry"):
            with self.subTest(entry=entry):
                self.assertIn(
                    "reviewer lifecycle mutation",
                    review_policy_violations(f"Run python3 scripts/{entry}.py verify after review."),
                )

    def test_read_only_status_and_preserved_fail_are_allowed(self):
        instructions = (
            "Inspect python3 scripts/marketcraft.py status. "
            "A failed repair leaves the original finding FAIL. "
            "Report optional improvements as WARN. The coordinator owns completion."
        )
        self.assertEqual(review_policy_violations(instructions), [])


if __name__ == "__main__":
    unittest.main()
