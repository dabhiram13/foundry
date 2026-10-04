# Animate UI in Foundry

This is an application integration, not a component gallery or a new agent
runtime. The owner's request is to bring Animate UI's interaction language into
the real product. The original role portraits and accessible primitives remain
in the owner-selected dark redesign; Soft studio's colors and sky are retired.

## Used in the actual app

| Animate UI reference | Foundry use and adaptation |
| --- | --- |
| [Button](https://animate-ui.com/docs/components/buttons/button), [Ripple](https://animate-ui.com/docs/components/buttons/ripple), Icon | Shared button primitive: subtle hover/press, finite primary-action ripple, keyboard-centered feedback, fixed action indicator space. Icon-only controls retain accessible labels. |
| [Copy](https://animate-ui.com/docs/components/buttons/copy) | Product folder copy with animated confirmation, truthful failure, timer cleanup and tooltip. |
| Radix Checkbox / Radio group | Explicit subscription consent and keyboard-operable AI engine cards. Selecting an engine never signs in or starts work. Changing it clears consent. |
| Radix Tabs / Animate Highlight | Scoped sliding selection, short content reveal, existing arrow-key navigation and IDs. Documents and activity retain their actual state. |
| Radix Dialog / Sheet / Tooltip | Settings, document review, products drawer and copy help. Motion composes with the existing focus trap, scroll lock and focus restoration. |
| Radix Accordion | Model/reasoning disclosure and the home workflow explanation. |
| Radix Progress | Actual completed-stage fraction; never simulated progress. |
| [Splitting text](https://animate-ui.com/docs/primitives/texts/splitting) | One-time welcome heading reveal. The heading has one complete accessible label; reading content stays still. |
| [Radial intro](https://animate-ui.com/docs/components/community/radial-intro) | Six selectable original portraits around the idea. Finite reveal, upright labels, textual explanations, replay/stop, off-screen/hidden-page stopping. Not a live-agent display. |
| Surface entrance | One short landing walkthrough entrance, then still. The earlier wispy sky is retired; working surfaces have no decorative motion. |

Implementations are adapted into the existing `app/src/components/ui` wrappers
and focused React components, rather than installing a second conflicting UI
kit. Motion 12.23.24 is pinned. The full upstream license is included in the app
assets and generated panel; see [third-party notices](../THIRD_PARTY_NOTICES.md).

## Catalog decisions

The full Components index was inspected October 3, 2026. Its Base, Headless and
Radix families are **alternatives**, not three layers to stack on every control.
Foundry already uses Radix, so that accessibility foundation remains in place.

The app does not need GitHub-star fetching/wheels, fake user-presence avatars,
social sharing, a cursor replacement, a carousel, decorative pin lists, or a
second navigation system. They are not bundled as unused examples. Flip/liquid
buttons and endlessly morphing/typing headlines are alternatives to the adopted
buttons/text, not additional required states. Fireworks, gravity stars, hole,
stars, hexagons and endless bubble backgrounds would compete with the work;
they are not layered behind documents. No hover card is used
to hide required instructions or approvals. Native model/reasoning selects remain
native, styled to the same control system, because they hold longer lists.

## Motion and accessibility contract

- Global Quiet motion preference persists locally, without a network request.
  The system reduced-motion preference always wins.
- MotionConfig carries the server's style nonce. No CSP policy is relaxed.
- Press feedback: 160ms; selection/content: about 240ms; radial intro: under 1.4s;
  landing entrance: 600ms. No perpetual decorative orbit.
- All six role buttons remain usable with motion off. Starting an intro does
  not start a job. Keyboard focus or pointer selection interrupts movement.
- Mobile puts the idea form before the role introduction. Controls remain at
  least 44px on narrow layouts; actual zoom and overflow must be checked.
- Clipboard errors are visible. Existing failure, cancellation, exact-version
  approval, engine routing and billing safeguards remain unchanged.

## Checks

`npx tsc --noEmit`, `npm run build:panel`,
`FOUNDRY_PYTHON=.venv/bin/python node tests/studio_browser.cjs`, and the framework
checks in README. The new focused browser check uses the real HTTP server with
an isolated workspace and does not invoke AI. The existing full browser journey
uses simulated AI. Neither proves native AI, successful sign-in, deployment,
hosted MCP behavior or native permission enforcement.
