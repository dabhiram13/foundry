import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { parse } from 'parse5';
import postcss from 'postcss';
import { descriptions, pages, pageUrl, root } from '../site/content-map.mjs';

const output = path.join(root, 'site/dist');
function walk(node, callback) {
  callback(node);
  for (const child of node.childNodes ?? []) walk(child, callback);
}
function attr(node, name) { return node.attrs?.find((attribute) => attribute.name === name)?.value; }
function textContent(node) { return node.value ?? (node.childNodes ?? []).map(textContent).join(''); }

test('README, setup guide and landing share the npm CLI installation', async () => {
  const tree = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  let commands;
  walk(tree, node => {
    if (attr(node, 'aria-label') === 'Installation commands') commands = textContent(node);
  });
  assert.ok(commands);
  assert.equal(commands, 'npm install -g @dabhiram13/foundry\nfoundry');
  const examples = [];
  walk(tree, node => { if (node.tagName === 'pre') examples.push(textContent(node)); });
  assert.deepEqual(examples, [commands], 'landing introduces installation, not advanced command examples');
  assert.doesNotMatch(commands, /git clone|npm run build|npm link|\.\/foundry/);
  for (const source of ['README.md', 'docs/GETTING-STARTED.md']) {
    const markdown = await readFile(path.join(root, source), 'utf8');
    assert.equal(/```sh\n([\s\S]*?)\n```/.exec(markdown)?.[1], commands, source);
  }
});

test('first-project guide separates terminal use from contributor setup', async () => {
  const guide = await readFile(path.join(root, 'docs/GETTING-STARTED.md'), 'utf8');
  assert.doesNotMatch(guide, /ignore-scripts|npm ci|npm run build|git clone|EXACT_REVISION/);
  for (const command of ['/new reading-list --idea "Save links and mark them read"',
    '/use reading-list', '/configure --billing subscription --confirmed', '/run', '/review', '/approve']) {
    assert.ok(guide.includes(command), `missing guided command: ${command}`);
  }
  assert.ok(guide.indexOf('## Create a project') < guide.indexOf('## Update or uninstall'));
  assert.match(guide, /Commands there start with\s+`\/`/);
  assert.match(guide, /--adapter PROVIDER/);
  assert.match(guide, /The provider you choose does the work/);
  assert.match(guide, /not inside Foundry/);
});

test('common public guides and landing copy do not require a specific provider', async () => {
  for (const file of ['README.md', 'docs/README.md', 'docs/GETTING-STARTED.md', 'docs/WORKFLOW.md', 'docs/CUSTOMIZATION.md', 'site/dist/index.html']) {
    const content = await readFile(path.join(root, file), 'utf8');
    assert.doesNotMatch(content, /codex|chatgpt|openai|claude|gemini/i, file);
  }
});

test('starting pages distinguish connected work from unfinished managed execution', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /not yet a complete standalone coding agent/);
  assert.match(readme, /Terminal adapters use a separate\s+process interface/);
  const workflow = await readFile(path.join(root, 'docs/WORKFLOW.md'), 'utf8');
  for (const term of ['## What works today', 'Foundry-managed PR creation', 'live spending cap', 'recursive self-improvement']) {
    assert.ok(workflow.includes(term), term);
  }
  const landing = textContent(parse(await readFile(path.join(output, 'index.html'), 'utf8')));
  assert.match(landing, /with your coding tool/);
  assert.match(landing, /Not a standalone coding workspace yet/);
  assert.match(landing, /PR follow-up are not available yet/);
  const provider = await readFile(path.join(root, 'docs/PROVIDERS.md'), 'utf8');
  for (const term of ['## OpenAI-compatible endpoints in OpenCode', 'no `foundry --base-url`', 'fake loopback', 'not Foundry, manages authentication']) {
    assert.ok(provider.includes(term), term);
  }
});

