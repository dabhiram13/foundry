import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const pages = new Map(
  [
    ['docs/README.md', 'index'],
    ['docs/GETTING-STARTED.md', 'getting-started'],
    ['docs/COMMANDS.md', 'commands'],
    ['docs/RUNTIME.md', 'runtime'],
    ['docs/PROVIDERS.md', 'providers'],
    ['docs/WORKFLOW.md', 'workflow'],
    ['docs/WORKFLOW-CONTRACTS.md', 'workflow-contracts'],
    ['docs/CUSTOMIZATION.md', 'customization'],
    ['docs/VALIDATION.md', 'validation'],
    ['docs/DOCUMENTATION.md', 'documentation'],
    ['docs/CATALOG.md', 'catalog'],
    ['docs/QUALIFICATION.md', 'qualification'],
    ['docs/COMPONENT-SOURCES.md', 'component-sources'],
    ['docs/ARCHITECTURE.md', 'architecture'],
    ['docs/PROVENANCE.md', 'provenance'],
    ['docs/RELEASING.md', 'releasing'],
  ],
);
pages.set('CONTRIBUTING.md', 'contributing');
pages.set('SECURITY.md', 'security');
pages.set('THIRD_PARTY_NOTICES.md', 'notices');

export function pageUrl(slug) {
  return slug === 'index' ? '/docs/' : `/docs/${slug}/`;
}
