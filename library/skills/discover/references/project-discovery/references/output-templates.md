# Output Templates

All docs → `docs/project/`. Copy structure, fill content.

---

## product-overview.md

```markdown
# {Product Name}

## One-Liner
{What it is + who it's for}

## Problem
{Specific problem}

## Solution
{How this solves it}

## Target User
- **Primary**: {role, behavior, context}
- **Secondary**: {if applicable}

## How It Works
{Plain English, numbered steps. Describe the SYSTEM FLOW — what happens from the user's
first action to the core value delivery. No code, no technical terms. A non-technical PM
should be able to read this and understand exactly what the product does.

Write in second person ("You do X"). Cover these beats:
1. What the user does first (setup / input / configuration)
2. What the system does in response (fetches / processes / enriches)
3. What the user sees as a result (the value — a dashboard, feed, report, output)
4. The core action the user takes (the thing they came for)
5. What happens after (output, export, next loop)
6. How monetization connects (what costs money, what's free)

Aim for 5-8 steps. Each step = one sentence. This section is the BRIDGE between
"what features exist" and "what specs should describe." Every spec writer reads
this first to understand the full product flow.}

## Business Model
{Freemium/subscription/etc + tier summary}

## Pricing

### Strategy
{Freemium / trial / paid only}

### Plans
| | Free | Pro | {Tier 3} |
|---|------|-----|----------|
| Price | $0 | ${x}/mo | ${y}/mo |
| {Limit} | {val} | {val} | {val} |
| {Feature} | {yes/no} | {yes/no} | {yes/no} |

### Upgrade Trigger
{What pushes free → paid}

## Business Rules
{Exhaustive rules for EVERY system that has rules. These are product decisions, not technical
ones. Spec writers and build agents need these to implement correctly without guessing.}

### {System name — e.g. Credit System, Usage Limits, Content Moderation, Team Permissions}
- {Rule}: {decision}
- {Rule}: {decision}
- {Rule}: {decision}
{List every rule. Common systems that need rules:
- Credit/token/usage systems: cost per action, rollover, purchase extra, what happens at zero
- Plan gating: what's free vs paid, per-tier limits, what happens at boundary
- Content/data limits: max items, storage caps, rate limits visible to user
- Team/sharing: who can invite, permission levels, what owner vs member can do
- Time-based rules: trial duration, grace period, data retention after downgrade}

### {System 2}
{same}

{COMPLETENESS CHECK: For each rule, ask "what happens at the boundary?" If the answer is
unclear, the rule isn't finished. Every boundary needs a clear answer:
- "What does the user SEE when they hit the limit?"
- "Can they still access existing data, or is it locked?"
- "Is the wall hard (blocked) or soft (warning + still allowed)?"}

## Success Metrics
- **North Star**: {metric}
- **Month 1**: {target}
```

---

## users-and-journeys.md

```markdown
# Users & Journeys

## Personas

### {Name} — {Role}
- **Behavior**: {daily activities}
- **Pain Point**: {frustration}
- **Goal**: {success looks like}
- **App Role**: {user type in system}
- **Tech Comfort**: {low/medium/high}

### {Name} — {Role}
{same}

---

## Journeys

### Signup → First Value
Landing → Sign up → Verify → Onboard → {first action}

### Core Loop
Login → {primary} → {secondary} → {outcome}

### {Secondary Flow}
{steps}

---

## Onboarding Flow

### Need onboarding?
{yes/no + why}

### Steps
{Be SPECIFIC. Not "ask about preferences" but the exact question, exact options, and exactly
what changes in the product. A spec writer should be able to build this screen from this description alone.}

| # | Question | Type | Options | What it changes | Required? |
|---|----------|------|---------|-----------------|-----------|
| 1 | {exact question text} | {single-select cards / tag-input / text-input / avatar-upload} | {exact options if select, or input constraints} | {exact product change — what the app does differently because of this answer} | {Required / Skippable} |
| 2 | {exact question text} | {type} | {options} | {product change} | {Required / Skippable} |

{RULE: If the answer doesn't change the product experience, cut the question.
"What's your role?" is only valid if the dashboard changes per role.
"How did you hear about us?" is analytics-only — don't ask during onboarding.}

### What the user sees during onboarding
{How do we show value during the flow? Not just questions — trust-building moments.}
- {Value preview after a key step — show what they'll get}
- {Progress indicator: Step N of M}
- {Personalized welcome or confirmation that references their input}

### Rules applied
- Clicks over inputs (single-select cards, not text fields) — minimize typing
- Every question must change the product experience — if it's analytics-only, cut it
- Required: {which steps}. Skippable: {which steps}
- Show value during flow: {how — welcome message, preview, progress}

### After onboarding
{What happens immediately after the last step? Where does the user land? What do they see?}
- {Where they're redirected — which screen}
- {What that screen shows given they just signed up — likely an empty state or first-run state}
- {Any follow-up action the system takes — background job triggered, email sent, etc.}

### Database
- Table: `profiles` (extend with preference columns)
- Flag: `onboarding_completed` boolean
- Gate: check at sign-in time, NOT middleware

---

## Conversion Funnels

### Funnel 1: Visitor → Signup
- **Trigger**: {what makes them sign up — pain point, CTA, social proof}
- **Friction**: {what stops them — trust, effort, unclear value}
- **Aha moment**: {what they see/feel that confirms "this is for me"}
- **Drop-off recovery**: {email capture, retargeting, nothing}

### Funnel 2: Signup → First Value
- **Trigger**: {what pushes them past onboarding into real usage}
- **Friction**: {setup steps, data entry, unclear next action}
- **Aha moment**: {first meaningful outcome — "this actually works"}
- **Time to value**: {target seconds/minutes from signup to aha}

### Funnel 3: Free → Paid
- **Trigger**: {limit hit, feature locked, team need, volume growth}
- **Friction**: {price objection, unclear ROI, switching cost}
- **Nudge type**: {hard wall, soft limit, feature teaser, usage meter}
- **Recovery**: {email drip, in-app reminder, nothing}

### Viral / Referral Loop
{Does the product have one? Where in the journey does sharing/inviting happen? What's the incentive?}

---

## Screen Inventory

{NOT just a table of route names. Describe what the user SEES on each screen in plain English.
This is what designers and spec writers use to understand the app without a prototype.}

### {Screen name}
- **What it shows**: {Plain description of the main content — cards, tables, forms, charts, feed items. Be specific about what info each item displays.}
- **Top controls**: {Filters, search, sort, tabs, action buttons — what the user can do before interacting with content}
- **Key actions**: {What the user can DO on this screen — click, favorite, create, edit, delete, generate, export}
- **Empty state**: {What users see when there's no data. Distinguish first-use empty vs filtered-empty vs deleted-all.}
- **Who uses it**: {persona names}
- **Auth**: {public / authenticated / specific role}

### {Screen name}
{same structure — one entry per screen in the app}

### {Screen name}
{same structure}

{COMPLETENESS CHECK: Every feature in feature-map.md must map to at least one screen here.
If a feature has no screen, it's either a background process (note it) or a gap.}

| Screen | Journey | Auth | Key Actions |
|--------|---------|------|-------------|
| {name} | {which journey it belongs to} | {public/auth/role} | {primary actions available} |
```