async function checkLocalLinks(tree, current) {
  const links = [];
  walk(tree, (node) => {
    const href = attr(node, 'href') ?? attr(node, 'src');
    if (href && /^(?:\/|#)/.test(href) && !href.startsWith('//')) links.push(href);
  });
  for (const href of links) {
    const url = new URL(href, `https://foundry.invalid${current}`);
    let target = path.join(output, decodeURIComponent(url.pathname));
    const info = await stat(target).catch(() => null);
    assert.ok(info, `${current}: missing ${href}`);
    if (info.isDirectory()) target = path.join(target, 'index.html');
    if (url.hash && target.endsWith('.html')) {
      let found = false;
      walk(parse(await readFile(target, 'utf8')), (node) => {
        if (attr(node, 'id') === decodeURIComponent(url.hash.slice(1))) found = true;
      });
      assert.ok(found, `${current}: missing anchor ${href}`);
    }
  }
}

test('every canonical documentation source produces a searchable linked page', async () => {
  for (const [source, slug] of pages) {
    const html = await readFile(path.join(output, pageUrl(slug), 'index.html'), 'utf8');
    const tree = parse(html);
    let headings = 0;
    let editLink = false;
    walk(tree, (node) => {
      if (node.tagName === 'h1') headings++;
      const href = attr(node, 'href');
      if (href === `https://github.com/dabhiram13/foundry/edit/main/${source}`) editLink = true;
    });
    assert.equal(headings, 1, `${source}: one page title`);
    assert.equal(editLink, false, `${source}: no public page-edit control`);
    assert.doesNotMatch(html, /Edit page|Edit this page|github\.com\/[^"\s]+\/edit\//);
    assert.match(html, /pagefind|Search/);
    await checkLocalLinks(tree, pageUrl(slug));
  }
});

test('README links readers to built public documentation pages', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /foundry providers PROJECT/);
  assert.doesNotMatch(readme, /foundry providers \./);
  const links = new Map([...readme.matchAll(/^\[([^\]]+)\]: (\S+)$/gm)]
    .map(([, name, href]) => [name, href]));
  const website = new URL(links.get('website'));
  assert.equal(website.protocol, 'https:');
  for (const name of ['documentation-index', 'getting-started', 'connected-client', 'release-guide']) {
    const link = new URL(links.get(name));
    assert.equal(link.origin, website.origin, `${name}: use public docs`);
    assert.ok(link.pathname.startsWith('/docs/'));
  }
  for (const href of links.values()) {
    const url = new URL(href);
    if (url.origin !== website.origin) continue;
    await checkLocalLinks(parse(`<a href="${url.pathname}${url.hash}"></a>`), '/');
  }
});

test('public landing is pre-rendered and does not load the workspace client', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  let heading;
  walk(parse(html), node => { if (attr(node, 'id') === 'landing-title') heading = node; });
  assert.ok(heading, 'the hero heading is server-rendered');
  assert.equal(textContent(heading), 'Build your idea.Keep control.');
  assert.match(html, /How Foundry works/);
  assert.match(html, /href="\/docs\/"/);
  assert.doesNotMatch(html, /foundry-token|src="\/app.js"|Open local browser view/);
  const script = await readFile(path.join(output, 'public.js'), 'utf8');
  assert.doesNotMatch(script, /\/api\/snapshot|X-Foundry-Token|foundry_snapshot/);
  assert.ok(gzipSync(script).byteLength <= 165_000, 'Public JS exceeds the 165 kB gzip budget');
  await checkLocalLinks(parse(html), '/');
});

test('landing CSS compiles utilities, local styles and font assets', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /<link[^>]+href="\/style\.css"/);
  const css = postcss.parse(await readFile(path.join(output, 'style.css'), 'utf8'));
  const selectors = new Set();
  css.walkRules(rule => selectors.add(rule.selector));
  for (const selector of ['.foundry-button', '.landing-page', '.landing-shell']) {
    assert.ok(selectors.has(selector), `missing compiled selector: ${selector}`);
  }
  css.walkAtRules(rule => {
    assert.ok(!['import', 'tailwind', 'apply', 'theme', 'source', 'custom-variant'].includes(rule.name),
      `uncompiled CSS directive: @${rule.name}`);
  });
  const fonts = [];
  css.walkAtRules('font-face', rule => rule.walkDecls('src', declaration => fonts.push(declaration.value)));
  assert.ok(fonts.some(value => value.includes('/assets/instrument-sans-latin.woff2')));
});

test('landing follows device motion preferences without a separate toggle', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const script = await readFile(path.join(output, 'public.js'), 'utf8');
  const css = await readFile(path.join(output, 'style.css'), 'utf8');
  for (const content of [html, script, css]) {
    assert.doesNotMatch(content, /Quiet motion|motion-toggle|motion-switch|foundry\.motion/);
  }
  assert.doesNotMatch(script, /MotionConfig|AnimatePresence|whileTap/);
  assert.match(css, /prefers-reduced-motion/);
});

test('mobile menu uses a compact icon inside an accessible touch target', async () => {
  const css = await readFile(path.join(root, 'site/src/styles/docs.css'), 'utf8');
  assert.match(css, /--sl-menu-button-size: 2\.75rem/);
  assert.match(css, /\.sl-menu-button\s*\{[^}]*background: transparent/s);
  assert.match(css, /\.sl-menu-button svg\s*\{[^}]*width: 1\.25rem; height: 1\.25rem/s);
  for (const slug of pages.values()) {
    const tree = parse(await readFile(path.join(output, pageUrl(slug), 'index.html'), 'utf8'));
    let menu;
    walk(tree, node => {
      if (node.tagName === 'button' && attr(node, 'popovertarget') === 'starlight__sidebar') menu = node;
    });
    assert.ok(menu, slug);
    assert.ok(textContent(menu).trim(), `${slug}: named menu button`);
  }
});

