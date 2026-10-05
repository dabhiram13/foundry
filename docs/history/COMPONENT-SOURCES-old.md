# Historical record: Component-source implementation map

> Describes the former application UI. Current public-site controls are documented separately.

Research date: 2026-10-04. This map records the reviewed source choices and implementation.

## Selected stack

- Keep Animate UI for the agreed animated controls and overlays.
- Fill missing styled components with shadcn/ui's Radix/New York v4 source, matching the existing React 19, Tailwind 4, Radix and local-source setup.
- Use Base UI Autocomplete for editable model IDs. Its documented free-form input behavior is a better fit than a selection-only combobox or action menu.
- Use shadcn/Radix Select for reasoning, replacing the earlier proposal to compose a Popover and Radio Group.
- Keep the dark Superset-inspired direction and original Foundry identity. Library defaults do not decide the final look.
- Do not replace the app with Mantine, Radix Themes or React Aria; they were considered but would add another broader component/styling system.

## Source revisions and acquisition

shadcn/ui revision verified with git ls-remote:
`295a1f114a138f23b5dfee0e0c6812394dfeb90c`

Component directory:
https://github.com/shadcn-ui/ui/tree/295a1f114a138f23b5dfee0e0c6812394dfeb90c/apps/v4/registry/new-york-v4/ui

For each shadcn ID below, the implementation source is `<directory>/<id>.tsx`.
Registry payloads were also inspected at `https://ui.shadcn.com/r/styles/new-york-v4/<id>.json` for dependency and import information. These registry URLs are mutable; use the recorded revision for reproducible source retrieval, not an unreviewed latest overwrite.

Base UI upstream revision observed:
`19511bb171f3b360b006c94cf6d07e53cb446505`

Official Tailwind Autocomplete example, retrieved successfully:
https://github.com/mui/base-ui/blob/19511bb171f3b360b006c94cf6d07e53cb446505/docs/src/app/(docs)/react/components/autocomplete/demos/hero/tailwind/index.tsx

Base UI behavior documentation:
https://base-ui.com/react/components/autocomplete

## Individual components and exact use

| Component/source ID | Documentation | Foundry use and adaptation |
| --- | --- | --- |
| input | https://ui.shadcn.com/docs/components/radix/input | Product name and simple text fields. Existing Input is already shadcn-style; re-adding it alone will not fix the CSS conflicts. |
| textarea | https://ui.shadcn.com/docs/components/radix/textarea | Idea input; one deliberate boundary, readable placeholder, vertical resize, invalid and disabled states. |
| input-group | https://ui.shadcn.com/docs/components/radix/input-group | Role search icon/input shell. Use its shared focus boundary instead of a separately positioned page-specific icon. InputGroupTextarea is available if the composer needs integrated tools. |
| field | https://ui.shadcn.com/docs/components/radix/field | Field, FieldContent, FieldGroup, FieldSet, FieldLegend, FieldLabel, FieldDescription and FieldError normalize the whole field, not only the input element. |
| label | https://ui.shadcn.com/docs/components/radix/label | Shared accessible label primitive required by Field; connect htmlFor/id explicitly. |
| select | https://ui.shadcn.com/docs/components/radix/select | Global and per-role reasoning pickers. Reuse existing radix-ui. Use a UI-only default sentinel mapped back to the existing empty-string setting; do not change backend meaning. |
| Base UI Autocomplete | https://base-ui.com/react/components/autocomplete | Global/per-role model suggestions; import from @base-ui/react/autocomplete. Control the text value, preserve custom IDs and blank-as-default, and commit chosen suggestions to the existing draft. Do not add a Create model action. |
| card | https://ui.shadcn.com/docs/components/radix/card | Work panels, account sections and landing information surfaces through CardHeader, CardTitle, CardDescription, CardContent, CardFooter and CardAction. Use only where a true grouped surface is needed; no field-inside-card-inside-card nesting. |
| item | https://ui.shadcn.com/docs/components/radix/item | Product rows, saved documents, build-task summaries and role summaries. ItemGroup, ItemMedia, ItemContent and ItemActions provide consistent row anatomy. Interactive rows need a real link/button; static rows must not imply clickability. |
| Field choice-card pattern | https://ui.shadcn.com/docs/components/radix/field#choice-card | The surrounding shell for AI-engine radio options and consent labels, composed with Animate UI radio/checkbox behavior. This is a documented composition, not a standalone ChoiceCard export. |
| badge | https://ui.shadcn.com/docs/components/radix/badge | Ready, Working, Needs review, Failed and Done. Preserve text/icons; never rely on color alone. |
| alert | https://ui.shadcn.com/docs/components/radix/alert | Persistent sign-in, permission, test and recovery feedback. Adapt live-region urgency to the message; not every informational box is an assertive alert. |
| empty | https://ui.shadcn.com/docs/components/radix/empty | No products, documents, activity or search results. Use truthful copy and at most one relevant action. |
| spinner | https://ui.shadcn.com/docs/components/radix/spinner | Pending buttons and requests; reserve space and keep an accessible status. Reduced motion gets a static indicator/text. |
| skeleton | https://ui.shadcn.com/docs/components/radix/skeleton | Only genuine asynchronous loading, never empty/completed states. Disable pulsing for reduced motion. |
| breadcrumb | https://ui.shadcn.com/docs/components/radix/breadcrumb | Workspace/product location. Audit the existing wrapper instead of creating a duplicate. |
| separator | https://ui.shadcn.com/docs/components/radix/separator | Quiet section dividers and row groups; audit/reuse existing wrapper. |
| scroll-area | https://ui.shadcn.com/docs/components/radix/scroll-area | Optional constrained document/role lists where styled scrollbars genuinely help. Keep page scrolling native and avoid nested scroll traps. |
| Activity timeline composition | https://ui.shadcn.com/docs/components/radix/item | Compose Item + Separator + Badge within semantic list markup. No standalone timeline package is proposed. |

