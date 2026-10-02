# Foundry neutral UI redesign

Owner-authorized implementation, 2026-10-02. Baseline main b4d8da4b1f4251c08f6bb09a2978e395ace57a90; initial tree clean. This updates the existing React/shadcn standalone app and shared MCP panel. The owner subsequently authorized the selected option 3 refinement, commit and push of this scoped redesign, and exact-commit GitHub CI verification. Deployment, credential changes, purchases and real provider runs remain outside scope.

## Source of truth

Approved Library neutral board libfile_7f73bf5263588191a21ce010255c7d99, four-page specification libfile_974aefc90538819182eebcf883feadbf, JSON libfile_d6ec73b71ad08191b08ea84b4305e11d and CSS libfile_0ea83bce98788191ab78329b2d657a9b. Materialized and inspected locally under /Users/sridurga/Documents/Codex/2026-10-02/task/design-inputs. All supersede prior rejected purple/layout/logo proposals. Bot reference libfile_cc980e9c7be881919572caa56e14b784 is identity/art direction only. Keep canonical Foundry mark.

## Acceptance criteria

- NF-1: Exact achromatic foundation tokens, self-hosted Figtree 400/500/600, Lucide 24/2 source geometry, semantic statuses with icon/text. White surfaces, #F1F1F1 canvas, decorative #D4D4D4 rules distinct from functional #777777 boundaries. No default shadow/texture.
- NF-2: Original responsive landing page with truthful product claims and real workspace/create CTA. Existing product sidebar, entry, overview, six stages, documents/activity and account/runtime/specialist settings use coherent foundation.
- NF-3: Distinct labeled plush identities for all 28 actual roles through silhouette/accessories; idle rosters static. Roles are guidance/configurations, never claimed as live agents without runtime evidence. Existing free MIT bot-avatars may be adapted and exported with attribution.
- NF-4: Feedback125/icon160/avatar180/selection220/completion240/reveal300ms interactions, transform/opacity preferred. Reducedmotion shows instant static final state. Stable approval controls and readable logs.
- NF-5: Preserve API request contracts, duplicate-action guard, exact document revision approval, sanitization, persistent state/provider errors, failed-settings draft, stop/retry and dialog keyboard focus. Cover loading/empty/error/recovery and navigation/back/cancel.
- NF-6: Build standalone/panel from same React, inline all fonts/assets, prove reproducibility. Inspect desktop1440/tablet1024+768/mobile480+390/narrow360 panel, 200% zoom, contrast/focus/reducedmotion and narrow performance.
- NF-7: Fresh typecheck, behavior/framework tests, cold aggregate, meaningful browser journeys and independent code/design review. Save actual screenshots and short real UI recording where supported. Native installed-host qualification remains separate if unavailable.

## Scope and invariants

Owned source: app/src, required assets/font/licenses, reproducible build script, UI tests, design/source docs. Backend/controller/provider semantics unchanged. Use existing server loopback only. Browser test fixtures may use isolated temporary products and controlled runtime doubles; do not execute a real provider or mutate owner product work.

## Sequence

1. Establish baseline/assets (done; see verification report for command outcomes).
2. Integrate tokens and source-safe motion; implement landing and responsive workflow/role components.
3. Rebuild, inspect actual renders and exercise paths; repair findings.
4. Independent specification/engineering review, final aggregate and reviewable handoff.

## Approved stage refinement, 2026-10-02

The owner selected refined option 3 (`libfile_b9f75ed9a7c88191974a50742ff2e913`, version 1) and rejected its persistent black left selection bar in `libfile_2f625c6386bc8191822dc27712d9e26a`, version 0, 422×154. Both were materialized and their exact pixels viewed locally. This amendment reuses the approved neutral foundation and existing UX handoffs.

- NF-8: Compact vertical stage rail on wide layouts, approximately 200px wide with 56px rows and 22px markers. Selected rows use a subtle gray background, label weight, truthful status and accessible current/pressed semantics. No persistent selection stripe, heavy selected box, or replacement connector line. Keyboard focus remains clearly visible. Narrow layouts keep 56px rows in a horizontally scrollable stage region without page overflow.
- NF-9: One white right work panel with a fine border, 12px radius, clear stage header, 24px body padding, light action band and separated document section. Inspecting a previous/upcoming stage changes that panel and its guidance without mutating the runtime or granting approval. Other active navigation uses the same quiet selection language.
- NF-10: Review all scoped original redesign files, preserve unrelated/ignored local state, rebuild both outputs, run fresh relevant and aggregate checks, then commit/push main only with a safe fast-forward. Verify the remote SHA and its terminal GitHub workflow outcome.