test('capsule header does not inherit the narrower responsive page shell', async () => {
  const tree = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  let headerInner;
  walk(tree, node => {
    if ((attr(node, 'class') || '').split(/\s+/).includes('header-inner')) headerInner = node;
  });
  assert.ok(headerInner);
  assert.equal((attr(headerInner, 'class') || '').split(/\s+/).includes('landing-shell'), false);
  const css = postcss.parse(await readFile(path.join(root, 'site/src/landing/landing.css'), 'utf8'));
  const inner = css.nodes.find(node => node.selector === '.header-inner');
  assert.ok(inner.nodes.some(node => node.prop === 'width' && node.value === '100%'));
  const page = css.nodes.find(node => node.selector === '.landing-page');
  assert.ok(page.nodes.some(node => node.prop === 'display' && node.value === 'flow-root'), 'header margin stays inside the textured page');
});

test('docs reduced-motion pagination overrides directional hover displacement', async () => {
  const css = postcss.parse(await readFile(path.join(root, 'site/src/styles/docs.css'), 'utf8'));
  let reset;
  css.walkAtRules('media', media => {
    if (!/prefers-reduced-motion:\s*reduce/.test(media.params)) return;
    media.walkRules(rule => { if (rule.selector === '.pagination-links a[rel]:hover svg') reset = rule; });
  });
  assert.ok(reset, 'reduced-motion hover reset retains rel attribute specificity');
  assert.ok(reset.nodes.some(node => node.prop === 'transform' && node.value === 'none'));
});

test('landing keeps the example compact and links to the specialist catalog', async () => {
  const tree = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  let catalog = false;
  let duplicatedRoles = false;
  walk(tree, node => {
    if (attr(node, 'id') === 'landing-specialists') duplicatedRoles = true;
    if (attr(node, 'href') === '/docs/catalog/') catalog = true;
  });
  assert.ok(catalog);
  assert.equal(duplicatedRoles, false);
});

