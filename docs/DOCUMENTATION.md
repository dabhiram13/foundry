# The documentation website

The public site combines a React landing page with searchable Astro/Starlight
documentation.

## Sources and build

Repository Markdown is canonical. `site/content-map.mjs` selects active
Markdown sources; `scripts/prepare_site.mjs` generates Starlight pages, copies
public assets, builds Tailwind CSS and the standalone landing bundle. Edit the
source Markdown and components under `site/src/landing`, not generated pages in
`site/src/content/docs/docs` or assets in `site/public`.

The CSS build uses Tailwind's PostCSS plugin. Keep Tailwind and its plugin on
the same version.

The scoped `@expressive-code/core` override uses `postcss-nested` 7.0.2 to resolve
a vulnerable selector parser to patched 7.1.6. Remove it once Expressive Code's
own dependency range supports the patched parser.

Run the site checks from the repository root:

```sh
npm run typecheck:site
npm run build:site
npm run test:site
```

The tests validate generated pages, links, anchors, metadata, landing markup
and asset budgets. For website UI changes, also check desktop and mobile layouts,
keyboard navigation, search, theme controls and reduced motion.

## Navigation and links

The sidebar starts with Use Foundry: overview, installation, how it works and
command reference. More options, Develop Foundry itself and Security & licenses
are collapsed by default. Keep contributor builds and release commands out of
the beginner installation journey. Link to canonical repository sources.

Terminal setup and using OpenCode from source have separate guides. Make it clear
which version each needs; do not describe source features as part of npm 0.5.1.
The README uses the publicly served banner asset, like its badges. Check that
the URL is reachable without signing in; private GitHub raw URLs can return 404.

Use concise titles, descriptive links and direct answers. Each page has a
description in `site/content-map.mjs`. The build adds canonical URLs and a
sitemap using the production site origin in `site/astro.config.mjs`.

Previous and next links use compact text and padding with visible keyboard
focus. Long labels wrap, and links stack on small screens.
