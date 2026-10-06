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
  const frontmatter = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(descriptions[slug])}\neditUrl: ${JSON.stringify(`https://github.com/dabhiram13/foundry/edit/main/${source}`)}\n---\n`;
  await writeFile(path.join(content, `${slug}.md`), frontmatter + body);
}
const publicDir = path.join(root, 'site/public');
const generated = path.join(root, 'site/.generated');
await mkdir(generated, { recursive: true });
await rm(path.join(publicDir, 'assets'), { recursive: true, force: true });
await cp(path.join(root, 'site/assets'), path.join(publicDir, 'assets'), { recursive: true });
await rm(path.join(publicDir, 'docs/images'), { recursive: true, force: true });
const cssInput = path.join(root, 'site/src/landing/globals.css');
const cssOutput = path.join(publicDir, 'style.css');
const css = await postcss([tailwindcss({ base: root, optimize: { minify: true } })])
  .process(await readFile(cssInput, 'utf8'), { from: cssInput, to: cssOutput, map: false });
await writeFile(cssOutput, css.css.replace(/\r?\n$/, ''));
const notice = await readFile(path.join(root, 'site/assets/animate-ui.LICENSE.md'), 'utf8')
  + '\n' + await readFile(path.join(root, 'site/assets/licenses/shadcn-ui.txt'), 'utf8');
const options = { bundle: true, tsconfig: path.join(root, 'tsconfig.json'), banner: { js: `/*! ${notice} */` } };
await build({ ...options, entryPoints: [path.join(root, 'site/src/landing/public-entry.tsx')], outfile: path.join(publicDir, 'public.js'), format: 'iife', platform: 'browser', minify: true });
const render = path.join(generated, 'render.cjs');
await build({ ...options, entryPoints: [path.join(root, 'site/src/landing/public-render.tsx')], outfile: render, format: 'cjs', platform: 'node' });
const { renderPublicPage } = await import(pathToFileURL(render).href);
await writeFile(path.join(generated, 'landing.html'), renderPublicPage());
console.log(`Prepared ${pages.size} docs pages from their original sources and a standalone public landing page.`);