test('README banner contains only the Foundry logo and name on a self-contained background', async () => {
  const banner = await readFile(path.join(root, 'site/assets/foundry-banner.svg'), 'utf8');
  const wordmark = await readFile(path.join(root, 'site/assets/foundry-wordmark.svg'), 'utf8');
  const logoPath = /<path d="([^"]+)"/.exec(wordmark)?.[1];
  assert.ok(logoPath);
  assert.ok(banner.includes(logoPath));
  assert.match(banner, /<rect[^>]+fill="#f5f3f0"/);
  assert.match(banner, /Instrument Sans outlines/);
  assert.doesNotMatch(banner, /<script|<image|<foreignObject|<text\b/);
  assert.doesNotMatch(banner, /Research|Plan|Design|Build|Review|Handoff|framework for building|YOUR AI|YOUR CODE|OPEN SOURCE/);
  assert.match(banner, /<title>Foundry<\/title>/);
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const images = [];
  walk(parse(readme), node => {
    if (node.tagName === 'img') {
      images.push(attr(node, 'src'));
      if (images.length === 1) assert.equal(attr(node, 'alt'), 'Foundry');
    }
  });
  assert.equal(images[0], 'https://foundry-two-tan.vercel.app/assets/foundry-banner.svg');
  assert.equal(images.length, 6);
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  for (const [name, value] of [['ci', 'checks'], ['npm', `v${manifest.version}`], ['node', manifest.engines.node.replaceAll('<', '&lt;').replaceAll('>', '&gt;')], ['license', manifest.license], ['docs', 'read']]) {
    const url = `https://foundry-two-tan.vercel.app/assets/badge-${name}.svg`;
    assert.ok(images.includes(url));
    const badge = await readFile(path.join(output, new URL(url).pathname), 'utf8');
    assert.ok(badge.includes(value));
    assert.match(badge, /role="img" aria-label=/);
    assert.doesNotMatch(badge, /<script|<image|<foreignObject|passing/);
  }
  assert.equal(await readFile(path.join(output, 'assets/foundry-banner.svg'), 'utf8'), banner);
  const mark = await readFile(path.join(root, 'site/assets/foundry-mark.svg'), 'utf8');
  const horsePath = /<path d="([^"]+)"/.exec(mark)?.[1];
  assert.ok(horsePath && banner.includes(horsePath), 'banner retains the approved horse mark');
  assert.match(banner, /viewBox="0 0 1200 260"/);
  const [, width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(wordmark).map(Number);
  assert.ok(width > height && height > 0, 'outlined wordmark has valid bounds');
  const scale = 76 / height;
  const groupWidth = 134 + width * scale;
  assert.ok(groupWidth < 1200 && 104 < 260, 'centered identity fits within the banner');
  assert.match(wordmark, /Instrument Sans outlines, SIL OFL 1\.1/);
  assert.doesNotMatch(banner + wordmark, /Cormorant|#cd150c/);
  assert.match(readme, /^\[license\]: https:\/\/github\.com\/dabhiram13\/foundry\/blob\/main\/LICENSE$/m);
  assert.doesNotMatch(readme, /^\[[^\]]+\]: (?!https?:\/\/)\S+/m);
  assert.doesNotMatch(readme, /\]\((?!https?:\/\/|#)[^)]+\)/);
});

test('public pages have unique descriptions, production canonicals and share metadata', async () => {
  const seenDescriptions = new Set();
  const seenTitles = new Set();
  for (const url of ['/', ...[...pages.values()].map(pageUrl)]) {
    const tree = parse(await readFile(path.join(output, url, 'index.html'), 'utf8'));
    const metadata = new Map();
    const canonicals = [];
    let title;
    walk(tree, node => {
      if (node.tagName === 'title') title = textContent(node);
      if (node.tagName === 'meta') metadata.set(attr(node, 'name') ?? attr(node, 'property'), attr(node, 'content'));
      if (node.tagName === 'link' && attr(node, 'rel') === 'canonical') canonicals.push(attr(node, 'href'));
    });
    assert.deepEqual(canonicals, [`https://foundry-two-tan.vercel.app${url}`], url);
    assert.ok(title && !seenTitles.has(title), `${url}: unique title`);
    seenTitles.add(title);
    const description = metadata.get('description');
    assert.ok(description?.length >= 50 && description.length <= 180, `${url}: concise description`);
    assert.ok(!seenDescriptions.has(description), `${url}: unique description`);
    seenDescriptions.add(description);
    assert.equal(metadata.get('og:description'), description, url);
    assert.equal(metadata.get('og:title'), url === '/' ? title : title.replace(/ \| Foundry docs$/, ''), url);
    assert.equal(metadata.get('og:url'), canonicals[0], url);
    assert.ok(!metadata.get('robots')?.includes('noindex'), url);
    if (url !== '/') {
      const slug = [...pages.values()].find(slug => pageUrl(slug) === url);
      assert.equal(description, descriptions[slug]);
    }
  }
});

test('sitemap and robots expose every public page at the production origin', async () => {
  const origin = 'https://foundry-two-tan.vercel.app';
  const robots = await readFile(path.join(output, 'robots.txt'), 'utf8');
  assert.equal(robots, `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`);
  const index = await readFile(path.join(output, 'sitemap-index.xml'), 'utf8');
  const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url));
  assert.ok(sitemaps.length);
  let xml = '';
  for (const url of sitemaps) {
    assert.equal(url.origin, origin);
    xml += await readFile(path.join(output, url.pathname), 'utf8');
  }
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  for (const url of ['/', ...[...pages.values()].map(pageUrl)]) assert.ok(urls.includes(origin + url), url);
  assert.ok(urls.every(url => url.startsWith(origin + '/') && !url.includes('/404')));
});

test('landing structured data describes the visible application without invented ratings', async () => {
  const tree = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  const data = [];
  walk(tree, node => {
    if (node.tagName === 'script' && attr(node, 'type') === 'application/ld+json') data.push(JSON.parse(textContent(node)));
  });
  assert.equal(data.length, 1);
  assert.equal(data[0]['@type'], 'SoftwareApplication');
  assert.equal(data[0].name, 'Foundry');
  assert.equal(data[0].downloadUrl, 'https://www.npmjs.com/package/@dabhiram13/foundry');
  assert.equal(data[0].aggregateRating, undefined);
});

test('public copy uses ordinary punctuation and excludes conversational status notes', async () => {
  for (const source of ['README.md', ...pages.keys()]) {
    const markdown = await readFile(path.join(root, source), 'utf8');
    assert.doesNotMatch(markdown, /[\u2013\u2014]/, source);
    assert.doesNotMatch(markdown, /macOS and Windows.*verified|No new live-provider|No Python REPL|not a running agent swarm/, source);
  }
  for (const url of ['/', ...[...pages.values()].map(pageUrl)]) {
    const tree = parse(await readFile(path.join(output, url, 'index.html'), 'utf8'));
    walk(tree, node => {
      if (node.tagName === 'main' || node.tagName === 'title') assert.doesNotMatch(textContent(node), /[\u2013\u2014]/, url);
    });
  }
});