## Dependency decision

Current pinned dependencies observed: react/react-dom 19.3.0, radix-ui 1.6.7, motion 12.23.24, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0, Tailwind tooling 4.3.3.

Pinned runtime additions:
- `@base-ui/react`: npm stable 1.8.0 observed, published 2026-09-04. Declares React/React DOM 17, 18 or 19 compatibility. Date libraries are optional peers; do not add them for Autocomplete.
- `lucide-react`: stable 1.51.0 observed; declares React 19 compatibility. Used by the shadcn source and shared icon direction; Phosphor imports have been removed.

These versions are pinned for the implementation. Check the saved verification report for actual integration results; peer compatibility alone is not a passing build.

shadcn is copy-in component source, not a required app runtime package. Manual source adoption avoids a CLI upgrade/reset; no need to install shadcn CLI merely to copy this bounded set.

The current registry lists an external `cn` dependency, but Foundry already has its `cn` helper. Rewrite that import to `@/lib/utils`; do not install an unrelated helper package. Rewrite registry-local paths to the existing component aliases. InputGroup depends on Button/Input/Textarea: retain the agreed Animate UI Button wrapper rather than blindly overwrite it through a bulk registry command.

No cmdk, React Hook Form, Zod, Mantine, Radix Themes or React Aria package is needed for this scope. Do not copy dependencies used only by documentation demos (e.g. Tabler icons).

Licenses: shadcn source and Base UI are MIT; lucide-react npm metadata declares ISC. Preserve notices and review the existing Animate UI license separately.

## Controls retained from the prior Animate UI map

Button/Copy Button, Radio Group, Checkbox, Switch, Tabs, Dialog, Sheet, Accordion, Tooltip, Progress, finite radial specialist intro and limited text effects stay on the chosen Animate UI path. Do not introduce a second implementation of each overlay through shadcn.

## Required implementation discipline

1. Read the actual pinned source before adapting; preserve semantics, keyboard behavior and attribution. Every adaptation is explicitly an adaptation, not claimed verbatim source.
2. Remove conflicting global/page-level field and focus rules. One neutral visible focus treatment; neutral selection/progress accents. Do not just reinstall the same Input/textarea styles.
3. Preserve lifecycle, provider settings, custom model values, approval flow, form validation and server contracts.
4. For Base UI popups inside existing Radix dialogs, verify portal placement, pointer interaction, Escape, focus restoration and scroll behavior. Compatibility is still untested, not promised from peer metadata.
5. Test model typing/selection/clear/save/reopen and default reasoning round trips. Prevent Enter in a suggestions popup from accidentally saving/submitting the form.
6. Check required, invalid, disabled, loading, empty, hover, focus, pressed and selected states as applicable. Keep target sizes consistent: 40px desktop baseline, at least 44px touch targets, 48px hero CTA; compact shapes, not inflated cards.
7. Run TypeScript, generated panel build and existing configured browser/framework checks. Review rendered desktop, 360px/390px, 200% zoom, keyboard and reduced-motion states. This research does not establish a rendered or tested result.

Implementation adapts the pinned source, not documentation demos. Base UI Autocomplete is a local composition of its published primitives. Quiet motion uses the existing Radix switch behavior with a finite CSS thumb transition; no second motion engine. Native scrolling is retained rather than adding a nested Scroll Area. Skeleton is reserved for real asynchronous document loading. No paid runs, merge or deployment are part of this change.

## Neutral landing and docs refinement

References checked for the owner's later refinement:

- [Cult UI theming](https://www.cult-ui.com/docs/theming): shared shadcn tokens,
  consistent surfaces, borders and focus. Adopt the token discipline, not a kit.
- [Cult UI Halo Tabs](https://www.cult-ui.com/docs/components/halo-tabs): reviewed
  but not copied; gradient indicators conflict with the request to remove shine.
- [shadcn Button](https://ui.shadcn.com/docs/components/radix/button): retain the
  existing source adaptation and accessible variants; neutral flat treatments.

This pass copies no Cult UI source and adds no dependencies. Starlight retains
its static navigation/search instead of importing React controls. Orange brand
accents and decorative headline brackets are removed, not recolored as gradients.
