# The documentation website

The public site is a static Astro/Starlight landing page and searchable
documentation. It does not include the former workspace app, project state,
provider accounts, or a local HTTP service.

## Sources and build

Repository Markdown is canonical. `site/content-map.mjs` selects active
Markdown sources; `scripts/prepare_site.mjs` generates Starlight pages, copies
public assets, builds Tailwind CSS and the standalone landing bundle. Edit the
source Markdown and components under `site/src/landing`, not generated pages in
`site/src/content/docs/docs` or assets in `site/public`.

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
Security. Keep links directed at canonical repository sources. `docs/history/`
contains clearly labeled historical implementation and verification records,
not current documentation pages. Do not promote old UI evidence to a present
runtime claim.
