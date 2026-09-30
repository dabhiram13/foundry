# Step 1: Copy

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Write ALL copy before touching code. Load the `landing-page-copywriter` skill.

## Read

1. `docs/project/product-overview.md`
2. `docs/project/users-and-journeys.md`
3. `docs/project/brand-guidelines.md`
4. `docs/project/product-overview.md (pricing section)` (if exists)
5. Every component in `webapp/features/marketing/components/` — understand what copy exists in the template

## Think Before Writing

For each section, answer:
- **Who** is reading this? (persona from users-and-journeys.md)
- **What pain** are they feeling right now?
- **What objection** will they have?
- **What proof** will convince them?
- **What's the one action** we want them to take?

Use PAS (Problem → Agitate → Solution) as the primary framework for the page flow.

## Write Copy for Each Section

| Section | What to write |
|---------|---------------|
| **Hero** | H1 (under 10 words), subhead (1-2 sentences), primary CTA, secondary CTA |
| **Social proof** | Brand/partner names, trust line ("Trusted by X+ ...") |
| **Problem** | 3 pain scenarios — emotional, specific to persona |
| **Solution** | 3-4 steps: title + one sentence each |
| **Features** | 4 features: label, title, description, 4 bullets each |
| **Testimonials** | 4-6 quotes with name, role, quote text |
| **Pricing** | Tier names, prices, feature lists, CTAs (skip if no pricing) |
| **FAQ** | 5-7 objection-handling Q&As |
| **Final CTA** | Headline echoing hero promise, single CTA, reassurance line |
| **Footer** | 3 nav columns with link labels |

## Decide What to Cut

No pricing model → skip Pricing section.
No users yet → use placeholder brand names in social proof.
Simple product → collapse Solution into 3 steps instead of 4.

## Output

All copy ready. Move to Step 2.
