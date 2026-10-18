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
  assert.match(html, /A clear path<br\/>from idea to product\./);
  assert.match(html, /Build products,<br\/>step by step\./);
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
  assert.ok(fonts.some(value => value.includes('/assets/inter-latin-wght-normal.woff2')));
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

test('README banner contains only the Foundry logo and name on a self-contained background', async () => {
  const banner = await readFile(path.join(root, 'site/assets/foundry-banner.svg'), 'utf8');
  const wordmark = await readFile(path.join(root, 'site/assets/foundry-wordmark.svg'), 'utf8');
  const logoPath = /<path d="([^"]+)"/.exec(wordmark)?.[1];
  assert.ok(logoPath);
  assert.ok(banner.includes(logoPath));
  assert.match(banner, /<rect[^>]+fill="#fafafa"/);
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
  assert.match(wordmark, /Inter glyph outlines, SIL OFL 1\.1/);
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

test('product journey remains native, readable and honest about connection boundaries', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const tree = parse(html);
  const stages = [];
  const faqs = [];
  let mobileMenu;
  walk(tree, node => {
    if (node.tagName !== 'details') return;
    const summary = node.childNodes.find(child => child.tagName === 'summary');
    assert.ok(summary && textContent(summary).trim(), 'native disclosures have names');
    if (attr(node, 'name') === 'foundry-stages') stages.push(node);
    if (attr(node, 'class') === 'mobile-menu') mobileMenu = node;
    if (textContent(summary).replace(/[+−]\s*$/, '').trim().endsWith('?')) faqs.push(node);
  });
  assert.equal(stages.length, 6);
  const labels = stages.map(node => {
    let heading;
    walk(node, child => { if (child.tagName === 'h3') heading = textContent(child); });
    return heading;
  });
  assert.deepEqual(labels, ['Research', 'Plan', 'Design', 'Build', 'Review', 'Handoff']);
  assert.equal(stages.filter(node => attr(node, 'open') !== undefined).length, 1);
  for (const stage of stages) {
    assert.match(textContent(stage), /Role/);
    assert.match(textContent(stage), /Result/);
  }
  assert.equal(faqs.length, 5);
  assert.ok(mobileMenu);
  assert.match(textContent(mobileMenu), /How it worksSpecialistsDocumentation/);
  assert.match(textContent(tree), /Role names are not separate running agents/);
  assert.match(textContent(tree), /Not in npm 0\.5\.1/);
  assert.match(textContent(tree), /Managed workspace\s+In development/);
  assert.match(textContent(tree), /running preview and captured desktop and mobile views/);
  assert.doesNotMatch(html, /full specialist journey is not yet exposed/);
  assert.match(html, /Homebrew is not available/);
  assert.match(html, /Ship writes a project summary; it does not publish or deploy/);
  assert.doesNotMatch(html, /role="tab"|<canvas|<iframe|Imageory|Spline/);
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
  assert.match(readme, /research, plan, design, build and review software/);
  assert.match(readme, /not in npm 0\.5\.1/);
  assert.match(readme, /new\s+visual workflow has local test coverage, not a live-model trial/);
  assert.match(readme, /running app preview, components and captured mobile\/desktop states/);
  assert.match(readme, /Service work needs no images/);
});

test('neutral public system uses local fonts and no obsolete production art or motion', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const script = await readFile(path.join(output, 'public.js'), 'utf8');
  const css = await readFile(path.join(output, 'style.css'), 'utf8');
  assert.match(css, /inter-latin-wght-normal\.woff2/);
  assert.doesNotMatch(html + css + script, /assets\/art\/|cormorant-garamond|MotionConfig|AnimatePresence/);
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic|https:\/\/.*\.(?:woff2|ttf)/);
  const source = await readFile(path.join(root, 'site/src/landing/landing.css'), 'utf8');
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /min-height: 44px/);
  assert.doesNotMatch(source, /linear-gradient|backdrop-filter|\.foundry-art/);
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.devDependencies.motion, undefined);
  assert.equal(manifest.devDependencies['tw-animate-css'], undefined);
  for (const asset of ['assets/art', 'assets/cormorant-garamond-latin-600.ttf', 'assets/animate-ui.LICENSE.md']) {
    assert.equal(await stat(path.join(output, asset)).catch(() => null), null, `${asset}: not shipped`);
  }
  assert.ok(gzipSync(script).byteLength < 100_000, 'neutral public JS stays below 100 kB gzip');
});

test('shared palette has readable body, primary, link, error and focus contrast in both themes', async () => {
  const luminance = hex => {
    const rgb = hex.match(/[0-9a-f]{2}/g).map(part => parseInt(part, 16) / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return rgb.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  };
  for (const [foreground, background] of [['18181b', 'fafafa'], ['61616b', 'fafafa'], ['61616b', 'ffffff'], ['ffffff', '18181b'], ['2563eb', 'fafafa'], ['b91c1c', 'ffffff'], ['fafafa', '101012'], ['a1a1aa', '101012'], ['a1a1aa', '18181b'], ['18181b', 'f4f4f5'], ['93c5fd', '18181b'], ['fca5a5', '18181b']]) {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((light + .05) / (dark + .05) >= 4.5, `${foreground} on ${background}: body contrast`);
  }
  const license = await readFile(path.join(output, 'assets/licenses/Inter-OFL.txt'), 'utf8');
  assert.match(license, /SIL OPEN FONT LICENSE/);
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
