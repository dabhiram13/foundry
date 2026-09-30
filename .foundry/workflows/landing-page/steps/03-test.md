# Step 3: Test & Polish

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Use the `designer` to test responsiveness at 3 breakpoints and fix issues.

## Build Check

```bash
npx tsc --noEmit && npm run build
```

Fix any errors before visual testing.

## Visual Testing — 3 Breakpoints

Test every section at each breakpoint. Use `agent-browser` or Playwright to screenshot each.

| Breakpoint | Width | What to check |
|------------|-------|---------------|
| **Mobile** | 375px | Text doesn't overflow. Cards stack vertically. CTAs are full-width. Hero mockup scales down or hides detail. No horizontal scroll. |
| **Tablet** | 768px | Grid layouts transition correctly (e.g., problem cards 1→3 cols). Navigation visible. Mockups don't overlap text. |
| **Desktop** | 1280px | Full layout: grids fill width, sticky-stacking works, SVG curve aligns with cards, spacing is generous. |

## Section-by-Section Checklist

For each section at each breakpoint:

- [ ] Text is readable (no truncation, no overflow)
- [ ] Spacing is consistent (no cramped or empty gaps)
- [ ] Interactive elements are tappable on mobile (min 44px touch target)
- [ ] Dark mode works (toggle and recheck)
- [ ] BlurFade animations trigger on scroll (not broken by layout changes)
- [ ] Mockup components render correctly at all sizes

## Fix Loop

If any breakpoint fails:
1. Fix the component
2. Re-run build check
3. Re-screenshot that breakpoint
4. Confirm fix

## Output

Landing page is responsive, builds clean, looks good at all 3 breakpoints. Done.
