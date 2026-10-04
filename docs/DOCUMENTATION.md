# The documentation website

The public site combines Foundry's existing landing design with searchable static
documentation at `/docs/`. Reading it does not require a Foundry account, an AI
connection or the local project service. Search runs in the browser over a built
index; it does not send queries to an AI provider.

## Build and preview

From a contributor checkout with Node.js 24 LTS:

```sh
npm ci
npm run build:panel
npm run build:site
npm run test:site
npm run preview:site
```

Open the local address printed by the preview command. This serves static files
only; it does not start the local workspace API, initialize products, connect an
account or start AI work. No production deployment is configured or implied.

The legacy local browser service can serve the built docs too. When the static
site has not been built, its docs link falls back to the repository's docs index.

## One source, two reading experiences

Repository Markdown remains the source. The build copies public pages from
`docs/`, `CONTRIBUTING.md`, `SECURITY.md` and `THIRD_PARTY_NOTICES.md`, adds page
metadata and renders them through Astro Starlight. Edit links point back to the
original file. Links between included pages become local docs URLs; code and
reference-library links stay in the repository.

Do not edit generated files under `site/src/content/docs/`, `site/public/`,
`site/.generated/` or `site/dist/`. The generated public page reuses the existing
landing component, but never imports the workspace client or polls its API.

## Before publishing a change

Check the generated pages, code examples, navigation, search, keyboard focus and
mobile layout. `test:site` checks internal page links and anchors plus the public
landing's separation from the workspace client. With the contributor Python
environment and Playwright browser installed, run `npm run test:docs-browser` to
check search, result navigation and mobile menus against both the static site and
the local browser service's content security policy. These checks cannot determine
whether an installation recipe works on every platform or whether an AI provider
is qualified.

Keep support claims aligned with actual tests. Document preview runtimes as
previews, failed checks as failures and untested live integrations as untested.