test('docs pagination retains labeled previous and next destinations', async () => {
  for (const slug of pages.values()) {
    const tree = parse(await readFile(path.join(output, pageUrl(slug), 'index.html'), 'utf8'));
    const links = [];
    walk(tree, node => {
      if (node.tagName === 'a' && ['prev', 'next'].includes(attr(node, 'rel'))) links.push(node);
    });
    assert.ok(links.length >= 1 && links.length <= 2, slug);
    for (const link of links) {
      assert.ok(textContent(link).trim(), slug);
      assert.notEqual(attr(link, 'href'), pageUrl(slug), slug);
    }
  }
  const css = await readFile(path.join(root, 'site/src/styles/docs.css'), 'utf8');
  assert.match(css, /\.pagination-links a\s*\{[^}]*min-height: 44px/s);
  assert.match(css, /\.pagination-links \.link-title\s*\{[^}]*font-size: \.9375rem/s);
});

test('documentation tables remain semantic and keyboard-focusable for horizontal scrolling', async () => {
  let tables = 0;
  for (const slug of pages.values()) {
    const tree = parse(await readFile(path.join(output, pageUrl(slug), 'index.html'), 'utf8'));
    walk(tree, node => {
      if (node.tagName !== 'table') return;
      tables++;
      assert.equal(attr(node, 'tabindex'), '0', slug);
      assert.equal(attr(node, 'role'), undefined, `${slug}: keep native table semantics`);
      assert.ok(node.childNodes.some(child => child.tagName === 'thead'), slug);
    });
  }
  assert.ok(tables > 0);
});

test('docs standalone search and code-copy targets retain 44px bounds in both input modes', async () => {
  const css = await readFile(path.join(root, 'site/src/styles/docs.css'), 'utf8');
  for (const selector of ['site-search > button', '.expressive-code .copy button']) {
    const rule = css.slice(css.indexOf(selector + ' {')).split('}')[0];
    assert.match(rule, /min-width: 44px/, selector);
    assert.match(rule, /min-height: 44px/, selector);
  }
  assert.match(css, /\.expressive-code \.frame \.ec-line \.code\s*\{[^}]*padding-inline-end: calc\(44px \+ 1rem\)/);
});

test('docs brand compacts its separator on narrow phones while keeping both links touchable', async () => {
  const source = await readFile(path.join(root, 'site/src/components/SiteTitle.astro'), 'utf8');
  assert.match(source, /a \{[^}]*min-height: 44px/);
  assert.match(source, /\.docs-label \{[^}]*flex-shrink: 0[^}]*min-width: 44px/);
  assert.match(source, /@media \(max-width: 25rem\)[\s\S]*\.foundry-docs-brand > span \{ display: none;/);
  assert.doesNotMatch(source, /\.docs-label \{[^}]*display: none/);
});

test('docs search uses a content-sized capsule rather than a full-width input-shaped trigger', async () => {
  const css = postcss.parse(await readFile(path.join(root, 'site/src/styles/docs.css'), 'utf8'));
  const trigger = css.nodes.find(node => node.selector === 'site-search > button');
  const declarations = new Map(trigger.nodes.map(node => [node.prop, node.value]));
  assert.equal(declarations.get('width'), 'max-content');
  assert.equal(declarations.get('height'), '44px');
  assert.equal(declarations.get('border-radius'), '999px');
  assert.equal(declarations.get('background'), 'transparent');
  const face = css.nodes.find(node => node.selector === 'site-search > button::before');
  assert.ok(face.nodes.some(node => node.prop === 'inset' && node.value === '4px 0'));
  const theme = css.nodes.find(node => node.selector === 'starlight-theme-select select');
  assert.ok(theme.nodes.some(node => node.prop === 'height' && node.value === '44px'));
  assert.ok(theme.nodes.some(node => node.prop === 'padding-block' && node.value === '0'));
  const brand = await readFile(path.join(root, 'site/src/components/SiteTitle.astro'), 'utf8');
  assert.match(brand, /\.docs-label::before\s*\{[^}]*inset: 4px 0/);
  for (const slug of pages.values()) {
    const tree = parse(await readFile(path.join(output, pageUrl(slug), 'index.html'), 'utf8'));
    let search;
    walk(tree, node => { if (node.tagName === 'button' && attr(node, 'data-open-modal') !== undefined) search = node; });
    assert.ok(search, slug);
    assert.equal(attr(search, 'aria-label'), 'Search');
    assert.equal(attr(search, 'aria-keyshortcuts'), 'Control+K');
  }
});

