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

export const descriptions = {
  index: 'Learn to use Foundry, the open-source CLI for AI-assisted software development. Install it, connect Codex and build your first project.',
  'getting-started': 'Install Foundry with npm, connect Codex, create a project and approve its plan and design before building.',
  commands: 'Find Foundry terminal commands for creating projects, running stages, approving plans, configuring providers and recovering work.',
  runtime: 'Add Foundry to an existing repository, track a change, run checks and recover interrupted work.',
  providers: 'Connect Codex to Foundry or build a custom AI provider adapter with the process protocol, capabilities and billing settings.',
  workflow: 'Understand how Foundry coordinates Research, Plan, Design, Build, Test and Ship with approval gates and saved evidence.',
  'workflow-contracts': 'Learn how Foundry validates saved records, binds approvals to document revisions and records checks and recovery.',
  customization: 'Configure Foundry project folders, provider selection, specialist roles, billing consent and required checks.',
  validation: 'Run Foundry runtime, package, website, catalog and security tests with local fixtures and reproducible commands.',
  documentation: 'Build and maintain the Foundry documentation website using canonical Markdown sources, Astro and Starlight.',
  catalog: 'Explore Foundry specialist roles, their permissions and the optional reference skills available to contributors.',
  qualification: 'Test a Foundry provider integration with local protocol checks and a controlled live project.',
  'component-sources': 'Find the components, styles, fonts and source licenses used by the Foundry landing page and documentation.',
  architecture: 'Explore the Foundry TypeScript architecture: shared CLI core, project lifecycle, provider adapters and saved records.',
  provenance: 'Find source attribution and licensing records for material included in and adapted by Foundry.',
  releasing: 'Prepare, test and publish a Foundry npm release from an approved source revision and verified package tarball.',
  contributing: 'Set up a Foundry source checkout, make focused changes and run the contributor checks before opening a pull request.',
  security: 'Understand Foundry trust boundaries, provider permissions, source handling and how to report a vulnerability safely.',
  notices: 'Read third-party license notices and attribution for software, reference material and assets included with Foundry.',
};
