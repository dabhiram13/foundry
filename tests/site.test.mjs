import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { parse } from 'parse5';
import { pages, pageUrl, root } from '../site/content-map.mjs';

const output = path.join(root, 'site/dist');
function walk(node, callback) {
  callback(node);
  for (const child of node.childNodes ?? []) walk(child, callback);
}
function attr(node, name) { return node.attrs?.find((attribute) => attribute.name === name)?.value; }

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
    assert.ok(editLink, `${source}: edit the original source, not generated copies`);
    assert.match(html, /pagefind|Search/);
    await checkLocalLinks(tree, pageUrl(slug));
  }
});

test('public landing is pre-rendered and does not load the workspace client', async () => {
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /Start with an idea/);
  assert.match(html, /href="\/docs\/"/);
  assert.doesNotMatch(html, /foundry-token|src="\/app.js"|Open local browser view/);
  const script = await readFile(path.join(output, 'public.js'), 'utf8');
  assert.doesNotMatch(script, /\/api\/snapshot|X-Foundry-Token|foundry_snapshot/);
  assert.ok(gzipSync(script).byteLength <= 165_000, 'Public JS exceeds the 165 kB gzip budget');
  await checkLocalLinks(parse(html), '/');
});
