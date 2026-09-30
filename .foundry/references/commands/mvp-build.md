<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: mvp-build
description: Build the next feature from roadmap.json. Reads roadmap, syncs with docs/built/, finds next pending spec, hands it to the orchestrator. Run repeatedly — one feature per session.
---

# MVP Build

Lean command. Read roadmap, find next feature, hand spec to orchestrator.

---

## Step 1: Read roadmap

```
Read roadmap.json
```

If `roadmap.json` doesn't exist: "No roadmap found. Run `/mvp-spec` first."

## Step 2: Find next

Find the first feature in roadmap where status is `pending`.

If none found:

> **All MVP features are built!**
>
> | # | Feature | Status |
> |---|---------|--------|
> {list all features with done/skipped}
>
> **Next:** `/enhance` to improve features, or `/spec` to add new ones.

Stop.

## Step 3: Show status + proceed

Print a brief status line and immediately proceed — do NOT ask for confirmation, do NOT wait.

> **MVP Progress: {done}/{total} — Building #{order} {name}**

Then continue to the appropriate Step 3.x handler (or Step 4 for standard features).

## Step 3.5: Handle Checkpoint (if next item is a checkpoint)

If the next feature has `"type": "checkpoint"`, do NOT build. Instead, run an interactive review:

1. Start the dev server if not running (`cd webapp && npm run dev`)
2. Present the review:

> **Mid-Build Checkpoint — Foundation Review**
>
> The foundation is complete: design system, auth, onboarding, billing, legal.
> Before building idea-specific features, review the running app.
>
> **Check these:**
> - [ ] Landing page looks right (colors, spacing, copy, mobile)
> - [ ] Sign up + login flow works
> - [ ] Onboarding completes without issues
> - [ ] Billing/pricing page displays correctly
> - [ ] Overall feel — does it match your vision?
>
> **Open:** http://localhost:3000
>
> **Options:**
> 1. **Looks good** — mark checkpoint done, proceed to next feature
> 2. **Fix something** — tell me what's wrong, I'll fix it before continuing
> 3. **Rethink something** — if a structural decision feels wrong, now is the time

3. Wait for user. Handle their choice:
   - **"Looks good"**: Mark checkpoint `done` in roadmap.json, continue to Step 3 (next feature)
   - **"Fix something"**: Triage the fix as a bug-fix/small-enhancement, build it, then re-present the checkpoint
   - **"Rethink something"**: Discuss, potentially re-spec an upcoming feature, then mark checkpoint done

This checkpoint prevents cascading bad decisions into idea-specific features.

## Step 3.6: Handle Landing Design (if next item is type "landing-design")

If the next feature has `"type": "landing-design"`, do NOT use the standard orchestrator flow. Instead:

1. Update roadmap.json: set status to `in-progress`
2. Read the spec file (one-liner pointing to the command)
3. Execute `/landing-design` directly — it handles everything (4 design team agents compete, user picks)
4. After user picks the winner, update roadmap.json: set status to `done`
5. Continue to Step 3 (next feature)

## Step 3.7: Handle Logo (if next item is type "logo")

If the next feature has `"type": "logo"`, do NOT use the standard orchestrator flow. Instead:

1. Update roadmap.json: set status to `in-progress`
2. Execute `/logo` directly — it handles everything (6 SVG concepts, preview page)
3. After user picks and logo is installed, update roadmap.json: set status to `done`
4. Continue to Step 3 (next feature)

## Step 3.8: Handle Workflow (if next item is type "workflow")

If the next feature has `"type": "workflow"`, check its **size** to decide the approach:

### Small workflows (size S — e.g., Legal)
Simple, direct execution — no orchestration needed:
1. Update roadmap.json: set status to `in-progress`
2. Read the spec file — it describes what THIS SaaS needs for this step
3. Read the workflow path from `"workflow"` field in roadmap.json (e.g., `.foundry/workflows/legal/`)
4. Execute the workflow, passing the spec as context. The workflow knows HOW to build; the spec says WHAT to build.
5. **MANDATORY: After the workflow completes, run the testing pipeline** (api-tester → flow-tester → perf-tester, sequential) using the spec's User Flows. Workflows build the feature; the orchestrator owns testing. This is NON-NEGOTIABLE.
6. After testing passes, update roadmap.json: set status to `done`
7. Continue to Step 3 (next feature)

