---
name: project-discovery
description: >
  Party-mode discovery producing all foundational project docs. 5 agents interrogate
  the user to create product overview, feature map, brand guidelines, user journeys,
  technical requirements. Use for "new project", "project discovery", "start project",
  "create project docs", "document project".
---

# Project Discovery

Party-mode facilitation with 5 agents. Produces `docs/project/` — the foundation every downstream workflow reads (design, landing page, auth, onboarding, billing, features).

**The idea is set. We implement, not validate.**

## BOOT

Read `agents/team-roster.csv` immediately. One read = all 5 personas. No individual files.

## When to Use

- Starting a new project from scratch
- `docs/project/` doesn't exist or is incomplete
- Before any design, landing page, auth, or feature work

## Pre-flight

Read these. Nothing else.

1. `core-beliefs.md` + `TECH_STACK.md`
2. `references/question-frameworks.md`
4. `references/feature-inventory.md`
5. `references/output-templates.md`

## Known Stack (never ask about these)

Supabase (DB + Auth + Storage + Realtime) | Vercel (hosting) | Stripe (payments) | Inngest (background jobs) | oRPC (backend) | Resend (email) | OpenTelemetry (observability) | Next.js + Tailwind v4 + shadcn/ui (frontend)

## Progressive Write Protocol

**Docs on disk = persistent state.** Long conversations compact. Answers not yet written are lost.

**Rule: write as you confirm, not as a batch.**

1. **Scaffold immediately.** After Phase 1's first question round, create ALL 7 doc files as skeletons (headers + empty sections from `output-templates.md`). This takes one Write pass per file.
2. **Fill sections as answers land.** When a user answer confirms a section (e.g., "It's a B2B SaaS for accountants" → fill `product-overview.md#Target User`), write it NOW. Don't wait for the phase to end.
3. **Minimum write cadence: every 2 question rounds.** Even if you're mid-discussion, flush confirmed answers to disk. If you've gone 2 rounds without writing, you're accumulating risk.
4. **Mark unconfirmed sections.** Use `<!-- TBD -->` after a section header to signal "skeleton, not yet filled." Remove the marker when filled.
5. **On resume:** read all docs → any section with content = confirmed. Any section with `<!-- TBD -->` or empty = still needed. Skip confirmed topics.

This means:
- Phase 1 scaffolds ALL files, fills product-overview sections as they're answered
- Phase 2 fills users-and-journeys, brand-guidelines, ux-patterns sections progressively
- Phase 3 fills feature-map, technical-requirements, external-tools progressively
- Phase 4 refines existing content (edits, not creates)

---

## Execution — Party Mode

4 phases, escalating focus. All agents loaded. Leads drive, others chime in.

**Rules:**
- Conversational, not checklist dumps
- Build on previous answers — never re-ask
- Short answers → dig deeper. Detailed answers → move on
- **Write confirmed answers to disk immediately** (see Progressive Write Protocol)

### Phase 1: Product & Competition
**Leads:** PM + Analyst

PM: What is this? Who uses it? **How does it work step by step?** (→ "How It Works" section)
PM: What are ALL the business rules? (→ "Business Rules" section — credits, limits, gating, boundaries)
Analyst: 2 competitors — features, flows, pricing. Steal or improve?

**First round:** Scaffold all 7 doc files (skeleton headers + `<!-- TBD -->` markers).
**As answers land:** Fill `product-overview.md` sections (including pricing, How It Works, Business Rules).
**CRITICAL:** "How It Works" must be written EARLY — it anchors every other doc. "Business Rules" must be EXHAUSTIVE — for every rule, answer "what happens at the boundary?"

### Phase 2: Experience & Brand
**Leads:** UX + Brand | **Validates:** PM

UX: First contact → core loop → navigation → **screen inventory** → **specific onboarding** → conversion funnels → error/state patterns
Brand: Personality, visual identity, voice, positioning
PM: Does this match our target user? Do the conversion funnels align with business model?