test('manual workflow has named tabs, a labeled initial panel and honest connection boundaries', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const tree = parse(html);
  const stages = [];
  const faqs = [];
  let mobileMenu;
  let panel;
  walk(tree, node => {
    if (attr(node, 'role') === 'tab') stages.push(node);
    if (attr(node, 'role') === 'tabpanel') panel = node;
    if (node.tagName !== 'details') return;
    const summary = node.childNodes.find(child => child.tagName === 'summary');
    assert.ok(summary && textContent(summary).trim(), 'native disclosures have names');
    if (attr(node, 'class') === 'mobile-menu') mobileMenu = node;
    if (textContent(summary).replace(/[+−]\s*$/, '').trim().endsWith('?')) faqs.push(node);
  });
  assert.equal(stages.length, 6);
  const labels = stages.map(node => {
    let label;
    walk(node, child => { if (child.tagName === 'strong') label = textContent(child); });
    return label;
  });
  assert.deepEqual(labels, ['Research', 'Plan', 'Design', 'Build', 'Review', 'Handoff']);
  assert.equal(stages.filter(node => attr(node, 'aria-selected') === 'true').length, 1);
  assert.equal(stages.filter(node => attr(node, 'tabindex') === '0').length, 1);
  assert.equal(attr(panel, 'aria-labelledby'), attr(stages[0], 'id'));
  assert.match(textContent(panel), /Define the problem/);
  for (const stage of stages) {
    assert.equal(attr(stage, 'type'), 'button');
    assert.equal(attr(stage, 'aria-controls'), attr(panel, 'id'));
    assert.ok(stage.childNodes.some(child => attr(child, 'class') === 'stage-surface'), 'each stage has an inset selected face');
  }
  const source = await readFile(path.join(root, 'site/src/landing/components/product-walkthrough.tsx'), 'utf8');
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) assert.ok(source.includes(`'${key}'`));
  assert.doesNotMatch(source, /setInterval|setTimeout/);
  assert.match(source, /Approve desktop, mobile and error states/);
  assert.equal(faqs.length, 5);
  assert.ok(mobileMenu);
  assert.match(textContent(mobileMenu), /How it worksInstallDocumentation/);
  assert.match(textContent(tree), /A built-in browser workspace and PR follow-up are not available yet/);
  assert.match(textContent(tree), /Not in npm 0\.5\.1/);
  assert.match(textContent(tree), /Managed workspace\s+In development/);
  assert.match(textContent(tree), /Example, not a live session/);
  assert.doesNotMatch(html, /full specialist journey is not yet exposed/);
  assert.match(html, /Not a standalone coding workspace yet/);
  assert.match(html, /Handoff saves a local summary; it does not publish/);
  assert.doesNotMatch(html, /<iframe|Imageory|Spline|WORKFLOW \/ STUDIO BOOKING|live-indicator/);
  const canvases = [];
  walk(tree, node => { if (node.tagName === 'canvas') canvases.push(node); });
  assert.equal(canvases.length, 1);
  assert.equal(attr(canvases[0], 'aria-hidden'), 'true');
});

test('connected setup is reachable and keeps source, checks and owner approval explicit', async () => {
  assert.equal(pages.get('docs/CONNECTED-CLIENT.md'), 'connected-client');
  const guide = await readFile(path.join(root, 'docs/CONNECTED-CLIENT.md'), 'utf8');
  for (const command of ['npm ci --ignore-scripts', 'npm run build:runtime',
    './foundry init --project', './foundry connect opencode --project',
    './foundry setup --project', 'foundry_apply_setup',
    '--dry-run', '--apply', '--remove', './foundry work review --project',
    './foundry work approve --revision HASH', './foundry work context --project']) {
    assert.ok(guide.includes(command), `missing connected setup: ${command}`);
  }
  assert.match(guide, /not in npm 0\.5\.1/);
  assert.match(guide, /Repeat review and approval for the new revision/);
  assert.match(guide, /Every declared input path must exist/);
  assert.match(guide, /zero-test command/);
  assert.match(guide, /Do not build the\s+demo inside/);
  const sidebar = await readFile(path.join(root, 'site/astro.config.mjs'), 'utf8');
  assert.match(sidebar, /slug: 'docs\/connected-client'/);
  const landing = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  const connections = [];
  walk(landing, node => { if (attr(node, 'href') === '/docs/connected-client/') connections.push(node); });
  assert.ok(connections.length, 'landing links directly to the owner-facing connection guide');
});

test('active guides reject obsolete connected-journey and distribution claims', async () => {
  for (const source of ['README.md', ...pages.keys()]) {
    const markdown = await readFile(path.join(root, source), 'utf8');
    assert.doesNotMatch(markdown, /not the\s+whole specialist journey|full specialist journey is not yet exposed/, source);
    assert.doesNotMatch(markdown, /\bbrew\s+install\b/, `${source}: no nonexistent Homebrew install command`);
  }
});

