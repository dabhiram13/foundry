<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: settings
description: Adaptive settings page. Reads project docs + built features to discover what sections THIS SaaS needs, writes spec, runs full pipeline (planning team, build agents, design team, testing team). Execute after auth + onboarding + billing.
---

# /settings — Adaptive Settings Page Builder

Build a world-class settings page tailored to THIS specific SaaS. You discover the sections, not the user.

Arguments: `$ARGUMENTS`
- No args = full discovery + build
- `--spec-only` = discover + write spec, stop before build
- `--sections` = just show discovered sections, stop for feedback

---

## Phase 1: Deep Context Load

Read ALL of these. You need the full product picture to discover settings sections.

**Product knowledge (read in parallel):**
1. `docs/project/product-overview.md` — pricing tiers, business rules, system flow
2. `docs/project/users-and-journeys.md` — personas, what they configure, preferences
3. `docs/project/feature-map.md` — all features (settings touches many)
4. `docs/project/brand-guidelines.md` — voice/tone for copy
5. `docs/project/ux-patterns.md` — form patterns, error/loading/empty defaults
6. `docs/project/technical-requirements.md` — data model, real-time, notifications

**What's built:**
7. `docs/INDEX.md` — feature inventory
8. ALL `docs/built/*.md` — every built feature (these are 60-line summaries, read them all)
9. `db-schema.md` — current tables, especially `profiles` + any user-scoped tables

If `docs/project/` is empty (no /discover yet), STOP: "Run /discover first — I need product context to build the right settings page."

---

## Phase 2: Section Discovery

Analyze everything you read. Discover which sections this SaaS needs.

### Universal Sections (always include)

**Profile** — name, avatar, email display (read-only from auth). Pull editable fields from `profiles` schema. If onboarding collected preferences (motivation, experience, interest, etc.), make them editable here.

**Appearance** — theme toggle (light/dark/system). If `preferred_language` or similar exists in profiles, include language selector.

**Danger Zone** — delete account. Scan ALL tables with `user_id` FK to determine cascade scope. Show the user what gets deleted. Ask for confirmation with typed confirmation.

### Conditional Sections (include if evidence exists)

| Section | Include if | What it contains |
|---------|-----------|-----------------|
| **Billing** | `webapp/features/stripe/` exists | Current plan badge, usage/limits if applicable, "Manage Billing" → Stripe portal, upgrade CTA if on free |
| **Notifications** | Feature map mentions notifications, emails, alerts, or digests | Per-channel toggles (email, push, in-app). Group by feature area. |
| **Security** | Feature map mentions MFA, sessions, API keys, or 2FA | Password change, active sessions, MFA setup, API key management |
| **Integrations** | `docs/project/external-tools.md` has user-facing integrations | Connected accounts, OAuth tokens, API key inputs |
| **Team/Org** | Schema has org/team/workspace tables with user membership | Role display, leave team, team-specific preferences |

### Product-Specific Sections (infer from context)

Scan `profiles` columns beyond the standard set (id, email, full_name, avatar_url, onboarding_completed, created_at, updated_at). Every extra column is a potential setting.

Scan `users-and-journeys.md` for mentions of "preferences", "defaults", "customize", "configure", "personalize". Each is a candidate setting.

Scan `feature-map.md` for features that have per-user configuration (notification frequency, default views, display options, favorite/pinned items).

Group related product-specific settings into coherent sections with clear labels.

---

## Phase 3: Present Discovered Sections

Present to the user:

> **Settings sections discovered for {product name}:**
>
> | # | Section | Fields | Source |
> |---|---------|--------|--------|
> | 1 | Profile | name, avatar, {extra fields} | profiles schema + onboarding |
> | 2 | {Conditional} | {fields} | {why included} |
> | 3 | {Product-specific} | {fields} | {where you found evidence} |
> | ... | ... | ... | ... |
> | N | Danger Zone | delete account | always |
>
> **Design approach:** 4 layout variants (tabs, vertical nav, stacked sections, sidebar+content).
> Each variant uses the same data contracts — only arrangement differs.
>
> **Options:**
> 1. **Looks good** — write spec + build
> 2. **Add section** — tell me what's missing
> 3. **Remove section** — tell me what to drop
> 4. **Reorder** — change section priority

