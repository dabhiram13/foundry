# A screen reads like a senior designer made it for this product

**Goal.** Every page shows its hierarchy at a glance, carries this product's character rather than a generic one, and can be operated by everyone — keyboard, screen reader, one thumb on a phone.

**Reasoning.** AI-built interfaces converge on the same minimum: a heading, a sentence, a three-column grid of identical cards, an icon in a tinted circle, a purple gradient. It is not ugly; it is anonymous, and users read anonymity as "unfinished". The opposite failure is decoration without meaning — orbs, glows, frosted panels, motion on everything — which hides the hierarchy the page exists to show. Four copies of a banned-pattern list tried to legislate this and disagreed with each other. The judgment: **hierarchy first — what the user needs first is visually first; then character — one dominant colour used well, type and spacing that belong to this product; then depth and motion only where they carry state or focus; and none of it counts if a keyboard cannot reach it.**

**Priority.**
1. Hierarchy over decoration. A visual element that does not tell the user what matters first, second, third is noise.
2. Convention for structure, character in the details. Billing is plan cards, settings is form sections, lists are filterable grids. Novelty lives in type, colour, density, composition — and in how much: a marketing page earns more atmosphere than a product page, but the same test applies.
3. Both modes, all widths. Light and dark are equally intentional; 375px is designed, not "it fits". A dialog, table, popover, or split panel gets a real mobile replacement with its contents laid out — "collapses to a sheet" is not a design.
4. State in three channels. Status is colour and shape and text. Every interactive element has a hover state and a keyboard equivalent; a hidden-until-hover action is a failure.
5. Density serves comprehension. A card shows what the user decides on (status, time, metric, next action), not only a title — and never a fixed pixel height where content should flow.

**Good.**
- The one thing the user needs — the balance, the job status, the primary action — sits at the top or in the primary visual area, and nothing competes with it.
- A tool page fills the viewport with floating controls; a content page is contained. The choice follows the page type, not the template.
- Status combines a border tint, an icon, and a label. Locked content changes border, background, and icon — not opacity alone.
- Empty states have a purpose-built illustration and a next step. Skeletons are calm, solid, and match the final layout.
- The selected navigation item is a quiet border or background, not bold text or a loud fill. Icons are large enough to recognise; the collapsed sidebar hides everything but them.
- Cards in a row share a height and align title, body, and action; content that varies is clamped, not allowed to break the row.

**Counterexamples.**
- An icon in a tinted circle; three equal columns of identical cards; a page that is heading + paragraph + grid.
- A purple gradient on white; atmospheric orbs; frosted glass; glowing borders; oversized decorative type that costs legibility.
- Dark-only, or a dark mode where muted text disappears.
- A sparkle icon on every AI feature; a generic external-link icon where the brand's own mark exists.
- Confetti or a celebration banner that takes content space from the thing the user just made.
- A hover-only reveal with no focus equivalent; a modal that drops focus on close; a delete that leaves focus on the body.

**Evidence.** Screenshot every new or changed page at 375, 768, and 1280, in light and dark, and attach them — zero screenshots means the visual sections are UNKNOWN. Walk the page by keyboard alone and record where focus lands after each modal close, deletion, and async completion. When the deleted element *was* the focused one, focus moves to the next row, or to the create control when the list empties — never to the body. Every target clears 44×44 at 375px (measure the smallest one). With `prefers-reduced-motion` on, every fade, slide, and dim collapses while the live region still announces the change. Check contrast for body and large text. Compare the result against the brief's stated direction: list each element of the direction as present or absent, and list every counterexample above that appears on the page. An absent direction element or a present counterexample is a FAIL, not a taste note.
