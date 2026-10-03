# Foundry Studio design system

**Direction: Soft studio, selected by the owner and implemented in the live app.** The owner rejected the first
neutral/Geist refresh as too close to the original. This design replaces the
visible theme and layout from the ground up; it is not another shadcn skin.
The comparison selected Soft studio over Product journal and Workshop. Standalone
prototypes remain visual decision aids, not proof that the live workflow works. The original specialist portraits have
been restored in source and in the generated panel.

## Product job before visual recipes

Foundry turns an idea into a tested product in its own local folder. The person
using it needs to know what is happening, what was decided, what needs their
attention, and what happens next. Their code, documents, checks and Git history
remain local. No design may invent progress or imply an account connection,
publishing action, or live agent that does not exist.

The emotional direction is a small creative workshop: approachable enough to
start an idea, precise enough to trust with real execution. The studio has a
recognizable canvas; the work has a paper surface; specialists have familiar
faces. It must not be interchangeable with a CRM/admin template.

## Observed references — October 3, 2026

- [Folk LinkedIn CRM](https://www.folk.app/linkedin-crm): textured powder-blue
  full-width section; Uxum Grotesque 500 at 64px/64px in the inspected desktop
  hero; outlined form and a large framed board with a contextual inspector.
  These are public-page observations, not access to Folk's private app.
- [Bencho Finds](https://bencho.dev/finds): an interaction gallery with press,
  reveal, selection and other categories. Use it for details, not to turn
  routine work into an animation showcase.
- [Best Designs on X](https://bestdesignsonx.com/): the public gallery shell
  loaded, but the feed stayed at Loading / 0 in this environment. No unseen
  designs are used as claimed evidence.

No Folk artwork, brand mark, code, licensed typeface or paid component recipe is
copied. The prototype's noise is original CSS/SVG; all other assets retain their
own licenses.

## Foundations

| Role | Token |
| --- | --- |
| Studio canvas | soft powder blue #e0edef; finite wispy sky on welcome surfaces only |
| Working paper | warm white #fffefa |
| Ink / primary action | #263433 |
| Secondary text | #52615f |
| Quiet pane / divider | #f3f6f3 / #d3dedb; control edges #829c9f |
| Your review | #f9f0cd with #625021 text |
| Checked work | #dce9cf with #345025 text |
| Needs repair | #f5ddd4 with #803622 text |
| Shape | 1px work frames, 8px controls, 14px benches, 12px dialogs; status pills and idea prompt chips |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64, 96px |
| Type | Manrope variable, locally bundled, SIL OFL |
| Utility icons | Phosphor duotone, MIT; labels remain visible |
| Specialist identity | original portrait PNGs, unchanged assets |

Type roles are deliberately distinct: studio welcome 76px/500 with tight
tracking; product title 48px/600; work heading 28px/600; reading text 16px; dense
controls 12–14px. Display type adapts at narrow widths; task/document typography
stays stable. Monospace is reserved for paths, versions and execution details.
The prototype embeds Manrope 5.2.6 and Phosphor core 2.1.1 with license notices;
the live app uses Manrope 5.2.6 and Phosphor React 2.1.10.

## Spatial system

### Studio welcome

Replace the generic sidebar-plus-form introduction with a clear global top bar
and a colored studio canvas. A large, concise headline and the original crew
sit beside a focused paper idea sheet. The form has a visible idea label,
useful examples, a name and one creation action. Local ownership is a short
note, not a disclaimer wall. Existing work can be resumed below.

Real empty workspaces never contain the prototype's fictional products.

### Product desk

One framed workbench, three distinct jobs:

1. Top: a horizontal six-step workflow spine. Current, selected, completed and future are
   separate states. Inspecting a step does not start it.
2. Center: the current job and one next action. Build shows tasks and checks;
   Plan/Design lead with the document requiring a decision; failure leads with
   the literal error and a safe next action.
3. Right: relevant specialist portraits, short activity and saved decisions.
   Context reflects the selected product/state, never another example's history.

Work, Documents and Activity share the desk rather than becoming independent
stacks of decorative cards. Long ideas have an expand affordance so the work is
not pushed out of reach. A step with no work has no invented outputs.

### Reading and settings

Documents have a calm reading measure, visible version and a persistent approval
footer. Settings are compact but clearly grouped by account, engine and roles.
Keep existing exact-version approval and model/reasoning behavior. Modals trap
focus, lock background scroll, close with Escape, and restore their opener.

## Component contract

Own the visible styles and compositions; reuse the tested unstyled accessibility
behavior of the existing Radix-backed primitives. Replacing that behavior with
another library would not itself improve design taste.

- Primary buttons are ink, secondary actions are outlined paper or plain text.
- Inputs are visibly labeled with adjacent validation; a placeholder is not a label.
- One strong frame groups the desk; proximity groups the contents before more boxes.
- Status always includes words and an icon, never color alone.
- Portraits identify roles, not fictional parallel live agents.
- Press/hover feedback is brief and does not move surrounding layout.
- Loading matches the actual surface; failures explain what went wrong and what next.
- Animate UI adaptations provide 160ms feedback and about 240ms selections and
  surface entrances. Welcome headings reveal once, the radial intro settles in
  under 1.4 seconds and the sky rests after 4.8 seconds. No decorative loops.
  Quiet motion and the device preference remove movement without breaking close,
  focus or selection behavior. [Component mapping](ANIMATE-UI.md) records the
  catalog decisions and the upstream MIT + Commons Clause license.

## Responsive contract

Desktop uses a spacious welcome and a paper desk with steps above work and context.
At 1000px and below, context moves under the work; its native disclosure can collapse.
At narrow widths the step spine scrolls locally and reveals the current step.

The global top bar groups Your products, New product and Account & AI with labeled
Phosphor icons. Your products opens a keyboard-accessible, scroll-locking drawer;
there is no persistent sidebar. Product settings stay next to the product title.

Use at least 44px controls, 20px mobile gutters, wrapped long titles and locally
scrolling stage navigation. At 360/390px and actual 200% zoom there must be no
horizontal page overflow. Approval stays reachable at both ends of long content.
Keep DOM reading order and keyboard order aligned with the visible layout.

## Design skills and library decision

Read as research, not installed hooks or authority:

- [Impeccable](https://github.com/pbakaus/impeccable): shape before build;
  assess information order, topology, density, typography and specificity
  before mechanical polish.
- [UI Skills](https://github.com/ibelick/ui-skills): focused interaction rules
  for targets, focus, loading, feedback and motion.
- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design):
  useful aesthetic framing, but broad guidance is not a Foundry-specific system.

Complete systems considered: [Untitled UI React](https://github.com/untitleduico/react)
(MIT open subset; PRO separately licensed) and [Radix Themes](https://www.radix-ui.com/themes).
Both improve consistency and speed, but their default look risks the same
generic result the owner rejected. [Base UI](https://base-ui.com/) is a strong
MIT unstyled greenfield foundation, not a complete visual system.

Recommendation: this owned Foundry Studio language with existing headless
behavior retained. Do not install a new CLI, design hook or paid kit merely to
claim the UI was redesigned.

## Integration and verification boundary

Semantic tokens live in app/src/globals.css, compositions in main.tsx/workspace.css
and the introduction in components/landing.tsx and landing.css. Settings, document
readers, roles and the embedded panel use the same system. Internal stage IDs
and all real workflow behavior remain.

Run TypeScript, regenerate the panel, and pass all configured framework checks.
Then exercise the real app at desktop/mobile widths, with keyboard, Escape/
return focus, scroll lock, long content, empty/loading/error states, retry/stop,
reduced motion, 200% zoom and CSP monitoring. Keep the strict per-document nonce.

The previous neutral treatment's rendered QA is superseded. Its delayed-document
navigation failure is closed by the current real-app scripted journey, not by
prototype QA. Fresh rendered testing also verifies the lifecycle feedback fix,
mobile views, actual 200% zoom and nonce-backed dialog styles. The acceptance
comparison and current evidence are in docs/UI-DESIGN.md. Live AI, account
sign-in, deployment, native MCP host rendering and exhaustive accessibility
certification remain separate verification work.
