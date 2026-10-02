# Foundry workspace design

Status: implemented; verification is recorded in the build record. Depth: feature. Check results are recorded in docs/built/.

The owner rejected the earlier interface and the subsequent Tabler design. The
current approved direction is a Notion-like document workspace using genuine
shadcn components, plus a reusable design system, relevant starred design skills,
and original SVG branding. Earlier Figma and Tabler directions are superseded.

Use React with owned shadcn primitives, Tailwind semantic tokens, local Geist,
Lucide SVG icons, and an original SVG mark. Keep the browser and embedded MCP
panel self-contained. Preserve factory APIs, state, approvals, provider selection,
and existing user products. Do not add unrelated frameworks or paid UI assets.

## Acceptance criteria

- UI-01: Home has a clear product-name/idea composer, useful editable examples,
  recent products, and an accurate six-stage explanation.
- UI-02: Products show their current stage, next action, real documents/activity,
  review/approval gates, failures, cancellation, retry, and release handoff.
- UI-03: Account, provider/coordinator and per-specialist settings are usable;
  values persist, blank overrides inherit, failures keep inputs and visible errors.
- UI-04: Controls work with keyboard and accessible shadcn dialogs. Desktop, tablet, mobile
  and 480px panel views have no page overflow; reduced motion is respected.
- UI-05: CSS/icons/logo are bundled locally in browser and MCP panel. User content
  remains escaped/sanitized; review cannot approve a different or stale stage.
- UI-06: Existing required framework, application and evaluation checks pass;
  fixtures, live AI execution, deployed behavior and owner acceptance are reported
  separately. Comparison claims distinguish public vendor descriptions from tests.

## Boundaries and verification

Root owns React composition/CSS/brand/docs/integration. The UI foundation builder
owns component dependencies, build/server delivery, and browser tests. The design
reviewer owns the design-system contract and independently inspects the rendering.
No credentials, paid API execution, external publication or actual sign-out is
part of browser tests. Controlled providers exercise real Factory/Service APIs.
Run configured framework checks, inspect screenshots and the actual UI, review
independently, rebuild generated assets twice, then integrate the private repo.
A successful fixture journey does not qualify a second provider or prove a real
AI-built production SaaS. These limits remain in README and UI-DESIGN.
