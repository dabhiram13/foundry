# Foundry visual system

The public identity uses engraved illustration, scarlet fields, near-black ink
and warm paper. It is a static, local-asset system, not a 3D scene or remote embed.
The owner approved the generated horse anchor and requested supporting scenes.

## Color and surfaces

| Token | Value | Use |
| --- | --- | --- |
| Scarlet | `#cd150c` | Primary actions, stage band, artwork |
| Ink | `#0a0a09` | Main canvas, paper-surface text |
| Paper | `#f0e6d3` | Main text, alternate reading surface |
| Oxide | `#70120e` | Hovered primary action |
| Stone | `#b8aa93` | Secondary text on ink |

Body copy sits on solid ink or paper, never over noisy artwork. Scarlet is not
used for small body copy on ink. Focus uses a high-contrast paper outline on ink
and ink on paper. Borders divide content; they are not the only state indicator.

## Type, geometry and interaction

- Cormorant Garamond 600: short editorial display lines and typeset SVG wordmark.
- Inter: body copy, navigation and controls. System monospace: metadata.
- Both web fonts are local, with retained SIL OFL licenses. No font service.
- Square controls and panels; one-pixel rules; no glass, gradients or pill cards.
- Minimum 44px touch targets. Native disclosures keep content usable without JS.
- Desktop uses two-column editorial composition. Below 760px it stacks, with
  full-frame illustration and no copy overlay. Target widths include 320px.
- Motion is limited to short control feedback. Artwork stays still. Reduced
  motion removes transitions, transforms and animated copy feedback.
- Docs reuse the palette and wordmark; long-form reading remains on solid
  surfaces, with both light and dark themes.

## Artwork and identity

| Scene | Purpose |
| --- | --- |
| Horse and metalworker | Hero and primary identity |
| Wide horse composition | Supporting layouts and design-system assets |
| Surveyor and valley | Research and planning |
| Hands, hammer and anvil | Design and implementation |
| Horse and worker on bridge | Review and handoff |

The texture is baked into the art, not a CSS noise layer. Serve local responsive
WebP files with dimensions and descriptive alt text. The hero loads eagerly;
supporting images load lazily. Preserve the complete scene instead of cropping
the horse or figures. Do not recolor or animate the artwork.

The favicon-sized mark is a simplified vector silhouette extracted from the
approved generated horse. It is intentionally quiet at small sizes; dense
engraving belongs in the large illustrations. The wordmark is outlined
Cormorant typesetting. README banner and social image reuse the same identity.
The self-contained README banner contains only the horse logo and Foundry
wordmark on ink, with a scarlet logo field. It has no tagline or stage labels.

## Provenance boundary

The anchor was AI-generated from the owner’s scarlet/black engraved references
as a new horse-and-metalworker composition. The wide version and supporting
scenes used the generated anchor as their visual input. No supplied reference
image is embedded in production or included in the generated-art collection.
Their reuse rights remain unconfirmed.

`site/assets/art/manifest.json` records master and derivative hashes, dimensions,
origins and the owner’s direction. Masters remain in the artwork working set;
only optimized derivatives ship with the site. This is provenance, not legal
clearance: generation does not guarantee copyright, trademark or exclusivity.
Publication, release and deployment remain separate owner decisions.

## Product copy boundary

The complete CLI story is Research → Plan → Design → Build → Review → Handoff.
The actual CLI names its final stages Test and Ship; Ship creates a local
handoff rather than deploying. Specialist roles are assignments executed through
the selected runtime, not automatically spawned independent agents.

Building from source adds Research → Plan approval → Design approval → Builders
→ Reviewer → local handoff inside OpenCode, with its existing model and tools.
This connection is not in npm 0.5.1 and has not been tested with a live model.
Homebrew is not available.
Keep those distinctions visible; checks are supporting evidence, not the product.
