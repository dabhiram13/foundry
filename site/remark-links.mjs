import path from 'node:path';
import { pages, pageUrl } from './content-map.mjs';

const originals = new Map([...pages].map(([source, slug]) => [slug, source]));
export default function links() {
  return (tree, file) => {
    const source = originals.get(path.basename(file.path, path.extname(file.path)));
    if (!source) return;
    function walk(node) {
      if (typeof node.url === 'string' && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(node.url)) {
        const target = new URL(node.url, `https://source.invalid/${source}`);
        const relative = decodeURIComponent(target.pathname.slice(1));
        const slug = pages.get(relative);
        node.url = slug ? `${pageUrl(slug)}${target.search}${target.hash}`
          : `https://github.com/dabhiram13/foundry/blob/main/${relative}${target.hash}`;
      }
      for (const child of node.children ?? []) walk(child);
    }
    walk(tree);
  };
}
