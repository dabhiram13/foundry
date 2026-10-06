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
  assert.match(guide, /Install and sign in to Codex separately/);
  assert.match(guide, /not inside Foundry/);
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
  for (const name of ['documentation-index', 'getting-started', 'release-guide']) {
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
  assert.match(html, /Build software<br\/>/);
  assert.match(html, /from your terminal/);
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
  for (const selector of ['.flex', '.landing-page', '.landing-shell']) {
    assert.ok(selectors.has(selector), `missing compiled selector: ${selector}`);
  }
  css.walkAtRules(rule => {
    assert.ok(!['import', 'tailwind', 'apply', 'theme', 'source', 'custom-variant'].includes(rule.name),
      `uncompiled CSS directive: @${rule.name}`);
  });
  const fonts = [];
  css.walkAtRules('font-face', rule => rule.walkDecls('src', declaration => fonts.push(declaration.value)));
  assert.ok(fonts.some(value => value.includes('/assets/inter-latin-wght-normal.woff2')));
});

test('landing follows device motion preferences without a separate toggle', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const script = await readFile(path.join(output, 'public.js'), 'utf8');
  const css = await readFile(path.join(output, 'style.css'), 'utf8');
  for (const content of [html, script, css]) {
    assert.doesNotMatch(content, /Quiet motion|motion-toggle|motion-switch|foundry\.motion/);
  }
  assert.match(script, /prefers-reduced-motion/);
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

test('landing groups six specialist roles with decorative icons and a catalog link', async () => {
  const tree = parse(await readFile(path.join(output, 'index.html'), 'utf8'));
  let section;
  walk(tree, node => {
    if (attr(node, 'aria-labelledby') === 'specialists-title') section = node;
  });
  assert.ok(section, 'specialist section has a named heading');
  const roles = [];
  let catalog = false;
  walk(section, node => {
    if (node.tagName === 'li') {
      const heading = node.childNodes.find(child => child.tagName === 'h3');
      roles.push(heading?.childNodes[0]?.value);
      const icon = node.childNodes.find(child => child.tagName === 'svg');
      assert.equal(attr(icon, 'aria-hidden'), 'true');
    }
    if (attr(node, 'href') === '/docs/catalog/') catalog = true;
  });
  assert.deepEqual(roles, ['Research', 'Planning', 'Design', 'Development', 'Testing', 'Review']);
  assert.ok(catalog);
});

test('README banner reuses the Foundry wordmark and has a self-contained background', async () => {
  const banner = await readFile(path.join(root, 'site/assets/foundry-banner.svg'), 'utf8');
  const wordmark = await readFile(path.join(root, 'site/assets/foundry-wordmark.svg'), 'utf8');
  const logoPath = /<path d="([^"]+)"/.exec(wordmark)?.[1];
  assert.ok(logoPath);
  assert.ok(banner.includes(logoPath));
  assert.match(banner, /<rect[^>]+fill="#101010"/);
  assert.doesNotMatch(banner, /<script|<image|<foreignObject/);
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const images = [];
  walk(parse(readme), node => {
    if (node.tagName === 'img') images.push(attr(node, 'src'));
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
  assert.equal(await readFile(path.join(output, new URL(images[0]).pathname), 'utf8'), banner);
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
