---
name: foundry-fix-issue
description: Reproduce and fix a product defect at its shared cause, with a meaningful regression check.
---

# Fix Issue

Read `docs/WORKFLOW.md`, the request, and any active run. Reproduce the failure in the relevant environment and trace callers of the failing path before editing. Separate product, test, environment, and unrelated pre-existing failures.

Use a bounded spec with expected behavior and the reproduction. Resume existing work or start an authorized implementation run. Fix the shared cause without broadening the feature or weakening valid tests.

Add or use the smallest check that would fail for the original defect. Exercise relevant sibling callers and boundaries. If a check cannot run, report the missing evidence. Review the integrated diff, settle notes, then use the runtime verification and completion commands. Preserve interruptions and existing owner decisions.