If `--sections` flag: STOP here. Wait for user.

---

## Phase 4: Write Spec

Write `dev/active/settings/spec.md` using the discovered sections.

```markdown
# Settings

## System Flow Context
{Where settings sits in the product flow — accessible from sidebar/nav at all times.
References: auth (identity), onboarding (initial preferences), billing (plan management).}

## The Experience
### Managing my account — as {Primary Persona}
{Storyboard from persona's perspective. What brings them here? What do they expect?
Ground in product-overview.md How It Works flow.}

### Cancelling / Downgrading — as {Churning User}
{The critical path. Reason collection -> feedback -> confirmation -> Stripe portal.
This flow is a retention opportunity, not just a delete button.}

## What The User Sees

### Settings Page
- **Navigation**: {discovered sections as nav items — tabs, sidebar, or anchors}
- **Layout**: responsive — sidebar nav on desktop, dropdown/accordion on mobile
- **Each section**: card with clear heading, description, form fields, save button
- **Feedback**: inline success/error per section (not page-level toast)

{For each discovered section, detail:}

### {Section Name}
- **Fields**: {list with types — text input, toggle, select, file upload}
- **Save behavior**: {immediate toggle vs explicit save button}
- **Validation**: {rules from schema constraints}
- **Empty state**: {what shows if no data yet}

## Business Rules
{Extract from product-overview.md Business Rules — plan gating, limits, restrictions.}
- {Rule}: {decision} -> At boundary: {what user sees in settings}
{From billing: what changes are allowed per plan tier}
{From auth: what requires re-authentication (email change, password change, delete)}

## Edge Cases & Error Handling
- Avatar upload fails: show error inline, keep previous avatar
- Stripe portal unreachable: show error toast, suggest retry
- Delete account with active subscription: warn, require cancellation first
- Concurrent tab edits: last write wins (profiles has updated_at)
- {Product-specific edge cases from discovery}

## User Flows (test these)
1. **Update profile**: Settings -> Edit name -> Save -> See updated name in sidebar
2. **Change avatar**: Settings -> Upload -> Preview -> Save -> Reflected everywhere
3. **Toggle theme**: Settings -> Switch to dark -> Immediate, persisted
4. **Manage billing**: Settings -> Billing section -> "Manage" -> Stripe portal -> Return
5. **Delete account**: Settings -> Danger Zone -> Type confirmation -> Final warning -> Deleted
6. **Cancel subscription**: Settings -> Billing -> Cancel -> Reason dropdown -> Feedback -> Confirm
{Add product-specific flows for discovered sections}

## UI Notes
- Voice: {from brand-guidelines.md — settings copy should feel safe, in-control}
- Responsive: sidebar nav collapses to top tabs or accordion on mobile
- Loading: skeleton per section (not whole page)
- Save feedback: inline checkmark animation, not toast (feels more immediate)
- Danger Zone: visually separated (destructive border, red accents)
- Design team will produce 4 layout variants — user picks on dev server

## What This Step Does NOT Include
- Admin settings (separate /admin command)
- Team/workspace management (if exists, that's a separate feature)
- Onboarding re-do (settings edits individual fields, not the wizard)

## Dependencies
- Auth (docs/built/auth.md) — identity, claims, refresh
- Onboarding (docs/built/onboarding.md) — profile fields, preferences
{- Billing (.foundry/workflows/billing/) — if billing section discovered}
```

Save to `dev/active/settings/spec.md`.
Create workspace: `mkdir -p dev/active/settings/`

If `--spec-only` flag: present spec summary, STOP.

---

## Phase 5: Build (Full Pipeline)

This is an **M-size** feature. Full orchestrator flow.

### Pre-flight
```
git add -A && git commit -m "checkpoint: pre-settings"
```
Create `dev/active/settings/context.md` from template.

### Execution Order

