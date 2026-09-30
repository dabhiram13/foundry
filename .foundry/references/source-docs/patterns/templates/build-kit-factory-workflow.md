# Build Kit Factory Workflow

> Repeatable operating model for every new product cloned from Build Kit.

## Core Rule

One product = one cloned repo = one Linear project = one automation pack.

Do not run one automation across multiple products. Clone the kit, link that repo to that product's Linear space, and let its automations operate only inside that repo.

## Inputs Required Per New Product

- Product name
- One-sentence offer
- Customer type
- Revenue model: one-time, subscription, or both
- Core MVP features
- Brand direction
- External tools beyond the default stack

## Standard Build Flow

1. Clone Build Kit into a new repo for the product.
2. Fill `docs/project/` from the product brief.
3. Run setup for Supabase, Stripe, env, and required tools.
4. Define the MVP in Linear as small, bounded issues.
5. Create feature workspaces in `dev/active/{feature}/` only when work starts.
6. For each feature, generate `plan.md`, `tasks.md`, `decisions.md`, and any brief files needed.
7. Build one issue at a time in an isolated worktree.
8. Run quality gates: `npx tsc --noEmit`, `npx eslint .`, `npm run build`.
9. Open a draft PR with verification notes and risks.
10. Human reviews, merges, and moves the issue forward in Linear.

## Linear Issue Shape

Every issue must be small enough for one autonomous run to complete or make obvious progress.

Use this format:

- Problem
- Outcome
- Scope boundaries
- Acceptance criteria
- Dependencies
- Risks or open questions

Avoid giving the hourly loop large epics. Break them into execution-sized issues first.

## Hourly Delivery Loop

Each project gets one hourly automation that:

1. Reads Linear.
2. Selects the best unblocked issue.
3. Skips anything unclear, risky, or oversized.
4. Creates a worktree and branch.
5. Reads the repo rules and the issue context.
6. Implements one bounded slice.
7. Runs quality gates.
8. Opens or updates a draft PR.
9. Reports status back through the automation output.

## Selection Rules

Prioritize issues that are:

- Unblocked
- Explicitly scoped
- Safe to ship behind a PR
- Likely to fit in one run

Skip issues that are:

- Missing acceptance criteria
- Cross-cutting across many systems
- Likely to exceed 15 changed files
- Dependent on product decisions not yet made

## Scaling Rules

To handle 10 to 15 active issues without chaos:

- Max one new implementation issue per run
- Max three open autonomous branches/PRs at once
- Prefer finishing in-flight work before starting new work
- Reserve labels such as `autonomous`, `blocked`, `human-input`, `review-ready`

This keeps the loop stable while still clearing a larger backlog over time.

## Definition Of Done

An issue is complete only when:

- The code is implemented
- Quality gates pass
- The PR explains what changed
- Remaining risks are stated
- Merge is left to a human

## Standard Human Role

The human should only need to:

- Refine unclear issues
- Review draft PRs
- Merge approved work
- Resolve blocked product decisions

That is the factory model: the repo stays opinionated, the workflow stays the same, only the product brief and issue queue change.
