# Step 2: Build (Clone & Adapt — Designers 1-2)

> Apply only the parts adopted in the product brief and current scope. The brief overrides generic gradients, glass, shadows, dark panels, layout recipes, and theme requirements. Use the six UX artifact handoffs at small/feature/product depth from docs/WORKFLOW.md; references do not authorize new tools, services, or publishing.


> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Clone template components, swap copy and mockups. Read `webapp/app/globals.css` for design tokens.
Designers 3-4 use `02-build-creative.md` instead.

## Process

For each component in `webapp/features/marketing/components/`, in order:

### 1. header.tsx
- Swap brand name + logo SVG
- Update nav links to match included sections (e.g., remove `#pricing` if no pricing)
- Update CTA button text + href

### 2. hero.tsx
- Swap H1, subhead, CTA texts from Step 1 copy
- **Build a new product mockup** that simulates your SaaS UI (the template has a dashboard mockup — yours should show your product's main screen, with sidebar/cards/data relevant to your product)
- Keep: gradient bg, AnimatedGridPattern, BlurFade delays, browser chrome frame

### 3. social-proof-bar.tsx
- Swap brand names array
- Update trust line text

### 4. problem-section.tsx
- Swap 3 problem cards: icon, number, title, description
- Pick Lucide icons that match each pain point

### 5. solution-section.tsx
- Swap step cards: icon, title, description
- Keep: SVG AnimatedCurve, DotPattern, desktop/mobile layouts

### 6. protocol-section.tsx
- Swap 4 features: label, title, desc, bullets, imagePosition
- **Build 4 new mockup components** — each ~50-100 lines of JSX simulating a different aspect of your product (the template has IdeasMockup, DocsMockup, BuildMockup, LaunchMockup — yours should show your product's key screens)
- Keep: sticky-stacking scroll behavior, text+mockup layout

### 7. testimonials.tsx
- Swap testimonials array: name, role, gradient, quote
- Keep: Marquee, TestimonialCard structure, star ratings

### 8. pricing-section.tsx (skip if no pricing)
- Swap plans array: name, price, period, description, features, cta, popular flag
- Keep: 3-column grid, popular card styling

### 9. faq-section.tsx
- Swap faqs array: question, answer
- Keep: Accordion, dark bg styling

### 10. final-cta.tsx
- Swap CTA headline, subtext, button text, reassurance line
- Swap footer nav columns + links
- Swap giant brand text
- Update copyright

### 11. page.tsx
- Clone `webapp/app/(marketing)/landing/page.tsx` → `webapp/app/(marketing)/page.tsx`
- Update metadata: title, description, OG tags
- Remove sections that were cut in Step 1

## Rules

- Use design tokens from `globals.css`. No raw colors.
- Every component stays `"use client"` — page.tsx stays Server Component.
- Keep all BlurFade delays, Marquee configs, scroll behaviors from template.
- Mockups are the hard part. Make them look real — use realistic data, proper spacing, card borders, mini-charts if relevant.

## Output

All components written. `npm run build` must pass. Move to Step 3.
