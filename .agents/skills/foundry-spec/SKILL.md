---
name: foundry-spec
description: Turn a bounded product change into a specification that implementation and verification can both use.
---

# Spec

Read `docs/WORKFLOW.md`, existing product documents, the affected code, and any active spec. Preserve accepted decisions and scope.

Write `docs/specs/SLUG.md` with the intended outcome, current and desired behavior, affected boundaries, exclusions, dependencies, and acceptance criteria with stable IDs. Each criterion needs an observable check; include relevant negative cases. Identify data migration or release concerns when present.

For a bug, include a reproduction and expected behavior. For a small fix, the spec can also hold the short implementation plan. Record unresolved decisions honestly; an agent-written document is not owner approval. Start or associate an implementation run only within existing authorization.
