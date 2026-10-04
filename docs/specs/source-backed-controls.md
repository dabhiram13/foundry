# Source-backed Foundry controls

## Scope and authority
The owner approved the component map and real-app implementation, then requested
the complete landing/workspace result be tested before visual review. Keep the
dark Superset-inspired direction and product behavior. This is a component pass,
not another layout rewrite or a separate showcase.

## Acceptance
- UI-1: shared neutral focus, hover, pressed, selected and disabled states replace
  overlapping orange field rings and the global button ripple.
- UI-2: shadcn Field/Input/Textarea/InputGroup structure covers idea, name, search,
  help and errors with consistent geometry and associated labels.
- UI-3: Radix Select replaces reasoning selects without changing saved values;
  default round-trips as the existing empty value.
- UI-4: Base UI Autocomplete accepts suggestions, custom model IDs and blank
  defaults globally and per role; saving/reopening preserves them. Enter in an
  open picker must not accidentally submit settings.
- UI-5: source-backed Card/Item/Alert/Empty/Spinner and existing Badge/Breadcrumb
  normalize landing/workspace surfaces; no fake output or invented capabilities.
- UI-6: Quiet motion remains persistent and honors device preference, with a
  labeled switch. Controls and dialog/picker Escape/focus behavior work by keyboard.
- UI-7: landing, composer, settings and product views render without horizontal
  overflow at desktop, 390px, 360px and 200% zoom. Touch targets remain >=44px.
- UI-8: TypeScript, panel build, focused studio browser checks and the configured
  verification pass. Recorded UI testing uses local fixtures, not live AI.

## Sources / integration
Use the approved map recorded in docs/COMPONENT-SOURCES.md. Preserve attribution,
existing CSP controls and lifecycle/permission behavior. No new providers, paid
AI runs, public deployment or merge are authorized by this implementation.
Native scrolling and semantic lists remain where extra wrappers add no value.

## Checks
Run npx tsc --noEmit, npm run build:panel, the focused studio browser journey,
then scripts/marketcraft.py verify in the documented Node22/Python3.11 environment.
Review actual rendered controls, including popup-inside-dialog interaction,
reduced motion, errors, empty states and loading states.
