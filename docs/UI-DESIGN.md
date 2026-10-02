# Foundry workspace design

Foundry uses a native, self-contained HTML/CSS/JavaScript interface so the same
workspace runs in the local browser and the bundled MCP panel. The redesign uses
a compact product rail, a clear current-stage surface, in-context artifact review,
and progressive disclosure for activity and settings without adding a React or
Tailwind runtime.

The owner selected [SAAS TEMPLATE in Figma](https://www.figma.com/design/ajpTGsvtbaQkO8Db7O2sXz/SAAS-TEMPLATE?node-id=30-16688)
as the visual source. This branch is an interaction draft, not the finished
Saasify adaptation. The file inventory confirms Welcome, Section Blocks, Full
Pages, and Styleguide pages. The linked Welcome-page node is a flattened image;
the Figma account reached its MCP tool limit before the other pages could be
inspected. No editable kit components or style-guide tokens have been imported.
The references below inform interaction behavior and implementation only.

The component and interaction references are:

- [shadcn/ui dashboard and sidebar blocks](https://ui.shadcn.com/blocks) for the
  workspace shell, responsive rail, and restrained component density.
- [Base UI accessibility approach](https://base-ui.com/react/overview/about) for
  keyboard, focus, and WAI-ARIA behavior.
- [Primer UI patterns](https://primer.style/product/ui-patterns/) for efficient
  developer-tool navigation, saving, empty, loading, and notification states.
- [Untitled UI application examples](https://www.untitledui.com/react/application-ui)
  as visual references only. Its paid assets are not bundled because its license
  restricts redistribution in builders and UI kits.

The visual direction is pending inspection of the selected SaaSify Premium Figma
source. The current logo is also a draft, not an adopted final mark. Its actual
generation prompt was: “single original app mark, uppercase F assembled from
three interlocking flat geometric pieces, solid vivid vermilion orange #F36A3E,
flat graphic, no words, shadows, gradients, or texture.” The draft is stored at
`app/assets/foundry-mark.png`; the build bundles it as a data URI in the offline
MCP panel.
