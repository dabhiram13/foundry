# Team Workflows — Multi-Agent Coordination

> How the orchestrator uses Agent Teams for M/L features. The orchestrator IS the lead — no intermediate lead agents.

## When Teams Activate

| Size | Planning | Design | Testing |
|------|----------|--------|---------|
| XS / S | Skip planner — the orchestrator codes it | Solo designer or orchestrator | Solo tester |
| M/L | `planner` (one agent) | Design Team | Testing Team |
| User request | Whatever they ask for | Whatever they ask for | Whatever they ask for |

Teams are also activated when a user explicitly asks for one (e.g., "do a full test of X" spawns a testing team even for XS).

**One team at a time.** Sequence: `planner` → build with subagents → Design Team → Testing Team.

## Planning — one `planner`, not a team

The Planning Team (frontend-planner + backend-planner + ux-planner, orchestrator as lead) was retired on 2026-08-29. One `planner` at `effort: xhigh` writes the in-scope briefs and `plan.md` in a single pass — one writer, so contracts cannot drift and there is nothing to consolidate. The UX veto survives as a rule inside the planner: a flow that fails `visual` or `async-state` is rewritten, not annotated. Whether the planner runs at all is decided by the two mechanical size checks in the orchestrator playbook §4. See `.codex/agents/planner.toml`.

## Team 2: Design Team

**Replaces:** solo designer (for M/L features)
**Teammates:** 4x designer (existing agent, different creative directions)
**Lead:** orchestrator (crafts directions, presents variant routes to user)

### Flow

```
Orchestrator (IS the lead):
  -> TeamCreate("design-{feature}")
  -> Crafts 4 creative direction briefs (layout, typography, color, interaction style)
  -> Spawns 4 designer teammates (NO worktrees — same codebase, variant routes):
     - Designer 1: app/protected/{feature}-v1/ + features/{feature}/components/{feature}-v1.tsx
     - Designer 2: app/protected/{feature}-v2/ + features/{feature}/components/{feature}-v2.tsx
     - Designer 3: app/protected/{feature}-v3/ + features/{feature}/components/{feature}-v3.tsx
     - Designer 4: app/protected/{feature}-v4/ + features/{feature}/components/{feature}-v4.tsx
     Each gets: creative brief + spec + UX analysis + connector contract
  -> When all 4 complete, tell user to visit variant routes on running dev server
  -> User inspects each variant, picks winner
  -> Orchestrator renames winner to real route, deletes loser routes + components
  -> TeamDelete("design-{feature}")
  -> Optional: user requests iteration on winner
```

### Creative directions
The orchestrator decides what 4 directions make sense based on the feature context. No predefined templates. All 4 build the same feature with the same data — just visually different. All must be responsive (375/768/1280).

### Variant route pattern
Each designer writes to its own route and component files. No file conflicts because paths are namespaced with `-v1` through `-v4`. Single dev server, user just navigates between routes. After picking, winner is renamed to the real route and losers are deleted.

## Team 3: Testing Team

**Replaces:** solo tester (when both API + browser testing needed)
**Teammates:** api-tester, browser-tester
**Lead:** orchestrator (consolidates test report)

### Flow

```
Orchestrator (IS the lead):
  -> TeamCreate("testing-{feature}")
  -> Spawn 2 teammates in parallel:
     - api-tester: gets spec, procedure list, auth context
     - browser-tester: gets spec, user flows, pages, responsive breakpoints
  -> Teammates message each other directly:
     - broken endpoint → browser-tester skips that flow
     - broken UI flow → api-tester verifies the endpoint
  -> Orchestrator reads both completion signals
  -> Consolidates into test-report.md
  -> TeamDelete("testing-{feature}")
```

### Output
Unified test-report.md in dev/active/{feature}/ with:
- API test results
- Browser test results
- Screenshots as evidence
- Bug list with severity
- Regression spec files

## Orchestrator Protocol for Teams

### Spawning a team

```
1. TeamCreate(team_name)
2. Spawn teammates via Agent(team_name, name, subagent_type, prompt)
   - All teammates in parallel
   - Each gets focused context (spec + their domain's references)
3. Wait for all teammates to complete
4. Read completion signals, consolidate output
5. TeamDelete(team_name)
6. Continue to next phase
```

### Context passing
- Teammates get: spec.md path + their domain's patterns + relevant docs/built/ files
- Teammates share insights with each other via direct messaging
- Orchestrator consolidates — it reads analyses, not raw code

### Error handling
- If a teammate is blocked: orchestrator intervenes or redirects
- If team produces bad output: orchestrator can re-run with solo agent as fallback
- Max 2 retries per team, then ask user
