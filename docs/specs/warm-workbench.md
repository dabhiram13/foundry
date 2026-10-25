# Warm Workbench: public-site design contract

## Audience and promise

For a builder starting a product or improving an existing repository: Foundry keeps the brief, approval, changes and checks connected. The first real action is to install the published terminal, not to sign in to an unfinished web application. The public Astro site remains static and separate from the future managed workspace.

## Reference, identity and constraints

LightSprint was inspected on its public home, engineering, security, pricing, blog and docs pages in light and dark modes. Observed mechanisms include a warm pixel-pattern page background, an orange/charcoal textured product frame, compact Suisse Int'l typography on marketing pages, Inter in docs, gradient-rim buttons with layered shadows, a clickable workflow stepper and clearly highlighted docs navigation. These are references to composition and interaction, not reusable assets or claims. Create original artwork and use an OFL font; do not import its proprietary typeface, screenshots, company marks, testimonials or interface illustrations. Preserve the Foundry horse as the existing identity while giving it a warm background. README remains logo and name only; GitHub controls Markdown fonts.

## Routes and component/state map

| Surface | Before | After | Required states / route |
| --- | --- | --- | --- |
| Header, brand, navigation | neutral bar, nav links, primary CTA | warm page-integrated header, orange mark tile, restrained nav, tactile install button | `/`, anchor, `/docs/`, GitHub, mobile menu open/closed/Escape/outside link/focus |
| Hero | statement and buttons without visual proof | concise product promise and original textured frame with genuine Foundry example content, not a pretend running agent | initial render without JS, CSS texture fallback, light/dark, narrow/wide and reduced motion |
| Install/copy | detached gray card | inset console integrated with hero/example; true install command and separate source path | copy idle/busy/success/failure/unavailable, keyboard, selectable fallback |
| Workflow | six unrelated disclosures/role list | selectable connected journey with one realistic task; details and illustration change together | initial SSR first step, each manual step, focus, active selection, no unattended autoplay, small screens |
| Capabilities/status | repeated six-icon roster | authored sections for what is published, in source and not yet shipped | actual docs links, no unshipped interactive controls |
| FAQ and footer | plain disclosures/links | compact ruled FAQ and warm footer | closed/open keyboard, all links reachable |
| Docs header/search/sidebar | Starlight with neutral styles | same Starlight functionality, warm shared tokens and touchable search/theme/menu | search open/close/empty/results, selected nav, mobile sidebar, light/dark/auto |
| Docs main content | neutral headings/code/table/footer | warm typography, navigation and tactile controls | headings, tables, code copy, pagination, TOC, focus/hover/active/disabled |
| Brand artwork | off-white Inter-outline wordmark | warm original orange horse tile plus Instrument Sans self-contained wordmark/banner/share art | SVG fallback, readable label/alt, license notices, README image points to current asset |

## Acceptance criteria

- WW-01: Landing has original warm textured visuals, actual Foundry task/install path, correct stage boundaries and functioning navigation/clipboard/disclosures/workflow. No simulated SaaS signup or running browser agent.
- WW-02: Buttons feel clickable in both themes and remain discernible for hover, focus, pressed, disabled and selected states. Controls are 44px minimum, have names and preserve keyboard access and visible focus.
- WW-03: Docs keep search, page navigation, menu, theme selection and code copy working, including results, errors, open/close and mobile states.
- WW-04: Updated open-licensed fonts and original assets are self-contained, credited and consistent on site, share card and README banner. No external asset requests are needed for the public UI.
- WW-05: Mobile/desktop, light/dark, reduced motion and no-JS fallback are checked on the rendered site. Functional static tests, type checks and existing framework gates remain green. Visual acceptance belongs to the owner, not the tests.

## Detail refinement after owner review

The first preview was not visually accepted. The owner specifically rejected
the workflow selection treatment, icon clutter and unexplained Studio booking
label, and requested the missing dithered type, more visible background and a
more original animated top bar. Functional passing checks were not visual approval.

- WW-06: Original dot-wave text rasterization is visible on hero entry and hover,
  with selectable semantic text at rest and without JavaScript. Reduced motion
  disables canvas animation; resize, visibility changes and unmount cancel frames.
- WW-07: A locally generated orange/charcoal ordered-halftone background fills
  the product frame, not a small side strip. Subtle hover depth is decorative and
  disabled for reduced motion. No LightSprint artwork or implementation is copied.
- WW-08: The example uses plain language and a connected team-invitation task.
  No Studio booking label, fake live dot, boxed step icons or peach selection
  blocks. Six manual tabs have a clear selected surface and matching content.
- WW-09: A floating header has a measured sliding navigation surface and reading
  progress. Install, Docs, GitHub, mobile controls and keyboard focus remain.
- WW-10: Landing and docs controls receive a rendered state audit, especially
  sidebar selection, theme selection, previous/next pagination, code copy and
  mobile navigation. Motion must clarify interaction, never change hit targets.

## Compact refinement after owner review

The owner requested less marketing copy, a lighter charcoal/orange page ambience,
more compact controls, a more distinct workflow selection and a rounded top bar.
The earlier thin selected track was not visually accepted.

- WW-11: The original halftone continues into a charcoal-to-paper page backdrop.
  Hero text remains readable over its light areas. Docs keep readable light/dark
  article surfaces rather than inheriting a decorative backdrop.
- WW-12: The duplicated six-role roster and filler captions are removed; the
  catalog remains linked. npm, source-only and unfinished-workspace boundaries
  remain clear, and the walkthrough identifies itself as an example.
- WW-13: The six-stage selection uses inset ivory capsules on dark charcoal,
  not peach cards or a thin underline. The selected shape is visible in light
  and dark themes, can be scrolled on 320px screens and retains 44px keyboard and
  pointer targets with roving focus and reduced-motion support.
- WW-14: The top bar has coherent rounded corners and keeps measured navigation,
  reading progress and mobile menu. Primary, outline, search and previous/next
  faces are more compact without shrinking their 44px hit areas. Check rendered
  hover, focus, pressed, selected, copy failure and unavailable states.

## Headline and Docs consistency refinement

The owner likes the overall direction but requested a stronger headline and
compact Docs controls instead of the long input-shaped header search.

- WW-15: The headline is “Build your idea. Keep control.” in the hero, page title
  and README. Semantic text and dot-wave behavior remain; no automatic delivery
  or product-quality guarantee is added.
- WW-16: Docs search is content-sized rather than a stretched 22rem bar. Its
  compact face, Docs badge and theme hover surface share capsule geometry and
  36px visual height inside 44px targets. The mobile TOC uses the same rounded
  treatment. Search dialog sizing follows its contents rather than an empty
  minimum-height box. Search shortcuts, results, dismissal, native theme options,
  keyboard focus and 320px containment remain working in both themes.

## Implementation boundaries

Use existing React/Astro/Starlight and native controls where possible. Do not copy LightSprint's commercial image or font. Do not require a live model, provider account or billing. No deployment or merge without explicit approval. PR #43's Fluted Signal direction is rejected and not the base for this work.