---

## feature-map.md

```markdown
# Feature Map

## MVP
| # | Feature | Persona | Notes |
|---|---------|---------|-------|

## V2
| # | Feature | Persona | Notes |
|---|---------|---------|-------|

## Future
| # | Feature | Notes |
|---|---------|-------|

## Excluded
| Feature | Why Not |
|---------|---------|
```

---

## brand-guidelines.md

```markdown
# Brand Guidelines

## Personality
- **Adjectives**: {3 words}
- **Voice**: {formal/casual} + {technical/accessible}
- **Inspired By**: {2-3 brands}

## Colors
| Role | Name | Value | Usage |
|------|------|-------|-------|
| Primary | | {oklch} | CTAs, key actions |
| Secondary | | {oklch} | Supporting |
| Accent | | {oklch} | Highlights |

## Typography
- **Headings**: {font}
- **Body**: {font}
- **Mono**: {font}

## Vibe
{One paragraph — how the app should feel}

## Voice Rules
- **Always**: {words to use}
- **Never**: {words to avoid}
- **Errors**: {tone}
- **Success**: {tone}

## Dark Mode
{Preference + behavior}
```

---

## technical-requirements.md

```markdown
# Technical Requirements

## Data Model
| Entity | Description | Key Fields |
|--------|-------------|------------|

### Relationships
{entity} → has many → {entity}

## Real-time
| Feature | Method | Frequency |
|---------|--------|-----------|

## Background Jobs (Inngest)
| Job | Trigger | Retry | Description |
|-----|---------|-------|-------------|

## Security
- **Roles**: {list}
- **Multi-tenancy**: {yes/no + approach}
- **RLS**: {per-user / per-org / hybrid}
- **Audit**: {actions logged}

## Locations
- **Company**: {country}
- **Database**: {Supabase region}
- **Deployment**: {Vercel region}
```

---

## external-tools.md

```markdown
# External Tools

Beyond standard stack.

| Tool | Purpose | Cost | Integration |
|------|---------|------|-------------|

Each needs `docs/tools/{tool}/README.md` via doc-creator skill.
```

---

## ux-patterns.md

```markdown
# UX Patterns

Cross-cutting interaction patterns. Every screen in the app follows these defaults unless explicitly overridden.

## Error Philosophy
- **Tone**: {friendly-helpful / minimal / technical}
- **User-facing language**: {example: "Something went wrong. We're looking into it." vs "Error 500"}

## Form Validation
- **Default approach**: {inline-on-blur / inline-as-you-type / on-submit}
- **Error display**: {below field / tooltip / summary at top}
- **Success feedback**: {checkmark on field / toast / none}

## API & Server Errors
- **"Our fault" (5xx)**: {message + retry button / auto-retry with countdown / redirect to status page}
- **"Your fault" (4xx)**: {inline message explaining what to fix / toast}
- **Show technical details?**: {never / expandable "details" / only in dev}

## Network & Offline
- **Offline behavior**: {banner + disable actions / graceful degradation / full offline support}
- **Reconnection**: {auto-retry queued actions / manual refresh / silent reconnect}

## Loading States
- **Default approach**: {skeletons / spinners / optimistic updates}
- **Skeleton screens**: {which screens — data tables, dashboards, feeds}
- **Optimistic updates**: {which actions — toggle, like, create, delete}
- **Progress indicators**: {which actions — file upload, export, long processes}

## Empty States
- **First-use empty**: {illustration + CTA + benefit copy / text-only CTA}
- **Filtered-empty**: {"No results match your filters" + clear filters button}
- **Deleted-all empty**: {same as first-use or different?}
- **Visual style**: {illustrated / icon-only / text-only}

## Destructive Actions
- **Standard delete**: {confirmation dialog / undo toast / inline confirm}
- **Critical delete** (account, workspace, data): {type-to-confirm dialog}
- **Soft delete?**: {yes with restore period / no, hard delete}
- **Undo pattern**: {toast with undo button for X seconds / no undo}
```
