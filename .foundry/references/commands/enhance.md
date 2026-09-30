<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: enhance
description: Enhance an existing feature. Reads built docs, inspects actual code, asks ultra-relevant questions about the improvement, then builds it.
---

# Enhance Feature

You are enhancing an existing feature. Your job is to understand what exists deeply, then ask the RIGHT questions about what the user wants to improve.

The user said: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask: "What feature do you want to enhance? And what should be different?"

---

## Phase 1: Identify the feature

From the user's description, figure out which built feature(s) are involved.

1. Read `docs/INDEX.md` — scan the Built Features section
2. Match the user's description to one or more `docs/built/{feature}.md` files
3. Read those built docs — understand: key files, architecture, data model, patterns used

If you can't match to a built feature, ask: "Which feature area is this? I see these built: {list}"

## Phase 2: Deep inspection

Now go deeper than the docs. Spawn an Explore agent to:

```
Read the key files listed in docs/built/{feature}.md. Understand:
- What components exist and what they render
- What procedures/API endpoints exist
- What data flows exist (server → client)
- What the current UX looks like (page structure, layout)
Report back: file list, component tree, data flow, current capabilities
```

This gives you ground truth, not just doc summaries.

## Phase 3: Ultra-relevant questions

Now you know EXACTLY what exists. Ask 2-4 questions that are:
- Specific to THIS feature's current state
- Reference actual components/pages/procedures by name
- About the GAP between what exists and what the user wants

**Examples of GOOD questions:**
- "The ideas list currently shows title + status + date. You want to add filtering — by status only, or also by tag/category?"
- "The dashboard has a grid of cards. Should the new chart replace a card or go in a new section above?"
- "The billing page currently redirects to Stripe portal. Should upgrade CTAs appear inline on the page instead?"

**Examples of BAD questions:**
- "What tech stack should we use?" (you know it)
- "How should we store the data?" (that's implementation)
- "What components should we use?" (that's the designer's job)

Ask all questions at once. Wait for answers.

## Phase 4: Write mini spec

This is an enhancement, not a new feature. Write a focused mini spec:

```markdown
# Enhance: {feature} — {what's changing}

## Current State
{What exists now — reference actual files}

## The Enhancement
### {Change 1}
{What the user will experience differently}

### {Change 2}
...

## Business Logic Changes
- {New rules or modified rules}

## Edge Cases
- {New edge cases introduced by this change}

## User Flows (test these)
1. **{Flow}**: {Start} -> {Action} -> {Expected new result}

## UI Changes
- {What changes visually — be specific about which components}

## Scope
- ONLY changes: {list of things that change}
- Does NOT touch: {things that stay the same}
```

Save to: `dev/active/{feature}-enhance/spec.md`

## Phase 5: Build

- Size the enhancement (usually XS or S)
- For XS: skip planner, route directly to the right agent(s)
- For S+: quick plan → build → test → quality → complete
- Always update `docs/built/{feature}.md` after (via complete agent)
