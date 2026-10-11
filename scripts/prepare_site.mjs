import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import { descriptions, pages, root } from '../site/content-map.mjs';

const content = path.join(root, 'site/src/content/docs/docs');
await rm(content, { recursive: true, force: true });
await mkdir(content, { recursive: true });
for (const [source, slug] of pages) {
  const markdown = await readFile(path.join(root, source), 'utf8');
  const heading = /^# (.+)$/m.exec(markdown);
  if (!heading) throw new Error(`${source} needs a top-level title`);
  const title = heading[1];
  const body = markdown.replace(/^# .+\r?\n/m, '');
  if (!descriptions[slug]) throw new Error(`${source} needs a page description`);
  const frontmatter = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(descriptions[slug])}\neditUrl: false\n---\n`;
  await writeFile(path.join(content, `${slug}.md`), frontmatter + body);
}
const publicDir = path.join(root, 'site/public');
const generated = path.join(root, 'site/.generated');
await mkdir(generated, { recursive: true });
await rm(path.join(publicDir, 'assets'), { recursive: true, force: true });
await cp(path.join(root, 'site/assets'), path.join(publicDir, 'assets'), { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const badges = [
  ['ci', 'CI', 'checks', '#2563eb'],
  ['npm', 'npm', `v${manifest.version}`, '#2563eb'],
  ['node', 'node', manifest.engines.node, '#357a38'],
  ['license', 'license', manifest.license, '#357a38'],
  ['docs', 'docs', 'read', '#2563eb'],
];
const escapeXml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
for (const [name, label, value, color] of badges) {
  const left = label.length * 7 + 18;
  const right = value.length * 7 + 18;
  const title = escapeXml(`${label}: ${value}`);
  await writeFile(path.join(publicDir, 'assets', `badge-${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${left + right}" height="24" role="img" aria-label="${title}">
<title>${title}</title><rect width="${left + right}" height="24" rx="3" fill="${color}"/><path d="M3 0H${left}V24H3Q0 24 0 21V3Q0 0 3 0" fill="#454545"/>
<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans Mono,monospace" font-size="12"><text x="${left / 2}" y="16">${escapeXml(label)}</text><text x="${left + right / 2}" y="16">${escapeXml(value)}</text></g></svg>\n`);
}
await rm(path.join(publicDir, 'docs/images'), { recursive: true, force: true });
const cssInput = path.join(root, 'site/src/landing/globals.css');
const cssOutput = path.join(publicDir, 'style.css');
const css = await postcss([tailwindcss({ base: root, optimize: { minify: true } })])
  .process(await readFile(cssInput, 'utf8'), { from: cssInput, to: cssOutput, map: false });
await writeFile(cssOutput, css.css.replace(/\r?\n$/, ''));
const notice = await readFile(path.join(root, 'site/assets/animate-ui.LICENSE.md'), 'utf8')
  + '\n' + await readFile(path.join(root, 'site/assets/licenses/shadcn-ui.txt'), 'utf8')
  + '\n' + await readFile(path.join(root, 'site/assets/licenses/Three-MIT.txt'), 'utf8');
const options = { bundle: true, tsconfig: path.join(root, 'tsconfig.json'), banner: { js: `/*! ${notice} */` } };
await rm(path.join(publicDir, 'chunks'), { recursive: true, force: true });
await build({ ...options, entryPoints: { public: path.join(root, 'site/src/landing/public-entry.tsx') }, outdir: publicDir, chunkNames: 'chunks/[name]-[hash]', format: 'esm', splitting: true, platform: 'browser', minify: true });
const render = path.join(generated, 'render.cjs');
await build({ ...options, entryPoints: [path.join(root, 'site/src/landing/public-render.tsx')], outfile: render, format: 'cjs', platform: 'node' });
const { renderPublicPage } = await import(pathToFileURL(render).href);
await writeFile(path.join(generated, 'landing.html'), renderPublicPage());
console.log(`Prepared ${pages.size} docs pages from their original sources and a standalone public landing page.`);