test('public introductions use plain words instead of AI slogans and runtime jargon', async () => {
  const forbidden = /Give your AI|Your AI does the|framework for your AI|AI-assisted work|source-preview client connection|second AI runtime|live model-driven.*unqualified|Less improvisation|More intention|The work takes shape/i;
  for (const source of ['README.md', 'docs/README.md', 'docs/GETTING-STARTED.md',
    'docs/CONNECTED-CLIENT.md', 'site/src/landing/components/landing.tsx',
    'site/src/landing/components/product-walkthrough.tsx', 'site/src/pages/index.astro',
    'site/content-map.mjs']) {
    assert.doesNotMatch(await readFile(path.join(root, source), 'utf8'), forbidden, source);
  }
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /research, planning, design, coding and review/);
  assert.match(readme, /not in npm 0\.5\.1/);
  assert.match(readme, /new\s+visual workflow has local test coverage, not a live-model trial/);
  assert.match(readme, /running app preview, components and captured mobile\/desktop states/);
  assert.match(readme, /Service work needs no images/);
});

test('warm public system uses original texture and local licensed typography without a shader runtime', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const script = await readFile(path.join(output, 'public.js'), 'utf8');
  const css = await readFile(path.join(output, 'style.css'), 'utf8');
  assert.match(css, /instrument-sans-latin\.woff2/);
  assert.doesNotMatch(html + css + script, /assets\/art\/|cormorant-garamond|MotionConfig|AnimatePresence/);
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic|https:\/\/.*\.(?:woff2|ttf)/);
  const source = await readFile(path.join(root, 'site/src/landing/landing.css'), 'utf8');
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /min-height: 44px/);
  assert.match(source, /workbench-texture\.svg/);
  assert.match(source, /workbench-halftone\.webp/);
  const halftone = await readFile(path.join(output, 'assets/workbench-halftone.webp'));
  assert.equal(halftone.toString('ascii', 8, 12), 'WEBP');
  assert.ok(halftone.byteLength < 900_000, 'original halftone stays below 900 kB');
  assert.match(source, /background-size: 5px 5px/);
  assert.doesNotMatch(html + css + script, /lightsprint\.ai\/(?:images|_ploy_static)|Suisse|PaperShader|OpticalSignal/);
  const texture = await readFile(path.join(output, 'assets/workbench-texture.svg'), 'utf8');
  assert.match(texture, /feTurbulence/);
  assert.doesNotMatch(texture, /<image|<script|<foreignObject|href="https?:/);
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.devDependencies.motion, undefined);
  assert.equal(manifest.devDependencies['tw-animate-css'], undefined);
  for (const asset of ['assets/art', 'assets/cormorant-garamond-latin-600.ttf', 'assets/animate-ui.LICENSE.md']) {
    assert.equal(await stat(path.join(output, asset)).catch(() => null), null, `${asset}: not shipped`);
  }
  assert.ok(gzipSync(script).byteLength < 100_000, 'warm public JS stays below 100 kB gzip');
});

