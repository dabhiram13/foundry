# Question Frameworks

Per-agent questions. Conversational starters — dig deeper based on answers.

---

## PM — Product Manager

**Vision**: What is this in one sentence? What problem does it solve? Why now? What if users do nothing?

**Target User**: Who is the primary user? (role/behavior) B2B or B2C? Who pays vs uses? Secondary user type?

**How It Works** (CRITICAL — produce this early, it anchors everything):
Walk me through the product step by step, in plain English. Start from the user's first action, end at the core value delivery. Cover: what the user does, what the system does in response, what the user sees as a result, and how monetization connects. Aim for 5-8 numbered steps. This becomes the "How It Works" section in product-overview.md — every spec writer reads it first.

**Business Model**: How does this make money? Freemium/subscription/per-use? Tiers and limits? Upgrade trigger?

**Business Rules** (CRITICAL — nail EVERY rule, no ambiguity):
For every system that has rules (credits, quotas, limits, permissions, gating), document every rule exhaustively. Ask these for each system:
- What costs something vs what's free?
- Do allocations reset or roll over? On what cycle?
- Can users buy more without upgrading?
- What happens at the boundary? (hard wall vs soft nudge vs warning)
- What does the user SEE when they hit the limit?
- Can they still access existing data after hitting a limit, or is it locked?
- Per-plan limits for every dimension (items, actions, storage, team members, etc.)

**Scope**: Absolute minimum for launch? (MAX 10 features) "Wow" feature? Explicitly NOT V1? What delays launch?

**Success**: Month-1 success? North Star metric? How will you know it's failing?

---

## Analyst — Competitive Intelligence

**Competitors**: 2 competitors that do this well. (URLs) Core value prop of each?

**Features**: Feature list per competitor. Signup → first value flow? Core loop? What's free vs paid?

**Pricing**: Tiers and prices? Limits per tier? Free tier? Upgrade trigger?

**Steal / Improve**: What they do well → match it. What they do poorly → improve it. Features they have we don't want? Why?

---

## Architect — Technical Planner

**Data Model**: Core entities? (users, posts, orders...) Relationships? User-generated vs system-generated? Sensitive/PII data?

**Real-time**: What needs live updates? (chat, notifications, dashboards) Update frequency?

**Background Jobs**: What's async? (email sequences, PDF gen, data processing, scheduled tasks) Retry needs?

**Additional Tools**: Beyond stack — specific needs? (Maps, video, AI/ML, SMS, push, file conversion) External APIs?

**Auth Providers**: Just email/password? Google OAuth? GitHub? Apple? Magic links?

**Locations**: Company based where? Database location? Deployment region?

**Security**: User roles? Multi-tenancy? Actions needing audit trails?

---

## UX — UX Strategist

**First Contact**: First thing new user sees? First action? Value within 60 seconds? "Aha moment"?

**Core Loop**: Daily/weekly session? What brings them back? Primary action? Most frequent action?

**Navigation**: How many sections? Sidebar/top-nav/both? Always visible vs contextual? Mobile-first or desktop-first?

**Data Display**: Tables/cards/charts/feeds? Filter/sort/search? Real-time vs on-demand? Empty states?

**Screen Inventory** (CRITICAL — feeds every spec):
For every screen in the app, describe in plain English what the user SEES. Not routes or components — what's on the screen. For each screen:
- What is the main content? (cards, table rows, a form, a dashboard, a feed)
- What info does each item display? (be specific — title, price, status badge, avatar, date)
- What controls are at the top? (filters, search, sort, tabs, action buttons)
- What can the user DO? (click, favorite, create, edit, delete, export)
- What's the empty state? (first-use empty vs filtered-empty — different messages)
- Who uses this screen? (which personas)
This is what designers and spec writers use to understand the app without a prototype. Every feature in the feature map must map to at least one screen.

**Onboarding** (critical — feeds onboarding workflow):
- Do we need onboarding at all? What data do we need that we don't have at signup?
- What questions do we ask? For each: what do we DO with the answer? (personalize UI, filter content, route to right dashboard, analytics only?)
- If the answer doesn't change the product experience → don't ask it
- Clicks over inputs: can every question be single-select cards instead of text fields? Only name and avatar should require typing
- Onboarding = trust-builder: how do we show value during the flow? (welcome message referencing their pain point, preview of what they'll get, progress toward first "aha moment")
- How many steps? (Target: 3-5 max. Every extra step = drop-off)
- What's required vs skippable? (Name = required. Avatar = skippable. Preferences = skippable but valuable.)

**Conversion Funnels** (critical — feeds landing-page, auth, onboarding, billing workflows):
- What are the 3 most critical conversion moments? (Typically: visitor→signup, signup→first-value, free→paid)
- For each funnel: What's the trigger that makes users move forward? What friction stops them? What's the "aha moment"?
- What happens at drop-off? (email drip, retargeting, nothing?) What's the recovery path?
- Free→paid: What limit do they hit? What feature do they unlock? Is it a hard wall or soft nudge?
- Signup→first-value: How many steps between signup and "this is useful"? Target: under 60 seconds
- Is there a referral/viral loop? (invite, share, collaborate) Where does it sit in the funnel?

**Error & State Patterns** (critical — informs every screen in the app):
- Error philosophy: friendly and helpful ("Something went wrong, here's what to do") or minimal ("Error. Retry.")?
- Form errors: real-time inline validation as they type? On blur? On submit? (Pick one default for the whole app)
- API/server errors: show technical details or hide them? Retry button or auto-retry? Distinguish "our fault" vs "your fault"?
- Network offline: does the app need any offline capability? Show banner + disable actions, or graceful degradation?
- Loading approach: skeleton screens (content shape), spinners (centered), or optimistic updates (assume success)?
  - Which screens are skeleton candidates? (data-heavy = skeletons, quick actions = optimistic, uploads = progress bars)
- Empty states: illustration + CTA ("No projects yet — create your first") or text-only? Are empty states different for first-use vs filtered-empty vs deleted-all?
- Destructive actions: confirmation dialog always? Type-to-confirm for critical ones? Soft-delete with undo toast?

---

## Brand — Brand Strategist

**Personality**: If this product were a person, how would they talk? 3 adjectives. Brands that inspire? (not competitors) What should users FEEL?

**Visual**: Existing assets? Color preferences/no-gos? Modern/bold/warm? Dark mode preference?

**Voice**: Formal or casual? Technical or accessible? Always/never words? Error message tone?

**Positioning**: Tagline attempt? USP vs competitors? Desired perception? Emotional hook for signup?
