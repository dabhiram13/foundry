# Foundry workspace design

Foundry uses genuine [shadcn/ui](https://ui.shadcn.com/) components, React, and
Tailwind. The October 3, 2026 request replaces the neutral Figtree foundation with
the owner-selected Soft studio design system, a paper idea sheet and a six-step
product desk. The workflow and accessible control behavior are preserved.
The earlier Tabler direction is superseded and its dependency and assets removed.
No paid Figma assets are included. [The design system](DESIGN-SYSTEM.md) owns the
layout, tokens, typography, component rules, responsive behavior, and skill usage.
Dependency and asset licenses are retained in
[app/DEPENDENCY-NOTICES.md](../app/DEPENDENCY-NOTICES.md).

A labeled global top bar groups products, creation and account controls. Products
open in a modal drawer instead of a persistent sidebar. The powder-blue canvas
contains a paper idea composer or one product's next step. Progress is a horizontal six-stage sequence; Documents
and Activity are tabs. Account, runtime, and specialist controls use accessible
Radix-backed shadcn dialogs. Review documents render as sanitized Markdown, with
approval tied to the exact scope/design bytes that the owner opened.

The monochrome vector mark at `app/assets/foundry-mark.svg` is the master logo.
Phosphor React supplies duotone interface icons with visible control labels.
Manrope Variable is bundled locally under SIL OFL; the original specialist
portraits are rendered unchanged. Earlier font/icon notices remain historical. The browser
and MCP panel run the same React application; the panel embeds its CSS, script,
font, mark, and tool bridge. There are no font, image, icon, or CSS CDN requests.

Edit `app/src/main.tsx` for composition and behavior, `app/src/workspace.css` for
product layout, and `app/src/globals.css` for semantic tokens. The owned shadcn
primitives are in `app/src/components/ui/`. Run `npm ci --ignore-scripts`,
`npx tsc --noEmit`, and `npm run build:panel`. Commit source and generated
`app/app.js`, `app/style.css`, and `app/panel.html` together.

![Earlier product workspace during the controlled browser test](images/foundry-product.png)

The image above records the earlier design and is a controlled test fixture,
not a live AI-built release or a screenshot of the October 3 redesign.

## What the checks establish

`tests/factory_browser.cjs` exercises creation, examples, navigation, account
controls with fake credentials, provider failure/retry/stop, owner review,
settings persistence/recovery, specialist overrides/inheritance, documents,
release handoff and the UI-to-MCP tool bridge. It uses real local Factory/Service
boundaries with a controlled provider. It checks desktop, 1024/900/768px tablet, 480/390/360px narrow layouts,
keyboard/focus, reduced motion, overflow, script errors and content sanitization.
Delayed document navigation, slow snapshots, out-of-order polling and repeated creation
are also covered. It does not prove live account access, AI product quality or public deployment.
The [neutral redesign verification record](NEUTRAL-UI-VERIFICATION.md) contains
historical screenshots and native-host qualification limits. The new direction
and acceptance criteria are in [the Folk-inspired spec](specs/folk-ui-redesign.md).
The configured framework checks also exercise execution, security boundaries and
the separate sample SaaS journey. Generated screenshots are in output/playwright/.

## Soft studio acceptance — October 3, 2026

The owner selected this visual direction and authorized live integration.
Acceptance of the finished app remains distinct from that direction decision.

| Criterion | Current evidence |
| --- | --- |
| UI-1: new visual and spatial system | Live introduction, idea composer, labeled top bar/product drawer, paper desk, review and settings use Manrope, Phosphor duotone icons and original portraits. Desktop Plan and 390/360px product captures reflect real fixture state. |
| UI-2: preserved local workflow | Real loopback app with isolated fake providers: fresh creation through Plan/Design approval and completed Ship; Build working/fixing/failed, normal retry, cancellation, exact-version rejection, settings persistence and inherited overrides. Scripted history, delayed navigation and MCP bridge checks passed. |
| UI-3: usable responsive interactions | 1440/1024/900/768/390/360px, actual 200% Chrome zoom, 44px mobile controls, drawer/dialog Escape and opener focus, scroll locking, long content, disclosures, reduced motion and no horizontal page overflow. |
| UI-4: repeatable checks | TypeScript, panel generation and the scripted factory journey passed after integration. The lifecycle CLI saves the final configured-check results separately in docs/built/. |
| UI-5: current rendered evidence | Fresh Research → Plan, approval → Design and failed Build → retry → Ship clear obsolete success feedback. A forced approval-success/run-start failure remains visible through two polls until an explicit retry. Reload/navigation produced no unexpected runtime/CSP errors or nonlocal asset requests. |

[Annotated current app recording](https://app.devin.ai/attachments/34ad209a-664d-4fca-a1a0-26c97aa7fae7/soft-studio-current-edited.mp4)
and [desktop Plan capture](https://app.devin.ai/attachments/f8431e6b-c65a-4b7d-95db-9ac02a6843ef/plan-desktop.png)
are saved with the [integration session](https://app.devin.ai/sessions/969df40425d44986a1b59a4259e93510).
The remaining unchanged interactions retain the earlier live integration checks;
the standalone comparison/prototype is not used as runtime proof.

Live accounts/providers, deployment/publishing, physical mobile hardware, native
MCP host rendering and exhaustive accessibility/security auditing were not checked.
The preserved provider-budget-exhausted recovery chain is a known separate
limitation, not a passing case or a behavior change in this redesign.

## Comparison and next proof

As observed on 2026-10-02, [BuildThisNow's public page](https://www.buildthisnow.com/)
describes a Claude Code harness, workflows, specialist agents, hooks, multi-product
desktop management, and a prewired SaaS skeleton including authentication and
payments. These are vendor descriptions; the protected documentation was not
fully accessible in this research pass.

| Area | Foundry's current position |
|---|---|
| Ownership and runtime | Local controller, separate product repositories, no BuildThisNow installation/update service needed to execute it. Retained source notices still apply. |
| Product flow | Research, scope, design, build, verify and release handoff; owner scope/design reviews and saved stage records. |
| Verification and recovery | Digest-bound approval, real configured checks, freshness/evidence gates, cancellation and retry. Covered by framework and controlled browser tests. |
| Specialists | 28 role configurations, inherited coordinator defaults and explicit model/reasoning overrides. Roles are instructions; this is not evidence of 28 simultaneous workers. |
| Provider flexibility | Codex execution is supplied; custom adapter contract exists. ChatGPT plan path is experimental and a second commercial provider is not qualified end to end. |
| Ready-made SaaS services | No claim of a universal production skeleton with fully connected auth, billing, email and storage. Each product still needs its service setup and tests. |
| Distribution | Private local plugin and browser UI. Public hosted multi-tenant plugin deployment is separate work. |
| Product quality | Full control-flow checks are repeatable. A completed live AI-built product and owner acceptance remain necessary proof. |

Foundry is tailored to this owner's workflow, but overall superiority is not yet
established. The next useful benchmark is one real product built from a fixed
brief: score acceptance criteria, successful user journeys, setup effort,
recovery from one failure, and the ability to maintain the result. Add a reusable
service recipe only after that product demonstrates the need and integration.

The earlier compact stage rail refinement, now superseded visually, is recorded in
[stage workspace verification](STAGE-WORKSPACE-VERIFICATION.md).
