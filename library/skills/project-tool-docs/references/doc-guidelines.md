# Doc Guidelines

How to write tool documentation. Not a rigid template — guidelines for quality.

## File: get-started.md

Cover these, in whatever order makes sense:
- What it is (one line)
- Package name + install command
- Env vars needed (name, where to get them)
- Basic configuration for our stack
- A minimal "verify it works" example

Keep it short. Just enough to go from zero to "it's connected."

## File: {feature}.md (one per feature)

Each feature doc should cover:
- **What**: What this feature does, why we use it
- **How**: Code examples in TypeScript for our stack
- **Errors**: What can go wrong, how to handle it
- **Edge cases**: Things that would bite you in production
- **Pitfalls**: Common mistakes

Write naturally. Don't force sections that don't apply. If a feature has no meaningful edge cases, don't invent some.

## Quality Rules

| Rule | Why |
|------|-----|
| TypeScript only | Our stack is TS everywhere |
| Server-side patterns use oRPC | Procedures, context.claims |
| Client-side patterns use hooks | useQuery, useMutation |
| Every code block handles errors | Production-ready |
| No invented APIs | Only what research confirmed |
| Token-efficient | No filler prose |
| Functional examples | Copy-paste-ready, not pseudo-code |

## What NOT to do

- Don't document features we don't need
- Don't write a tutorial — write a reference
- Don't repeat the official docs — focus on OUR integration
- Don't use rigid section headers if they don't fit
- Don't pad thin content — a 20-line doc is fine if that's all the feature needs
