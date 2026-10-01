# Design system workflow

Read AGENTS.md, docs/WORKFLOW.md, the adopted product brief, and the applicable
artifact contracts before acting. Follow the actual stack, assigned write paths,
and existing authority. These steps are options for the current scope, not a
mandatory full redesign. The adopted brief overrides generic visual recipes.

Use this recipe when a new or changed design foundation is needed. Reuse the
existing system for a bounded feature or fix. The six UX handoffs in WORKFLOW.md
connect framing, flows/states, realistic prototypes, direction, implementation,
and rendered QA; this recipe supports their design/build/verify stages.

Read existing brand decisions, customer journeys, UI, tokens, and component
conventions at their real paths. Do not require a proprietary skeleton, a webapp
folder, shadcn, Tailwind, dark mode, gradients, or a logo redesign.

Choose only the relevant steps:

1. `steps/01-brand-analysis.md`: connect product outcome and character to design.
2. `steps/02-token-system.md`: define or adapt the necessary semantic tokens.
3. `steps/03-component-polish.md`: implement adopted components and state behavior.
4. `steps/04-logo.md`: work on a mark only when branding work is in scope.
5. `steps/05-layout-shell.md`: adapt navigation/layout to actual journeys/devices.
6. `steps/06-document.md`: record the adopted decisions and traceable artifacts.
7. `steps/07-verify.md`: exercise rendered UI, accessibility, and project checks.

The coordinator owns shared files and final lifecycle transitions. Update the
relevant artifact records through the documented interface; steps marked done are
not runtime receipts. On resume, inspect current files/evidence before reusing a
previous result. Missing tools or evidence remains UNVERIFIED.