**As answers land:** Fill `users-and-journeys.md`, `brand-guidelines.md`, `ux-patterns.md` sections.
**CRITICAL — Screen Inventory:** UX must produce a concrete screen-by-screen description of every page in the app (what the user sees, controls available, key actions, empty states). Not just journey arrows — describe the actual screens. See `output-templates.md` for the format.
**CRITICAL — Onboarding:** Must be SPECIFIC: exact questions, exact options, and exactly what each answer changes in the product. A spec writer should be able to build the onboarding screen from this description alone.

### Phase 3: Scope & Architecture
**Leads:** PM + Architect | **Enriches:** Analyst

PM: Finalize feature inventory → prioritize MVP/V2/Future
Architect: Data model, real-time, background jobs, additional tools, locations, security
Analyst: "Competitor has X, we don't — intentional?"

**As answers land:** Fill `feature-map.md`, `technical-requirements.md`, `external-tools.md` sections.

### Phase 4: Cross-Examination
**All 5, adversarial. MANDATORY: at least 5 challenges.**

Each reviews ALL written docs (on disk, not memory). Challenges gaps, contradictions, missing items.
Every resolved challenge → edit the relevant doc immediately. Log in checklist.

**Output:** refined docs + finalized `user-intake-checklist.md`

## Outputs

All written to `docs/project/`. Use `references/output-templates.md` for structure.

| File | Owner | Content |
|------|-------|---------|
| `product-overview.md` | PM | Elevator pitch, problem, solution, target user, **How It Works** (system flow in English), business model, pricing, **Business Rules** (exhaustive) |
| `users-and-journeys.md` | PM + UX | Personas, signup→value, core loop, **specific onboarding** (exact questions/options/changes), funnels, **screen inventory** (what user sees on each screen) |
| `feature-map.md` | PM | Universal + Common + Project features, prioritized |
| `brand-guidelines.md` | Brand | Voice, tone, 3 colors, typography, vibe |
| `technical-requirements.md` | Architect | Data model, real-time, jobs, security, locations |
| `external-tools.md` | Architect | Tools beyond standard stack (skip if none) |
| `ux-patterns.md` | UX | Error handling, loading states, empty states, destructive actions |

## Post-flight

1. Verify all 7 docs exist in `docs/project/`
2. Every feature in `feature-map.md` has a user journey in `users-and-journeys.md`
3. Every conversion funnel has a trigger + friction + aha moment
4. `ux-patterns.md` has no blank fields — every pattern decided
5. Every external tool in `external-tools.md` referenced in `technical-requirements.md`
6. Update AGENTS.md project status → `Discovery: complete`
7. Print summary: feature count (MVP/V2/Future), tools count, personas count

## Status Tracking

On completion, update `AGENTS.md` with:

```markdown
## Project Status
- **Phase**: Pending
- **Discovery**: complete
- **Setup**: not-started
- **Active Feature**: none
```

If status section doesn't exist in AGENTS.md, add it after Boot Sequence.

## Next Step

After discovery: run `project-setup` skill. It reads `docs/project/` outputs (especially `external-tools.md` and `technical-requirements.md`) to generate the environment setup checklist.

## Resume

If `docs/project/` partially exists (progressive writes or previous session):
1. Read ALL existing doc files in `docs/project/`
2. Read `user-intake-checklist.md` → `## Answered` = done, `## Pending` = still needed
3. Scan docs for `<!-- TBD -->` markers → these sections need filling
4. Skip confirmed topics entirely — resume from first gap
5. Re-read `question-frameworks.md` only for unanswered areas
6. Continue the progressive write cadence from where you left off

## Completion Rule

- [ ] All 5 agents contributed
- [ ] At least 5 cross-agent challenges raised and resolved
- [ ] All 7 output docs written to `docs/project/`
- [ ] Feature inventory categorized and prioritized
- [ ] No `<!-- TBD -->` markers remaining
- [ ] AGENTS.md status updated

## Error Recovery

**Fixable:** Vague answers → agents dig deeper with follow-ups
**Blocking:** Can't answer "what is the product?" → pause, come back later

## References

- `references/question-frameworks.md` — questions per agent
- `references/output-templates.md` — all doc structures
- `references/feature-inventory.md` — universal/common feature checklist
