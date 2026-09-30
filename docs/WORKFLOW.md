# Workflow

The owner describes the product or change normally. Codex coordinates the work,
selects relevant skills, and handles paths and check configuration. The entry
skill handles installation. Existing products follow their own instructions.

These stages guide Codex; the Python runtime enforces run state and fresh check
results. It does not judge a specification, enforce every stage, or deploy an app.
Use only stages needed for the request. Research, planning, installation, and
review requests do not authorize implementation or deployment by themselves.

## Product development

1. **Understand.** Inspect the repository and any active run. Establish the user,
   outcome, constraints, and unresolved decisions. Research uncertainties that
   change a decision; distinguish evidence from assumptions. Reuse the owner's
   existing product documents and stack.
2. **Scope.** Write accepted work in `docs/specs/`: observable behavior, exclusions,
   relevant failure cases, dependencies, and acceptance checks with stable IDs.
   For a new product, choose a small complete user journey. Record actual owner
   decisions; never label an agent proposal approved. Continue within existing
   authorization and ask only about consequential unresolved decisions.
3. **Plan and prepare.** For authorized implementation, use
   `python3 scripts/foundry.py start SLUG --spec PATH`, or resume the active work.
   Identify interfaces, data changes, and the execution environment. Use
   `dev/active/SLUG/plan.md` when dependencies or several workers need it; a small
   fix can keep its plan in the spec. Configure real behavior tests and build
   commands in `.foundry/project.json`, preserving existing checks. Missing tools,
   services, or credentials remain blockers, never passing stubs.
4. **Build.** Implement a complete slice through the necessary layers, then check
   its behavior. For a bug, reproduce it and trace the shared cause before editing.
   Read only relevant skills and guides. Follow the actual application stack;
   optional auth, billing, or SQL guides do not mandate those components.
5. **Review and exercise.** Compare the integrated change with every acceptance
   criterion. Obtain independent review for substantial changes when delegation
   is available. For UI changes, exercise the running app, relevant console/network
   failures, keyboard access, and error states. Exercise API, persistence,
   migration, permission, and retry boundaries when in scope. Mark unavailable
   checks unverified.
6. **Verify and record.** Run `python3 scripts/foundry.py verify` after integration.
   Resolve required failures within scope; rerun after relevant changes. Record
   criterion, observed result, and evidence in the existing spec or work notes
   before the final verification. Completion needs addressed acceptance criteria
   and fresh required checks. Only `python3 scripts/foundry.py complete` records
   runtime completion in `docs/built/`. Passing commands alone do not establish
   owner acceptance or a working production integration.
7. **Release when requested.** Prepare the target, configuration, migration and
   recovery plan appropriate to the change. Preserve existing publishing authority;
   ask only for authority still missing, after the result is ready to review.
   Verify the deployed revision and a meaningful health/user journey afterward.
   Local completion, deployment, and owner acceptance are distinct facts.
8. **Learn and maintain.** Update owning documents for decisions that changed.
   Turn demonstrated recurring failures into regression checks or focused workflow
   corrections. Monitoring and recurring maintenance require a request; completion
   alone does not authorize background jobs.

## Coordination

The parent Codex session is the coordinator (called the "orchestrator" in some
specialist instructions). There is no separate Foundry agent service. The parent
owns integration, lifecycle commands, and the acceptance-to-evidence comparison.

- Handle a small bounded change directly. Use `planner` when interfaces, data,
  user flows, or task dependencies need a shared plan.
- Choose applicable builders such as `backend`, `designer`, or `db-architect`.
  Specialist names do not require their example stacks. For an unrelated stack,
  use a suitable native agent with a precise task instead of forcing a role.
- Use `quality-gate` for independent review, `api-tester` or `flow-tester` for
  relevant behavior, and `security-auditor` for relevant security boundaries.
  Select by scope; do not spawn every role.
- Give delegates the spec, necessary context, owned files, dependencies, allowed
  actions, and required evidence. Parallelize independent work with one writer per
  file/interface. Serialize shared schema and contract changes.
- Require changed files, checks, findings, and blockers in handoffs. Inspect actual
  artifacts, wait for workers, and verify integrated files. A successful agent turn
  or review verdict cannot complete a Foundry run.
- Inherit the owner's model by default and preserve configured reasoning settings.
  If delegation is unavailable, perform the scoped work sequentially and disclose
  that independent review did not run.

## State and recovery

Use `status` to inspect work, `pause` to pause, and `resume` to continue.
Resume keeps the run identity and invalidates prior verification. Reconcile partial
edits and inspect failed logs before retrying. Repeating work without a changed
hypothesis is not new evidence. Report persistent blockers and missing decisions
or dependencies rather than inventing completion.

Keep context in the owner's documents or `docs/project/`, specs in `docs/specs/`,
and work notes in `dev/active/`. The runtime alone maintains `.foundry/state/`;
skills and agents must not handcraft receipts or state.

Follow the owner's existing authorization. Ask before spending, connecting accounts,
publishing, sending messages, or changing an external system unless already authorized.
Honor interruptions; hooks must never force work to continue.
