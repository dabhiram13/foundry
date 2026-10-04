import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const pages = new Map(
  readdirSync(new URL('../docs/', import.meta.url))
    .filter((name) => name.endsWith('.md'))
    .map((name) => [`docs/${name}`, name === 'README.md' ? 'index' : name.slice(0, -3).toLowerCase()]),
);
pages.set('CONTRIBUTING.md', 'contributing');
pages.set('SECURITY.md', 'security');
pages.set('THIRD_PARTY_NOTICES.md', 'notices');

export function pageUrl(slug) {
  return slug === 'index' ? '/docs/' : `/docs/${slug}/`;
}
