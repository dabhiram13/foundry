# A quieter Foundry website

## Outcome

Replace the scarlet illustration-led website with one restrained, readable
component system. This is the public-site stage of the approved whole-product
direction, not a replacement for managed engineering sessions. The public site
stays static and does not advertise a workspace before one exists.

## Design handoff

- Journey: understand Foundry, inspect its stages, choose the published terminal
  or connected source path, then follow the relevant installation guide.
- Information order: compact header, clear hero, installation and availability,
  six workflow disclosures, specialist summaries, approvals/progress/checks,
  questions and a simple resource footer. Preserve existing section anchors.
- Visual rules: Inter, neutral light canvas, dark text, generous but bounded
  whitespace, 6px controls, 8px panels, quiet one-pixel dividers. No gradients,
  fake runtime UI, decorative terminal playback, activity metrics or art walls.
- Components: source-owned shadcn/Radix Button; native disclosures following
  Accordion/Collapsible styling; flat Card/Separator spacing; passive availability
  badges. Keep Starlight search/theme/menu semantics, style their real fields,
  results, selectors, buttons, focus and active states in both themes.
- Source references: https://ui.shadcn.com/docs/components/radix/button,
  https://ui.shadcn.com/docs/components/radix/accordion,
  https://ui.shadcn.com/docs/components/radix/collapsible,
  https://ui.shadcn.com/docs/components/radix/card,
  https://ui.shadcn.com/docs/theming and
  https://starlight.astro.build/reference/overrides/.
- Copy control: idle, copying, copied, unavailable and failed with retry/manual
  fallback; visible polite status; duplicate-click protection and timer cleanup.
- Header menu: native no-JS open/closed behavior, Escape and focus return when
  hydrated. Minimum 44px targets and visible focus everywhere. Docs Search
  and code-copy hit boxes are at least 44px in both dimensions on mobile and
  desktop; code reserves space beside the copy button.
- Identity: retain the horse silhouette in a small monochrome mark; replace the
  serif wordmark with Inter outlines. README banner remains logo and name only.
- Delete unreferenced artwork, display font and motion primitives. Preserve
  required license notices and historical provenance without shipping dead art.

## Acceptance criteria

- WEB-01: Landing, documentation, README identity and social metadata share the
  neutral system. All local links and canonical pages remain valid.
- WEB-02: Every public control has coherent hover, pressed, focus, open, selected
  or disabled states as applicable. Copy failure is honest and recoverable.
- WEB-03: Layouts work at 320, 375, 768, 1024 and 1440px, with long content,
  keyboard navigation and reduced motion. No page-wide horizontal overflow.
  Documentation light/dark themes and native search/menu/select controls work.
- WEB-04: Installation stays the real two-command npm path. Published 0.5.1,
  connected source preview and planned managed work are distinguished. No fake
  metrics, silent sandbox claims or automatic publication promises.
- WEB-05: Remove dead production assets/dependencies only after reference checks.
  Run site/runtime/package/tooling/catalog/security gates and pre-commit hooks.
- WEB-06: Compare the actual rendered website with the old 522c6a0 baseline and
  the source component recipes, including desktop/mobile states. Browser evidence
  supplements shell verification; it is not owner acceptance or proof of product
  quality. No package publication or manual deployment.

## Whole-product follow-through

The next runtime stages add typed managed execution/session contracts, durable
state and recovery, an explicit coding executor, then authenticated workspace
tools and PR/CI follow-up. Existing connected-client ownership remains unchanged.
Keep those tasks active; a website redesign does not fulfill that wider scope.
