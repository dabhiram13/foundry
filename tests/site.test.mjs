import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
  assert.match(guide, /Your selected AI provider performs the AI/);
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
  assert.match(html, /An idea\.<br\/>A plan\.<br\/><em>A product\.<\/em>/);
  assert.match(html, /A framework for building products/);
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
  assert.match(banner, /<rect[^>]+fill="#0a0a09"/);
  assert.doesNotMatch(banner, /<script|<image|<foreignObject/);
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const images = [];
  walk(parse(readme), node => {
    if (node.tagName === 'img') images.push(attr(node, 'src'));
  });
  assert.equal(images[0], 'https://raw.githubusercontent.com/dabhiram13/foundry/main/site/assets/foundry-banner.svg');
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
  assert.match(banner, /viewBox="0 0 1200 340"/);
  assert.match(banner, /translate\(282 58\) scale\(\.16\)/);
  const width = Number(/viewBox="-30 -30 (\d+) 820"/.exec(wordmark)?.[1]);
  assert.ok(width * .16 + 282 < 1200, 'outlined wordmark fits within the banner');
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
    if (attr(node, 'class') === 'landing-menu') mobileMenu = node;
    if (textContent(summary).endsWith('?')) faqs.push(node);
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
    assert.match(textContent(stage), /Assignment/);
    assert.match(textContent(stage), /Output/);
  }
  assert.equal(faqs.length, 5);
  assert.ok(mobileMenu);
  assert.match(textContent(mobileMenu), /The processSpecialistsDocumentation/);
  assert.match(html, /28 role definitions/);
  assert.match(textContent(tree), /OpenCode source preview supports Research, Plan, Design, Builders and Reviewer/);
  assert.match(textContent(tree), /not part of npm 0\.5\.1/);
  assert.match(textContent(tree), /live model-driven product trial remains unqualified/);
  assert.doesNotMatch(html, /full specialist journey is not yet exposed/);
  assert.match(html, /Homebrew distribution is planned, not available/);
  assert.match(html, /Ship is a local handoff, not automatic deployment/);
  assert.doesNotMatch(html, /role="tab"|<canvas|<iframe|Imageory|Spline/);
});

test('connected setup is reachable and keeps source, checks and owner approval explicit', async () => {
  assert.equal(pages.get('docs/CONNECTED-CLIENT.md'), 'connected-client');
  const guide = await readFile(path.join(root, 'docs/CONNECTED-CLIENT.md'), 'utf8');
  for (const command of ['npm ci --ignore-scripts', 'npm run build:runtime',
    './foundry init --project', './foundry connect opencode --project',
    '--dry-run', '--apply', '--remove', './foundry work review --project',
    './foundry work approve --revision HASH', './foundry work context --project']) {
    assert.ok(guide.includes(command), `missing connected setup: ${command}`);
  }
  assert.match(guide, /not part of published npm 0\.5\.1/);
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

function webpDimensions(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
  for (let offset = 12; offset + 8 < buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const data = offset + 8;
    if (type === 'VP8 ') {
      assert.equal(buffer.subarray(data + 3, data + 6).toString('hex'), '9d012a');
      return [buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff];
    }
    if (type === 'VP8X') return [buffer.readUIntLE(data + 4, 3) + 1, buffer.readUIntLE(data + 7, 3) + 1];
    const size = buffer.readUInt32LE(offset + 4);
    offset = data + size + (size % 2);
  }
  assert.fail('Expected a decodable generated WebP asset');
}

test('generated art is local, dimensioned, responsive and tied to its provenance hashes', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'site/assets/art/manifest.json'), 'utf8'));
  assert.equal(manifest.medium, 'AI-generated raster illustrations');
  assert.match(manifest.reference_boundary, /not embedded or distributed/);
  assert.match(manifest.clearance, /not a copyright, trademark or exclusivity-clearance guarantee/);
  assert.deepEqual(manifest.pieces.map(piece => piece.id), ['horse', 'horse-wide', 'research', 'build', 'handoff']);
  for (const piece of manifest.pieces) {
    assert.match(piece.master_sha256, /^[0-9a-f]{64}$/);
    for (const file of piece.files) {
      const bytes = await readFile(path.join(output, 'assets/art', file.file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.file);
      assert.equal(bytes.length, file.bytes, file.file);
      assert.deepEqual(webpDimensions(bytes), file.size, file.file);
      assert.ok(bytes.length <= (file.size[0] === 768 ? 550_000 : 850_000), `${file.file}: image byte budget`);
    }
  }
  const images = [];
  walk(parse(await readFile(path.join(output, 'index.html'), 'utf8')), node => {
    if (node.tagName === 'img' && attr(node, 'class') === 'foundry-art') images.push(node);
  });
  assert.equal(images.length, 4);
  assert.equal(images.filter(node => attr(node, 'loading') === 'eager').length, 1);
  assert.equal(attr(images[0], 'fetchpriority'), 'high');
  for (const node of images) {
    assert.equal(attr(node, 'width'), '1024');
    assert.equal(attr(node, 'height'), '1536');
    assert.ok(attr(node, 'alt')?.length > 30);
    assert.match(attr(node, 'src'), /^\/assets\/art\/.*-768\.webp$/);
    const sources = attr(node, 'srcset').split(', ').map(source => source.split(' '));
    assert.deepEqual(sources.map(source => source[1]), ['768w', '1024w']);
    for (const [src] of sources) assert.ok((await stat(path.join(output, src))).isFile(), src);
  }
});

test('the editorial system keeps local fonts, high contrast and still artwork', async () => {
  const css = await readFile(path.join(output, 'style.css'), 'utf8');
  assert.match(css, /cormorant-garamond-latin-600\.ttf/);
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic|https:\/\/.*\.(?:woff2|ttf)/);
  const source = await readFile(path.join(root, 'site/src/landing/landing.css'), 'utf8');
  assert.match(source, /\.foundry-art\s*\{[^}]*height: auto;[^}]*aspect-ratio: 2\/3/s);
  assert.doesNotMatch(source, /\.foundry-art\s*\{[^}]*(?:animation|transform|object-fit: cover)/s);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /min-height: 44px/);
  const luminance = hex => {
    const rgb = hex.match(/[0-9a-f]{2}/g).map(part => parseInt(part, 16) / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return rgb.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  };
  for (const [foreground, background] of [['f0e6d3', '0a0a09'], ['f0e6d3', 'cd150c'], ['f0e6d3', '70120e'], ['b8aa93', '0a0a09'], ['554a3d', 'f0e6d3']]) {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((light + .05) / (dark + .05) >= 4.5, `${foreground} on ${background}: body contrast`);
  }
  const license = await readFile(path.join(output, 'assets/licenses/Cormorant-OFL.txt'), 'utf8');
  assert.match(license, /Copyright 2015 the Cormorant Project Authors/);
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
