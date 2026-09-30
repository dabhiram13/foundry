# Frontend Pattern

Opinionated default for this kit:

- Server components first.
- Client components only on the lowest interactive leaf.
- Cache deliberately.
- Keep pages thin and flows obvious.

Judgment: `.foundry/philosophy/data-flow.md` and `async-state.md`.

## Defaults

- Read `.foundry/references/source-docs/patterns/frontend/field-guide.md` before improvising.
- Fetch on the server, not with `useEffect`.
- Use cache primitives instead of ad hoc re-fetch loops.
- Let URL state and server data shape the UI.
- Prefer one strong page pattern over many bespoke patterns.
- Forms must define loading, validation, success, and empty/error states up front.

## Smells

- Client components pulling data that belongs on the server.
- State duplicated across URL, local state, and server response.
- Loading states added after the page exists.
- Suspense boundaries broken by unstable keys.
- Cache invalidation by habit instead of design.

## Read Next

- `.foundry/references/source-docs/patterns/frontend/field-guide.md`
- `.foundry/references/source-docs/patterns/frontend/architecture.md`
- `.foundry/references/source-docs/patterns/frontend/page-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/form-pattern.md`
- `.foundry/references/source-docs/patterns/frontend/caching-pattern.md`
