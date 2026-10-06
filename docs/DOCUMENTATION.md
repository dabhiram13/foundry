# The documentation website

The public site is a static Astro/Starlight landing page and searchable
documentation. It does not store project state or connect provider accounts.

## Sources and build

Repository Markdown is canonical. `site/content-map.mjs` selects active
Markdown sources; `scripts/prepare_site.mjs` generates Starlight pages, copies
public assets, builds Tailwind CSS and the standalone landing bundle. Edit the
source Markdown and components under `site/src/landing`, not generated pages in
`site/src/content/docs/docs` or assets in `site/public`.

The one-time CSS build uses Tailwind's official PostCSS plugin, without the
Tailwind CLI's unused file-watching dependencies. Tailwind stays pinned to the
same version as its plugin.

The scoped `@expressive-code/core` override uses `postcss-nested` 7.0.2 to resolve
a vulnerable selector parser to patched 7.1.6. Remove it once Expressive Code's
own dependency range supports the patched parser. Site checks and generated-CSS
comparison cover this compatibility change; audit is not suppressed.

Run the site checks from the repository root:

```sh
npm run typecheck:site
npm run build:site
npm run test:site
```

The tests validate generated pages, links, anchors, landing markup and asset
budgets without a browser. The prescribed framework verification does not run
browser automation.

## Navigation and links

The sidebar follows Start, Daily use, Providers, Reference, Architecture and
Security. Keep links directed at canonical repository sources. Superseded
implementation notes and verification reports belong in Git history, not the
current documentation. Do not promote old UI evidence to a present runtime claim.
