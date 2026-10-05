import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { pages, root } from '../site/content-map.mjs';

const content = path.join(root, 'site/src/content/docs/docs');
await rm(content, { recursive: true, force: true });
await mkdir(content, { recursive: true });
for (const [source, slug] of pages) {
  const markdown = await readFile(path.join(root, source), 'utf8');
  const heading = /^# (.+)$/m.exec(markdown);
  if (!heading) throw new Error(`${source} needs a top-level title`);
  const title = heading[1];
  const body = markdown.replace(/^# .+\r?\n/m, '');
  const frontmatter = `---\ntitle: ${JSON.stringify(title)}\neditUrl: ${JSON.stringify(`https://github.com/dabhiram13/foundry/edit/main/${source}`)}\n---\n`;
  await writeFile(path.join(content, `${slug}.md`), frontmatter + body);
}
const publicDir = path.join(root, 'site/public');
const generated = path.join(root, 'site/.generated');
await mkdir(generated, { recursive: true });
await cp(path.join(root, 'app/assets'), path.join(publicDir, 'assets'), { recursive: true });
await cp(path.join(root, 'docs/images'), path.join(publicDir, 'docs/images'), { recursive: true });
await cp(path.join(root, 'app/style.css'), path.join(publicDir, 'style.css'));
const notice = await readFile(path.join(root, 'app/assets/animate-ui.LICENSE.md'), 'utf8')
  + '\n' + await readFile(path.join(root, 'app/assets/licenses/shadcn-ui.txt'), 'utf8');
const options = { bundle: true, tsconfig: path.join(root, 'tsconfig.json'), banner: { js: `/*! ${notice} */` } };
await build({ ...options, entryPoints: [path.join(root, 'app/src/public-entry.tsx')], outfile: path.join(publicDir, 'public.js'), format: 'iife', platform: 'browser', minify: true });
const render = path.join(generated, 'render.cjs');
await build({ ...options, entryPoints: [path.join(root, 'app/src/public-render.tsx')], outfile: render, format: 'cjs', platform: 'node' });
const { renderPublicPage } = await import(pathToFileURL(render).href);
await writeFile(path.join(generated, 'landing.html'), renderPublicPage());
console.log(`Prepared ${pages.size} docs pages from their original sources and a standalone public landing page.`);