test('original text wave and floating navigation preserve native content and cleanup', async () => {
  const wave = await readFile(path.join(root, 'site/src/landing/components/dot-wave-text.tsx'), 'utf8');
  for (const behavior of ['prefers-reduced-motion: reduce', 'document.fonts.ready', 'ResizeObserver', 'IntersectionObserver', 'cancelAnimationFrame', 'document.hidden', 'observer.disconnect()', 'resize.disconnect()', 'aria-hidden="true"']) assert.ok(wave.includes(behavior), behavior);
  assert.match(wave, /<span>\{text\}<\/span>/);
  assert.match(wave, /const width = Math.ceil\(bounds.width\);/);
  assert.match(wave, /surface!\.style\.width = `\$\{bounds.width\}px`/);
  assert.doesNotMatch(wave, /setInterval|fetch\(/);
  const header = await readFile(path.join(root, 'site/src/landing/components/header-nav.tsx'), 'utf8');
  for (const behavior of ['offsetLeft', 'offsetWidth', '--reading-progress', 'removeEventListener', 'observer.disconnect()', "aria-current={current === index ? 'location'"]) assert.ok(header.includes(behavior), behavior);
  const css = await readFile(path.join(root, 'site/src/landing/landing.css'), 'utf8');
  const canvas = postcss.parse(css).nodes.find(node => node.selector === '.dither-text canvas');
  assert.ok(canvas.nodes.some(node => node.prop === 'display' && node.value === 'none'), 'settled decorative canvas has no overflow box');
  const selected = postcss.parse(css).nodes.find(node => node.selector?.startsWith(".walkthrough-stages button[aria-selected='true'],"));
  assert.ok(selected);
  assert.equal(selected.nodes.some(node => /background|box-shadow|border-color/.test(node.prop)), false, 'no filled or boxed selected workflow row');
  const surface = postcss.parse(css).nodes.find(node => node.selector === '.stage-surface');
  assert.ok(surface.nodes.some(node => node.prop === 'inset' && node.value === '5px 0'), 'pill face is inset inside the 44px target');
  const selectedSurface = postcss.parse(css).nodes.find(node => node.selector?.startsWith(".walkthrough-stages button[aria-selected='true'] .stage-surface"));
  assert.ok(selectedSurface.nodes.some(node => node.prop === 'background' && node.value === '#fff0df'), 'selected state has an ivory capsule');
  const workflow = await readFile(path.join(root, 'site/src/landing/components/product-walkthrough.tsx'), 'utf8');
  assert.ok(workflow.indexOf('role="tablist"') < workflow.indexOf('role="tabpanel"'), 'tablist precedes its panel in focus order');
  assert.doesNotMatch(workflow, /ChevronRight|LockKeyhole|Circle|Studio booking|live-indicator/);
});

test('shared palette has readable body, primary, link, error and focus contrast in both themes', async () => {
  const luminance = hex => {
    const rgb = hex.match(/[0-9a-f]{2}/g).map(part => parseInt(part, 16) / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return rgb.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  };
  const palettes = [];
  postcss.parse(await readFile(path.join(root, 'site/src/styles/tokens.css'), 'utf8')).walkRules(rule => {
    const palette = new Map();
    rule.walkDecls(decl => palette.set(decl.prop, decl.value.replace('#', '')));
    palettes.push(palette);
  });
  const pairs = palettes.flatMap(palette => [
    ['--foreground', '--background'], ['--muted-foreground', '--background'],
    ['--muted-foreground', '--card'], ['--primary-foreground', '--primary'],
    ['--primary', '--background'], ['--destructive', '--card'], ['--ring', '--background'],
  ].map(([foreground, background]) => [palette.get(foreground), palette.get(background)]));
  // Cover the painted button faces, not just the semantic tokens.
  pairs.push(['ffffff', 'b83b13'], ['ffffff', 'a8330f'], ['241912', 'ffad78'], ['241912', 'ff9f67']);
  for (const [foreground, background] of pairs) {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((light + .05) / (dark + .05) >= 4.5, `${foreground} on ${background}: body contrast`);
  }
  const license = await readFile(path.join(output, 'assets/licenses/Inter-OFL.txt'), 'utf8');
  assert.match(license, /SIL OPEN FONT LICENSE/);
  assert.match(await readFile(path.join(output, 'assets/licenses/InstrumentSans-OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE/);
});

test('landing theme and tactile controls share docs preference and preserve explicit states', async () => {
  const tree = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  const themeButtons = [];
  walk(tree, node => { if (['Light mode', 'Dark mode'].includes(attr(node, 'aria-label'))) themeButtons.push(node); });
  assert.equal(themeButtons.length, 2);
  assert.equal(themeButtons.filter(node => attr(node, 'aria-pressed') === 'true').length, 1);
  const theme = await readFile(path.join(root, 'site/src/landing/components/theme-toggle.tsx'), 'utf8');
  assert.match(theme, /starlight-theme/);
  assert.match(theme, /removeEventListener/);
  const controls = await readFile(path.join(root, 'site/src/landing/controls.css'), 'utf8');
  for (const state of [':hover', ':active', ':focus-visible', ':disabled']) assert.ok(controls.includes(state));
  assert.match(controls, /inset 0 1px/);
  assert.match(controls, /prefers-reduced-motion/);
  const copy = await readFile(path.join(root, 'site/src/landing/components/ui/copy-button.tsx'), 'utf8');
  for (const state of ['idle', 'copying', 'copied', 'error', 'unavailable']) assert.ok(copy.includes(`'${state}'`));
});

test('share artwork and SVG identity are self-contained and clearly attributed', async () => {
  const tree = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  const metadata = new Map();
  walk(tree, node => { if (node.tagName === 'meta') metadata.set(attr(node, 'name') ?? attr(node, 'property'), attr(node, 'content')); });
  assert.equal(metadata.get('og:image'), 'https://foundry-two-tan.vercel.app/assets/foundry-share.png');
  assert.equal(metadata.get('twitter:card'), 'summary_large_image');
  assert.equal(metadata.get('og:image:width'), '1200');
  const image = await readFile(path.join(output, 'assets/foundry-share.png'));
  assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], [1200, 630]);
  for (const file of ['foundry-mark.svg', 'foundry-wordmark.svg', 'foundry-wordmark-ink.svg', 'foundry-banner.svg']) {
    const svg = await readFile(path.join(output, 'assets', file), 'utf8');
    assert.match(svg, /<title>/);
    assert.doesNotMatch(svg, /<image|<script|<foreignObject|href="https?:/);
    assert.match(svg, /(?:Not a|No) trademark-clearance claim/);
  }
});