**Group 1: `planner`** (one agent, `effort: xhigh`) — writes `backend-brief.md`, `frontend-brief.md`, `ux-brief.md` + `plan.md` in one pass. Point it at:
- Frontend: settings page architecture — RSC shell, client sections, form state, nuqs for the active section, caching strategy; each section independently loadable.
- Backend: which procedures (updateProfile, updatePreferences, deleteAccount…), migrations if any (notification_preferences jsonb? email_opt_in?), what needs re-auth.
- UX: section hierarchy, mobile patterns, save interaction model (per-field vs per-section), danger-zone visual weight, cancellation flow. A flow that fails `visual` / `async-state` is rewritten, not annotated.

Read plan.md once; send it back once if it is off.

**Group 2: db-architect** (if plan requires new columns/tables)
- Migration for any new settings columns discovered
- RLS: users can only read/update own settings

**Group 3: backend**
- oRPC procedures on `protectedProcedure`
- `updateProfile` — name, avatar, editable preference fields
- `updatePreferences` — product-specific settings (theme, language, notifications)
- `deleteAccount` — cascading delete with re-auth requirement
- If billing: `getSubscriptionStatus` for display (or reuse existing)
- `refreshClaims()` after any change that affects JWT (name, avatar, plan)

**Group 4: connector**
- RSC data fetching — server component loads profile + preferences + plan
- Client boundary at form level (each section = client component)
- Active section state via nuqs (URL-persisted, deep-linkable: `/settings?section=billing`)
- Pass initial data as props, no loading spinners on first render

**Group 5: Design Team** (4 designers, same codebase — NO worktrees)
Layout variants ONLY (same tokens, same data contract):
- **v1 Tabs**: horizontal tab bar, content below. Clean for 3-5 sections.
- **v2 Sidebar**: vertical nav left, content right. Scales to many sections.
- **v3 Stacked**: all sections visible, scroll between. Simple, no navigation state.
- **v4 Grouped Cards**: sections as cards in a grid/masonry. Visual, dashboard-like.

Each designer builds a variant route: `/protected/settings-v1` through `-v4`.
All variants MUST support light + dark mode. NEVER force dark-only.
All variants use identical design tokens from globals.css.

User visits `http://localhost:3000/protected/settings-v1` through `-v4`, picks winner.
Orchestrator renames winner to `/protected/settings`, deletes losers.

**Group 6: Testing Pipeline** (sequential — one at a time)
- `api-tester`: All settings procedures — update, delete, validation, auth requirements
- `flow-tester`: Full settings flows — edit profile, toggle theme, delete account, billing portal redirect
- `perf-tester`: Cache, data fetching, skeleton audit on settings pages

**Group 7: Complete** (3 agents in parallel)
- Write `docs/built/settings.md`
- Update `docs/INDEX.md`
- Update `db-schema.md` (if migrations ran)
- Archive: `mv dev/active/settings/ dev/archive/settings/`

---

## Cancellation Flow (Special Attention)

If billing exists, the cancellation/downgrade flow is a **retention opportunity**:

1. User clicks "Cancel Plan" in billing section
2. Show what they'll lose (feature list gated by current plan)
3. Reason dropdown: too expensive, not using it, switching to competitor, missing feature, other
4. Optional freetext: "Tell us more" (max 500 chars)
5. Save reason to `cancellation_feedback` (or profiles jsonb) + PostHog event
6. Final confirmation: "Are you sure? Your plan stays active until {period_end}"
7. Redirect to Stripe portal for actual cancellation
8. PostHog tracks: reason, freetext length, time-on-page, completed vs abandoned

This data is gold. Every template user gets this for free.

---

## Integration with mvp-spec.md

When referenced from `mvp-spec.md`, the step file says:

```markdown
# Settings

## Execution
This step executes via `/settings` command (not the standard orchestrator flow).

## What It Does
Reads all project docs + built features, discovers which settings sections this SaaS needs,
presents sections for approval, then builds the full settings page with design variants.

## Dependencies
- Auth (step 3) — user identity
- Onboarding (step 4) — profile fields and preferences
- Billing (step 5) — if billing exists, settings includes plan management

## What This Step Does NOT Include
- Admin dashboard (separate step)
- Team/workspace settings (separate feature if needed)
```
