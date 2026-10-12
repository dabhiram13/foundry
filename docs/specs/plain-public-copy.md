# Plain public copy and README identity

## Outcome

Use direct, plain words for what Foundry helps people do. Keep the approved
scarlet identity. The README banner contains only the horse logo and Foundry
name, without a tagline or stage labels.

## Scope

- README, landing page, stage descriptions and public page metadata.
- Starting guides, overview copy and matching navigation labels.
- Self-contained SVG banner and its content and fit regressions.
- Existing technical references keep required command names and protocol terms.

## Accepted design

Reuse the existing horse mark and outlined wordmark, ink background, scarlet
field and ivory lettering. Do not redraw the identity or change components.

The existing docs viewport handoff applies: people choose a setup path, follow
the guide and review stages. Information order, layout and artwork stay the
same. Component open, focus, copy and menu states stay the same. Keep readable
mobile wrapping, keyboard controls and reduced-motion behavior. Verify the
new wording and banner at mobile, tablet and desktop widths.

## Acceptance criteria

- COPY-1: The banner reuses the approved logo and name. Both fit within its
  viewBox. It has no text tagline, stage labels or external dependencies.
- COPY-2: Public introductory copy describes research, planning, design,
  building, review and handoff without AI slogans or internal runtime jargon.
- COPY-3: Setup still distinguishes npm 0.5.1 from the OpenCode source code.
  It says the connected path has not been tested with a live model and that
  Homebrew is unavailable. It does not imply automatic publishing.
- COPY-4: Site tests, full project checks, dependency audit, diff check and
  pre-commit security checks pass. Browser checks cover changed public copy
  and banner fit without replacing framework checks.

## Exclusions and release boundaries

No runtime changes, package publication, Homebrew formula, model account use,
manual deployment, rejected Mist work or hand edits to private state. No data
migration is needed. Existing guides and tests are the dependencies.