### Medium/Large workflows (size M/L — e.g., Auth, Billing, Onboarding)
These are complex features that need full orchestration. Treat them like standard features (Step 4), but also read the workflow for guidance:
1. Update roadmap.json: set status to `in-progress`
2. Read the spec file AND the workflow path from `"workflow"` field — the workflow provides implementation patterns and agent guidance; the spec says WHAT to build
3. Hand to the orchestrator as a step-prompt (same as Step 4). The orchestrator will triage, size, plan, and spawn agents as needed. Include the workflow content as additional context for the orchestrator.
4. **MANDATORY: The orchestrator MUST run the testing pipeline** (api-tester → flow-tester → perf-tester, sequential) after build agents complete. Workflows do NOT handle testing — the orchestrator does. If the workflow's own steps don't include testing, the orchestrator MUST add it. This is NON-NEGOTIABLE.
5. After the orchestrator finishes (including testing), continue to Step 5

## Step 3.9: Handle Settings (if next item is type "settings")

If the next feature has `"type": "settings"`, do NOT use the standard orchestrator flow. Instead:

1. Update roadmap.json: set status to `in-progress`
2. Execute `/settings` directly — it handles everything (adaptive discovery, full pipeline, 4 layout variants)
3. After user picks the winning layout, update roadmap.json: set status to `done`
4. Continue to Step 3 (next feature)

## Step 3.10: Handle Final Review (if next item is type "final-review")

If the next feature has `"type": "final-review"`, do NOT build. Run a comprehensive review:

1. Read ALL `docs/built/*.md` files — inventory of everything built
2. Read `docs/project/feature-map.md` — cross-reference MVP vs v2/future features
3. Read `docs/project/product-overview.md` — does the built product match the vision?
4. Read `docs/project/users-and-journeys.md` — are all user flows covered?
5. Scan recent git log for the build history

Present the review:

> **Final Review — MVP Complete**
>
> ### What's Built
> | Feature | Status | Notes |
> |---------|--------|-------|
> {list all built features from docs/built/}
>
> ### Completeness vs Feature Map
> - **MVP features built:** {count}/{total}
> - **Missing or incomplete:** {list any gaps}
>
> ### V2 / Future Features
> | Feature | Priority | Readiness | Notes |
> |---------|----------|-----------|-------|
> {list v2/future features from feature-map.md with assessment of how ready the codebase is}
>
> ### Technical Debt
> {any shortcuts, TODOs, or known issues from the build process}
>
> ### Recommendations
> 1. **Next to build:** {highest-impact v2 feature and why}
> 2. **Quick wins:** {low-effort improvements}
> 3. **Before launch:** {anything critical missing}
>
> ### How to Proceed
> - `/enhance <feature>` — improve an existing feature
> - `/spec <feature>` — spec and build a new v2 feature
> - `/security` + `/pentest` — security audit before launch
> - `/performance` — performance audit

Mark the final-review as `done` in roadmap.json.

## Step 4: Build

Update roadmap.json: set this feature's status to `in-progress`.

Read the spec file.

**Initialize progress tracking** for the dashboard:

```
mkdir -p dev/active/{feature-slug}/
```

Write `dev/active/{feature-slug}/progress.json`:
```json
{
  "feature": "{feature-slug}",
  "feature_name": "{feature name}",
  "started_at": "{ISO timestamp}",
  "current_agent": null,
  "steps": [
    {"agent": "planner", "status": "pending", "summary": ""},
    {"agent": "db-architect", "status": "pending", "summary": ""},
    {"agent": "backend", "status": "pending", "summary": ""},
    {"agent": "connector", "status": "pending", "summary": ""},
    {"agent": "designer", "status": "pending", "summary": ""},
    {"agent": "tester", "status": "pending", "summary": ""},
    {"agent": "quality-gate", "status": "pending", "summary": ""},
    {"agent": "complete", "status": "pending", "summary": ""}
  ]
}
```

Note: Steps are auto-updated by SubagentStart/SubagentStop hooks (sets status to `running`/`done`). Not all steps will be used — XS skips planner, some features skip db-architect. Mark unused steps as `"status": "skipped"`. For XS tasks where the orchestrator works directly (no agents), update progress.json manually at each stage.

Hand it to the orchestrator — this is a standard step-prompt. The orchestrator will:
1. Triage it (it's a step-prompt)
2. Size it
3. Plan it (spawn planner)
4. Build it (spawn agents)
5. Test it
6. Quality gate
7. Complete (writes docs/built/, updates db-schema.md)

**That's it. The orchestrator handles everything from here.**

## Step 5: After completion

When the orchestrator finishes (complete agent has run):

Update roadmap.json: set this feature's status to `done`.

> **Feature #{order} complete: {name}**
>
> **Progress: {done}/{total}**
> **Next: #{next_order} {next_name}**
>
> Start a new session and run `/mvp-build` to continue.
